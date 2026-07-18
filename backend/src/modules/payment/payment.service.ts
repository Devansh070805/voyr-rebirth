/**
 * Payment Service — Session creation, webhook processing, signature validation.
 * Webhooks are the sole source of truth for payment status.
 */

import crypto from 'node:crypto';
import { queryOne, query, transaction } from '../../db/index.js';
import {
  createIdempotencyService,
  createStateMachineEngine,
  createLogger,
  ValidationError,
  NotFoundError,
  withRetryOrThrow,
  RETRY_PAYMENT_PROVIDER,
  isHttpRetryable,
  getMetricsService,
} from '../../infra/index.js';
import { logAudit } from '../../infra/audit.service.js';
import type { BookingState } from '../../infra/state-machine.engine.js';
import { getMockWebhookSecret, isPaymentMockMode } from './payment-mode.js';
// No direct import of booking.service — coupling broken via DI callbacks below

const logger = createLogger('payment-service');
const idempotencyService = createIdempotencyService();
const stateMachine = createStateMachineEngine();


export interface Payment {
  id: string;
  quote_id: string;
  provider: string;
  provider_ref: string | null;
  amount: number;
  status: string;
  created_at: string;
}

export interface CreatePaymentSessionRequest {
  quote_id: string;
}

export interface CreatePaymentSessionResponse {
  checkout_url: string;
  payment_id: string;
  return_url: string;
}

