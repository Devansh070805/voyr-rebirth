/**
 * Retry Utilities — Generic retry-with-exponential-backoff and dead-letter queue handling.
 *
 * Provides:
 * - `withRetry`: A generic wrapper that retries an async operation with configurable
 *   exponential backoff, jitter, and max attempts.
 * - `createDeadLetterQueueConsumer`: Processes messages from the dead-letter queue
 *   and surfaces failures to the Admin Ops dashboards via the document_jobs and
 *   audit_logs tables.
 *
 * Retry profiles:
 * - Payment webhook delivery: 3 retries, 2s base backoff
 * - External API calls (AI, email, payment provider): 3 retries, 1s base backoff
 * - Cloudflare Queue consumers (document generation): 5 retries, 1s base backoff
 *
 * Requirements: 18.1, 18.2, 18.3, 18.4
 */

import { createLogger } from './logger.js';
import { query, queryOne } from '../db/index.js';
import { logAudit } from './audit.service.js';

const logger = createLogger('retry');


export interface RetryOptions {
  /** Maximum number of attempts (including the first). Default: 3 */
  maxAttempts: number;
  /** Base delay in milliseconds before the first retry. Default: 1000 */
  baseDelayMs: number;
  /** Maximum delay cap in milliseconds. Default: 30000 */
  maxDelayMs: number;
  /** Multiplier for exponential growth. Default: 2 */
  backoffMultiplier: number;
  /** Whether to add random jitter (0–50% of delay). Default: true */
  jitter: boolean;
  /** Optional operation name for logging. */
  operationName?: string;
  /** Optional predicate to decide if an error is retryable. Default: all errors are retryable. */
  isRetryable?: (error: unknown) => boolean;
  /** Optional callback invoked before each retry with attempt number and error. */
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
}

export interface DeadLetterMessage {
  id?: string;
  bookingId?: string;
  jobId?: string;
  operation: string;
  payload: unknown;
  error: string;
  originalAttempts: number;
  movedAt: string;
}

export interface DeadLetterQueueConsumer {
  processMessage(message: DeadLetterMessage): Promise<void>;
  processMessages(messages: DeadLetterMessage[]): Promise<{ processed: number; failed: number }>;
}


/**
 * Retry profile for payment webhook delivery.
 * Requirements: 18.1
 */
export const RETRY_PAYMENT_WEBHOOK: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 2000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
  operationName: 'payment-webhook',
};

/**
 * Retry profile for external API calls (AI provider, email provider).
 * Requirements: 18.2
 */
export const RETRY_EXTERNAL_API: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 15000,
  backoffMultiplier: 2,
  jitter: true,
  operationName: 'external-api',
};

/**
 * Retry profile for payment provider API calls (Stripe / Razorpay).
 * Shorter backoff because idempotency keys make retries safe.
 */
export const RETRY_PAYMENT_PROVIDER: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 500,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitter: true,
  operationName: 'payment-provider',
};

/**
 * Retry profile for Cloudflare Queue consumers (document generation, notifications).
 * Requirements: 18.3
 */
export const RETRY_QUEUE_CONSUMER: RetryOptions = {
  maxAttempts: 5,
  baseDelayMs: 1000,
  maxDelayMs: 60000,
  backoffMultiplier: 2,
  jitter: true,
  operationName: 'queue-consumer',
};


/**
 * Execute an async operation with exponential backoff retry.
 *
 * @param fn - The async function to execute.
 * @param options - Retry configuration options.
 * @returns A RetryResult containing the outcome and attempt count.
 *
 * @example
 * ```ts
 * const result = await withRetry(
 *   () => callExternalAPI(payload),
 *   RETRY_EXTERNAL_API,
 * );
 *
 * if (!result.success) {
 *   // All retries exhausted
 *   logger.error('API call failed permanently', { error: result.error });
 * }
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<RetryResult<T>> {
  const config: RetryOptions = {
    maxAttempts: options.maxAttempts ?? 3,
    baseDelayMs: options.baseDelayMs ?? 1000,
    maxDelayMs: options.maxDelayMs ?? 30000,
    backoffMultiplier: options.backoffMultiplier ?? 2,
    jitter: options.jitter ?? true,
    operationName: options.operationName,
    isRetryable: options.isRetryable,
    onRetry: options.onRetry,
  };

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      const result = await fn();
      if (attempt > 1) {
        logger.info('Operation succeeded after retry', {
          operation: config.operationName,
          attempt,
          totalAttempts: config.maxAttempts,
        });
      }
      return { success: true, result, attempts: attempt };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      if (config.isRetryable && !config.isRetryable(error)) {
        logger.warn('Non-retryable error encountered, aborting', {
          operation: config.operationName,
          attempt,
          error: lastError.message,
        });
        return { success: false, error: lastError, attempts: attempt };
      }

      // If this was the last attempt, don't delay
      if (attempt >= config.maxAttempts) {
        logger.error('All retry attempts exhausted', {
          operation: config.operationName,
          attempts: attempt,
          error: lastError.message,
        });
        break;
      }

      // Calculate delay with exponential backoff
      const delayMs = calculateDelay(attempt, config);

      logger.warn('Operation failed, scheduling retry', {
        operation: config.operationName,
        attempt,
        maxAttempts: config.maxAttempts,
        nextRetryMs: delayMs,
        error: lastError.message,
      });

      // Invoke onRetry callback if provided
      if (config.onRetry) {
        config.onRetry(attempt, error, delayMs);
      }

      // Wait before retrying
      await sleep(delayMs);
    }
  }

  return { success: false, error: lastError, attempts: config.maxAttempts };
}

/**
 * Execute an async operation with retry, throwing on final failure.
 * This is a convenience wrapper around `withRetry` for cases where
 * you want the error to propagate.
 *
 * @throws The last error if all retries are exhausted.
 */