export interface PaymentWebhookPayload {
  event: string;
  payment_id: string;
  provider_ref: string;
  status: 'paid' | 'failed';
  amount?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentService {
  createSession(data: CreatePaymentSessionRequest, idempotencyKey: string): Promise<CreatePaymentSessionResponse>;
  processWebhook(signature: string, payload: PaymentWebhookPayload, idempotencyKey: string): Promise<void>;
  completeMockPayment(paymentId: string, status: 'paid' | 'failed'): Promise<void>;
  getPayment(paymentId: string): Promise<Payment>;
  validateSignature(signature: string, payload: unknown): boolean;
}

export type PaymentStatusResponse = Payment & { status: string; payment_mode: 'mock' | 'live' };


const PAYMENT_PROVIDER = 'razorpay';
const PAYMENT_WEBHOOK_SECRET =
  process.env.PAYMENT_WEBHOOK_SECRET || process.env.RAZORPAY_WEBHOOK_SECRET || '';
const PAYMENT_CHECKOUT_BASE_URL = process.env.PAYMENT_CHECKOUT_BASE_URL || 'https://checkout.razorpay.com/pay';

function buildPaymentReturnUrl(paymentId: string): string {
  const frontendBase = process.env.FRONTEND_URL || 'http://localhost:3000';
  return `${frontendBase.replace(/\/$/, '')}/payment/return?payment_id=${encodeURIComponent(paymentId)}`;
}

/**
 * Generate HMAC-SHA256 signature for webhook validation.
 */
function computeHmacSignature(payload: unknown, secret: string): string {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

function buildCheckoutUrlForPayment(paymentId: string, providerRef: string | null): string {
  if (isPaymentMockMode()) {
    const frontendBase = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    return `${frontendBase}/payment/mock?payment_id=${encodeURIComponent(paymentId)}`;
  }
  const ref = providerRef || `${PAYMENT_PROVIDER}_${paymentId}`;
  return `${PAYMENT_CHECKOUT_BASE_URL}/${ref}`;
}

/**
 * Call the payment provider API to create a checkout session.
 * In production, this would make an HTTP call to Razorpay.
 * Retries up to 3 times with exponential backoff for transient failures.
 */
async function callPaymentProviderAPI(params: {
  amount: number;
  currency: string;
  quote_id: string;
  payment_id: string;
}): Promise<{ checkout_url: string; provider_ref: string }> {
  return withRetryOrThrow(
    async () => {
      const provider_ref = `${PAYMENT_PROVIDER}_${params.payment_id}`;

      if (isPaymentMockMode()) {
        const frontendBase = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
        const checkout_url = `${frontendBase}/payment/mock?payment_id=${encodeURIComponent(params.payment_id)}`;
        logger.info('Mock payment session created', {
          payment_id: params.payment_id,
          checkout_url,
        });
        return { checkout_url, provider_ref };
      }

      // live: integrate Razorpay Orders API here
      const checkout_url = buildCheckoutUrlForPayment(params.payment_id, provider_ref);
      logger.info('Payment provider session created', {
        provider: PAYMENT_PROVIDER,
        provider_ref,
        amount: params.amount,
        currency: params.currency,
      });

      return { checkout_url, provider_ref };
    },
    {
      ...RETRY_PAYMENT_PROVIDER,
      operationName: 'payment-provider-create-session',
      isRetryable: isHttpRetryable,
    },
  );
}


export interface CreateBookingCallback {
  (quoteId: string, idempotencyKey: string): Promise<{ id: string }>;
}

export interface CreatePaymentTrackingBookingCallback {
  (quoteId: string): Promise<{ id: string }>;
}

/**
 * Create a PaymentService with optional booking creation callbacks.
 *
 * - `createBooking` is called after PAYMENT_PAID to formalize the booking
 * - `createPaymentTrackingBooking` is called during createSession to create
 *   the initial tracking booking record
 *
 * Both are injected via DI to break the circular coupling between payment ↔ booking modules.
 * If no callbacks are provided, raw SQL fallback is used (for backward compatibility).
 */
export function createPaymentService(
  createBooking?: CreateBookingCallback,
  createPaymentTrackingBooking?: CreatePaymentTrackingBookingCallback,
): PaymentService {
  return {
    async createSession(
      data: CreatePaymentSessionRequest,
      idempotencyKey: string,
    ): Promise<CreatePaymentSessionResponse> {
      const { quote_id } = data;

      // 1. Check idempotency
      const requestHash = JSON.stringify({ quote_id });
      const idempotencyResult = await idempotencyService.start(
        idempotencyKey,
        'payment.create_session',
        requestHash,
      );

      if (idempotencyResult.alreadyCompleted) {
        logger.info('Returning cached payment session', { idempotencyKey, quote_id });
        return idempotencyResult.response as CreatePaymentSessionResponse;
      }

      try {
        // 2. Validate quote is active and not expired
        const quote = await queryOne<{
          id: string;
          package_id: string;
          final_amount: number;
          currency: string;
          valid_until: string;
          status: string;
        }>(
          `SELECT id, package_id, final_amount, currency, valid_until, status
           FROM quotes WHERE id = $1`,
          [quote_id],
        );

        if (!quote) {
          throw new NotFoundError(`Quote ${quote_id} not found`);
        }

        if (quote.status !== 'ACTIVE') {
          throw new ValidationError(`Quote ${quote_id} is not active (status: ${quote.status})`);
        }

        const now = new Date();
        const validUntil = new Date(quote.valid_until);
        if (now > validUntil) {
          throw new ValidationError(`Quote ${quote_id} has expired`);
        }

        const existingPayment = await queryOne<{
          id: string;
          provider_ref: string | null;
          status: string;
        }>(
          `SELECT id, provider_ref, status FROM payments
           WHERE quote_id = $1 AND status = 'PENDING'
           ORDER BY created_at DESC LIMIT 1`,
          [quote_id],
        );

        if (existingPayment) {
          const response: CreatePaymentSessionResponse = {
            checkout_url: buildCheckoutUrlForPayment(existingPayment.id, existingPayment.provider_ref),
            payment_id: existingPayment.id,
            return_url: buildPaymentReturnUrl(existingPayment.id),
          };
          await idempotencyService.complete(idempotencyKey, response);
          logger.info('Reusing existing pending payment session', {
            payment_id: existingPayment.id,
            quote_id,
          });
          return response;
        }

        // 3. Create payment record in a transaction
        const paymentId = await transaction(async (client) => {
          const result = await client.query<{ id: string }>(
            `INSERT INTO payments (quote_id, provider, amount, status)
             VALUES ($1, $2, $3, 'PENDING')
             RETURNING id`,
            [quote_id, PAYMENT_PROVIDER, quote.final_amount],
          );
          return result.rows[0].id;
        });

        // 4. Call payment provider API to generate checkout URL
        const providerResult = await callPaymentProviderAPI({
          amount: Number(quote.final_amount),
          currency: quote.currency,
          quote_id,
          payment_id: paymentId,
        });

        // 5. Update payment with provider reference
        await query(
          `UPDATE payments SET provider_ref = $1 WHERE id = $2`,
          [providerResult.provider_ref, paymentId],
        );

        // 6. Trigger state machine transition: QUOTE_GENERATED → PAYMENT_PENDING
        // Find or create a booking-like tracking record for the state machine.
        // At this stage, the booking doesn't exist yet. We track the state via
        // a conceptual booking that will be formalized after payment success.
        // For now, we create a booking record in PAYMENT_PENDING state.
        const booking = await queryOne<{ id: string; status: string }>(
          `SELECT id, status FROM bookings WHERE quote_id = $1`,
          [quote_id],
        );

        if (!booking) {
          // Create a booking record to track state
          // Prefer the injected callback to keep booking table writes centralized
          if (createPaymentTrackingBooking) {
            await createPaymentTrackingBooking(quote_id);
          } else {
            await transaction(async (client) => {
              const bookingResult = await client.query<{ id: string }>(
                `INSERT INTO bookings (quote_id, status)
                 VALUES ($1, 'PAYMENT_PENDING')
                 RETURNING id`,
                [quote_id],
              );
              const bookingId = bookingResult.rows[0].id;

              await client.query(
                `INSERT INTO booking_events (booking_id, event, created_at)
                 VALUES ($1, $2, NOW())`,
                  [bookingId, JSON.stringify({ from: 'Draft' satisfies BookingState, to: 'Requested' satisfies BookingState, trigger: 'checkout_initiated' })],
              );
            });
          }
        } else if (booking.status === 'Draft' || booking.status === 'Requested') {
          // Transition existing booking
          await stateMachine.transition(
            booking.id,
            booking.status as BookingState,
            'Requested' as BookingState,
            'checkout_initiated',
          );
        }

        // 7. Complete idempotency
        const response: CreatePaymentSessionResponse = {
          checkout_url: providerResult.checkout_url,
          payment_id: paymentId,
          return_url: buildPaymentReturnUrl(paymentId),
        };
        await idempotencyService.complete(idempotencyKey, response);

        await logAudit('system', 'payment.session_created', 'payment', paymentId, {
          quote_id,
          provider: PAYMENT_PROVIDER,
          amount: quote.final_amount,
        });

        logger.info('Payment session created', {
          payment_id: paymentId,
          quote_id,
          checkout_url: providerResult.checkout_url,
        });

        return response;
      } catch (error) {
        await idempotencyService.fail(idempotencyKey);
        throw error;
      }
    },

    async processWebhook(
      signature: string,
      payload: PaymentWebhookPayload,
      idempotencyKey: string,
    ): Promise<void> {
      // 1. Validate webhook signature
      if (!this.validateSignature(signature, payload)) {
        throw new ValidationError('Invalid webhook signature');
      }

      // 2. Check idempotency
      const requestHash = JSON.stringify(payload);
      const idempotencyResult = await idempotencyService.start(
        idempotencyKey,
        'payment.process_webhook',
        requestHash,
      );

      if (idempotencyResult.alreadyCompleted) {
        logger.info('Webhook already processed', { idempotencyKey });
        return;
      }

      try {
        const { payment_id, status, provider_ref } = payload;

        // 3. Find the payment record
        const payment = await queryOne<Payment>(
          `SELECT id, quote_id, provider, provider_ref, amount, status, created_at
           FROM payments WHERE id = $1`,
          [payment_id],
        );

        if (!payment) {
          throw new NotFoundError(`Payment ${payment_id} not found`);
        }

        if (payment.status === 'PAID' || payment.status === 'FAILED') {
          logger.info('Payment already settled, skipping duplicate webhook', {
            payment_id,
            status: payment.status,
          });
          await idempotencyService.complete(idempotencyKey, { status: payment.status });
          return;
        }

        // 4. Determine new payment status
        const newStatus = status === 'paid' ? 'PAID' : 'FAILED';

        // 5. Update payment status and insert payment event in a transaction
        await transaction(async (client) => {
          // Update payment status
          await client.query(
            `UPDATE payments SET status = $1, provider_ref = COALESCE($2, provider_ref) WHERE id = $3`,
            [newStatus, provider_ref, payment_id],
          );

          // Insert payment event with full provider payload
          await client.query(
            `INSERT INTO payment_events (payment_id, payload)
             VALUES ($1, $2)`,
            [payment_id, JSON.stringify(payload)],
          );
        });

        // 6. Trigger state machine transition
        const booking = await queryOne<{ id: string; status: string }>(
          `SELECT id, status FROM bookings WHERE quote_id = $1`,
          [payment.quote_id],
        );

        if (booking && booking.status === 'Requested') {
          if (newStatus === 'PAID') {
            await stateMachine.transition(
              booking.id,
              'Requested' as BookingState,
              'Paid' as BookingState,
              'webhook_success',
            );

            // Auto-create booking on PAYMENT_PAID via injected callback
            if (createBooking) {
              try {
                const bookingIdempotencyKey = `booking_from_payment_${payment_id}`;
                await createBooking(payment.quote_id, bookingIdempotencyKey);
                logger.info('Auto-created booking from payment webhook', {
                  payment_id,
                  quote_id: payment.quote_id,
                });
              } catch (bookingError) {
                // Log but don't fail the webhook — booking creation can be retried
                logger.error('Failed to auto-create booking from webhook', {
                  payment_id,
                  quote_id: payment.quote_id,
                  error: (bookingError as Error).message,
                });
              }
            }
          } else {
            await stateMachine.transition(
              booking.id,
              'Requested' as BookingState,
              'Failed' as BookingState,
              'webhook_failure',
            );
          }
        }

        // 7. Complete idempotency
        await idempotencyService.complete(idempotencyKey, { status: newStatus });

        await logAudit('system', `payment.webhook.${newStatus.toLowerCase()}`, 'payment', payment_id, {
          quote_id: payment.quote_id,
          provider_ref,
          webhook_status: status,
        });

        // Record payment metric for observability
        const metrics = getMetricsService();
        metrics.recordPaymentEvent(newStatus === 'PAID' ? 'PAID' : 'FAILED');
        metrics.recordWebhookEvent(true);

        logger.info('Webhook processed', {
          payment_id,
          new_status: newStatus,
          provider_ref,
        });
      } catch (error) {
        await idempotencyService.fail(idempotencyKey);
        throw error;
      }
    },

    async completeMockPayment(paymentId: string, status: 'paid' | 'failed'): Promise<void> {
      if (!isPaymentMockMode()) {
        throw new ValidationError('Mock payment completion is only available when PAYMENT_MODE=mock');
      }

      const payload: PaymentWebhookPayload = {
        event: 'mock.payment.completed',
        payment_id: paymentId,
        provider_ref: `mock_${paymentId}`,
        status,
      };
      const secret = getMockWebhookSecret();
      const signature = computeHmacSignature(payload, secret);
      await this.processWebhook(signature, payload, `mock_complete_${paymentId}_${status}`);
    },

    async getPayment(paymentId: string): Promise<PaymentStatusResponse> {
      const payment = await queryOne<Payment>(
        `SELECT id, quote_id, provider, provider_ref, amount, status, created_at
         FROM payments WHERE id = $1`,
        [paymentId],
      );

      if (!payment) {
        throw new NotFoundError(`Payment ${paymentId} not found`);
      }

      return {
        ...payment,
        status: payment.status.toLowerCase(),
        payment_mode: isPaymentMockMode() ? 'mock' : 'live',
      };
    },

    validateSignature(signature: string, payload: unknown): boolean {
      if (isPaymentMockMode()) {
        try {
          const expected = computeHmacSignature(payload, getMockWebhookSecret());
          const sigBuffer = Buffer.from(signature, 'hex');
          const expectedBuffer = Buffer.from(expected, 'hex');
          if (sigBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
            return true;
          }
        } catch {
          // fall through to live secret check
        }
      }

      if (!PAYMENT_WEBHOOK_SECRET) {
        logger.error('PAYMENT_WEBHOOK_SECRET not configured — rejecting webhook for safety');
        return false;
      }

      try {
        const expected = computeHmacSignature(payload, PAYMENT_WEBHOOK_SECRET);
        // Guard against length mismatch which would cause timingSafeEqual to throw
        const sigBuffer = Buffer.from(signature, 'hex');
        const expectedBuffer = Buffer.from(expected, 'hex');
        if (sigBuffer.length !== expectedBuffer.length) {
          return false;
        }
        return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
      } catch {
        logger.warn('Webhook signature validation error', { signatureLength: signature.length });
        return false;
      }
    },
  };
}