export async function withRetryOrThrow<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const result = await withRetry(fn, options);

  if (!result.success) {
    throw result.error || new Error('Operation failed after all retry attempts');
  }

  return result.result as T;
}


/**
 * Creates a dead-letter queue consumer that processes failed messages
 * and surfaces them to the Admin Ops dashboards.
 *
 * When a job is moved to the dead-letter queue (after max retries exceeded),
 * this consumer:
 * 1. Records the failure in the appropriate table (document_jobs, etc.)
 * 2. Inserts an audit log entry for traceability
 * 3. Ensures the failure is visible in Admin Ops dashboards
 *
 * Requirements: 18.4
 */
export function createDeadLetterQueueConsumer(): DeadLetterQueueConsumer {
  return {
    /**
     * Process a single dead-letter message.
     * Surfaces the failure to the Admin Ops dashboard by updating
     * the relevant database records.
     */
    async processMessage(message: DeadLetterMessage): Promise<void> {
      const { operation, bookingId, jobId, error, originalAttempts, payload } = message;

      logger.info('Processing dead-letter message', {
        operation,
        bookingId,
        jobId,
        originalAttempts,
      });

      try {
        // Surface failure based on operation type
        switch (operation) {
          case 'document.generation':
          case 'document.enqueue':
            await handleDocumentFailure(bookingId, jobId, error, originalAttempts);
            break;

          case 'notification.send':
          case 'notification.send_booking_documents':
            await handleNotificationFailure(bookingId, error, originalAttempts);
            break;

          case 'payment.webhook':
          case 'payment.process_webhook':
            await handlePaymentWebhookFailure(bookingId, error, originalAttempts, payload);
            break;

          default:
            await handleGenericFailure(operation, bookingId, jobId, error, originalAttempts);
            break;
        }

        // Audit log for all DLQ messages
        await logAudit('system', 'dlq.message_processed', 'dead_letter_queue', bookingId || null, {
          operation,
          job_id: jobId,
          error,
          original_attempts: originalAttempts,
          moved_at: message.movedAt,
        });

        logger.info('Dead-letter message processed successfully', {
          operation,
          bookingId,
          jobId,
        });
      } catch (processingError) {
        logger.error('Failed to process dead-letter message', {
          operation,
          bookingId,
          jobId,
          error: (processingError as Error).message,
        });
        throw processingError;
      }
    },

    /**
     * Process a batch of dead-letter messages.
     * Returns counts of successfully processed and failed messages.
     */
    async processMessages(
      messages: DeadLetterMessage[],
    ): Promise<{ processed: number; failed: number }> {
      let processed = 0;
      let failed = 0;

      for (const message of messages) {
        try {
          await this.processMessage(message);
          processed++;
        } catch {
          failed++;
        }
      }

      logger.info('Dead-letter batch processing complete', {
        total: messages.length,
        processed,
        failed,
      });

      return { processed, failed };
    },
  };
}


/**
 * Handle document generation failure from DLQ.
 * Updates document_jobs status to FAILED so it appears in Admin Ops dashboard.
 */
async function handleDocumentFailure(
  bookingId: string | undefined,
  jobId: string | undefined,
  error: string,
  attempts: number,
): Promise<void> {
  if (jobId) {
    // Update the document job status to FAILED
    await query(
      `UPDATE document_jobs SET status = 'FAILED' WHERE id = $1 AND status != 'COMPLETED'`,
      [jobId],
    );
  } else if (bookingId) {
    // Find and update any pending document jobs for this booking
    await query(
      `UPDATE document_jobs SET status = 'FAILED'
       WHERE booking_id = $1 AND status IN ('QUEUED', 'PROCESSING', 'RETRY_PENDING')`,
      [bookingId],
    );
  }

  await logAudit('system', 'document.dlq_failure', 'document_job', jobId || bookingId || null, {
    booking_id: bookingId,
    error,
    attempts,
  });

  logger.error('Document generation permanently failed (DLQ)', {
    bookingId,
    jobId,
    error,
    attempts,
  });
}

/**
 * Handle notification delivery failure from DLQ.
 * Records the failure so Admin Ops can investigate and manually trigger re-send.
 */
async function handleNotificationFailure(
  bookingId: string | undefined,
  error: string,
  attempts: number,
): Promise<void> {
  if (bookingId) {
    // Check if booking is still in DOCUMENTS_GENERATED state (notification never sent)
    const booking = await queryOne<{ id: string; status: string }>(
      `SELECT id, status FROM bookings WHERE id = $1`,
      [bookingId],
    );

    if (booking && booking.status === 'DOCUMENTS_GENERATED') {
      logger.error('Notification permanently failed, booking stuck in DOCUMENTS_GENERATED', {
        bookingId,
        error,
        attempts,
      });
    }
  }

  await logAudit('system', 'notification.dlq_failure', 'booking', bookingId || null, {
    error,
    attempts,
  });
}

/**
 * Handle payment webhook processing failure from DLQ.
 * Records the failure so Admin Ops can investigate via failed payments dashboard.
 */
async function handlePaymentWebhookFailure(
  bookingId: string | undefined,
  error: string,
  attempts: number,
  payload: unknown,
): Promise<void> {
  // If we have a payment reference in the payload, update the payment status
  if (payload && typeof payload === 'object' && 'payment_id' in payload) {
    const paymentId = (payload as { payment_id: string }).payment_id;
    await query(
      `UPDATE payments SET status = 'FAILED' WHERE id = $1 AND status = 'PENDING'`,
      [paymentId],
    );

    // Insert a payment event recording the DLQ failure
    await query(
      `INSERT INTO payment_events (payment_id, payload)
       VALUES ($1, $2)`,
      [paymentId, JSON.stringify({ event: 'dlq_failure', error, attempts, original_payload: payload })],
    );
  }

  await logAudit('system', 'payment.dlq_failure', 'payment', bookingId || null, {
    error,
    attempts,
    payload,
  });

  logger.error('Payment webhook permanently failed (DLQ)', {
    bookingId,
    error,
    attempts,
  });
}

/**
 * Handle generic operation failure from DLQ.
 */
async function handleGenericFailure(
  operation: string,
  bookingId: string | undefined,
  jobId: string | undefined,
  error: string,
  attempts: number,
): Promise<void> {
  await logAudit('system', `${operation}.dlq_failure`, operation, bookingId || jobId || null, {
    error,
    attempts,
  });

  logger.error('Operation permanently failed (DLQ)', {
    operation,
    bookingId,
    jobId,
    error,
    attempts,
  });
}


/**
 * Calculate the delay for a given attempt using exponential backoff with optional jitter.
 */
function calculateDelay(attempt: number, config: RetryOptions): number {
  // Exponential backoff: baseDelay * multiplier^(attempt-1)
  const exponentialDelay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);

  // Cap at maxDelay
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);

  // Add jitter (0–50% of the delay) to prevent thundering herd
  if (config.jitter) {
    const jitterAmount = cappedDelay * 0.5 * Math.random();
    return Math.floor(cappedDelay + jitterAmount);
  }

  return Math.floor(cappedDelay);
}

/**
 * Sleep utility for retry delays.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Determine if an HTTP error is retryable based on status code.
 * 5xx errors and 429 (rate limit) are retryable; 4xx errors are not.
 */
export function isHttpRetryable(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Network errors are retryable
    if (
      message.includes('econnrefused') ||
      message.includes('econnreset') ||
      message.includes('etimedout') ||
      message.includes('socket hang up') ||
      message.includes('network')
    ) {
      return true;
    }

    // Extract status code from error message
    const statusMatch = message.match(/\b(4\d{2}|5\d{2})\b/);
    if (statusMatch) {
      const status = parseInt(statusMatch[1], 10);
      // 5xx and 429 are retryable
      return status >= 500 || status === 429;
    }

    // Default: assume retryable for unknown errors
    return true;
  }

  return true;
}
