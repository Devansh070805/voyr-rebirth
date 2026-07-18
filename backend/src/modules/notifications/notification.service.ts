/**
 * Notification Service — Email delivery for booking documents.
 * Triggered when a booking reaches DOCUMENTS_GENERATED.
 */

import { queryOne, queryRows } from '../../db/index.js';
import {
  createIdempotencyService,
  createLogger,
  NotFoundError,
  ValidationError,
  withRetry,
  RETRY_EXTERNAL_API,
  isHttpRetryable,
} from '../../infra/index.js';
import { getResendFromAddress, logResendFailure } from '../../infra/resend.js';
import { logAudit } from '../../infra/audit.service.js';

const logger = createLogger('notification-service');
const idempotencyService = createIdempotencyService();



export interface NotificationService {
  sendBookingDocuments(bookingId: string, userId: string, idempotencyKey: string): Promise<void>;
  sendEmail(to: string, subject: string, body: string, attachments: string[]): Promise<void>;
}

export interface EmailClient {
  send(options: EmailOptions): Promise<{ success: boolean }>;
}

export interface EmailOptions {
  from: string;
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; url: string }[];
}


function createDefaultEmailClient(): EmailClient {
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromAddress = getResendFromAddress();

  return {
    async send(options: EmailOptions): Promise<{ success: boolean }> {
      if (process.env.NODE_ENV === 'test') {
        return { success: true };
      }

      if (!resendApiKey) {
        if (process.env.NODE_ENV === 'production') {
          throw new Error('RESEND_API_KEY is required in production');
        }
        logger.info('[DEV] Email skipped (RESEND not configured)', {
          to: options.to,
          subject: options.subject,
          attachments: options.attachments?.length ?? 0,
        });
        return { success: true };
      }

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: options.from || fromAddress,
          to: [options.to],
          subject: options.subject,
          html: options.html,
        }),
      });

      if (!response.ok) {
        throw await logResendFailure(logger, response, { to: options.to, context: 'notification' });
      }

      return { success: true };
    },
  };
}


export function createNotificationService(emailClient?: EmailClient): NotificationService {
  const email = emailClient || createDefaultEmailClient();
  const fromAddress = getResendFromAddress();

  return {
    /**
     * Send booking documents to the user via email.
     *
     * Flow:
     * 1. Check idempotency to prevent duplicate sends
     * 2. Validate booking exists and is in DOCUMENTS_GENERATED state
     * 3. Fetch user email
     * 4. Fetch document URLs for the booking
     * 5. Send email with document links (retry up to 3 times)
     * 6. Transition booking to CUSTOMER_NOTIFIED
     * 7. Complete idempotency record
     */
    async sendBookingDocuments(
      bookingId: string,
      userId: string,
      idempotencyKey: string,
    ): Promise<void> {
      // 1. Check idempotency
      const requestHash = JSON.stringify({ bookingId, userId });
      const idempotencyResult = await idempotencyService.start(
        idempotencyKey,
        'notification.send_booking_documents',
        requestHash,
      );

      if (idempotencyResult.alreadyCompleted) {
        logger.info('Notification already sent', { idempotencyKey, bookingId, userId });
        return;
      }

      try {
        // 2. Validate booking exists and is in correct state
        const booking = await queryOne<{ id: string; status: string; quote_id: string }>(
          `SELECT id, status, quote_id FROM bookings WHERE id = $1`,
          [bookingId],
        );

        if (!booking) {
          throw new NotFoundError(`Booking ${bookingId} not found`);
        }

        if (booking.status !== 'Ticketed/booked') {
          throw new ValidationError(
            `Booking ${bookingId} is in state ${booking.status}, expected Ticketed/booked`,
          );
        }

        // 3. Fetch user email
        const user = await queryOne<{ id: string; email: string }>(
          `SELECT id, email FROM users WHERE id = $1`,
          [userId],
        );

        if (!user) {
          throw new NotFoundError(`User ${userId} not found`);
        }

        // 4. Fetch document URLs
        const documents = await queryRows<{
          id: string;
          type: string;
          file_url: string;
          status: string;
        }>(
          `SELECT id, type, file_url, status
           FROM documents
           WHERE booking_id = $1 AND status = 'GENERATED'
           ORDER BY type`,
          [bookingId],
        );

        if (documents.length === 0) {
          throw new ValidationError(
            `No generated documents found for booking ${bookingId}`,
          );
        }

        // 5. Build email content
        const documentLinks = documents
          .map((doc) => `<li><a href="${doc.file_url}">${formatDocumentType(doc.type)}</a></li>`)
          .join('\n');

        const subject = `Your Voyr Travel Documents Are Ready`;
        const htmlBody = `
          <h2>Your Travel Documents</h2>
          <p>Great news! Your booking documents are ready for download.</p>
          <p><strong>Booking ID:</strong> ${bookingId}</p>
          <h3>Documents:</h3>
          <ul>
            ${documentLinks}
          </ul>
          <p>Please download and review your documents before your trip.</p>
          <p>If you have any questions, our support team is available 24/7.</p>
          <br/>
          <p>Happy travels!</p>
          <p>— The Voyr Team</p>
        `;

        const attachments = documents.map((doc) => ({
          filename: `${doc.type}-${bookingId.slice(0, 8)}.pdf`,
          url: doc.file_url,
        }));

        // 6. Send email with retry (up to 3 attempts with exponential backoff)
        const emailResult = await withRetry(
          () => email.send({
            from: fromAddress,
            to: user.email,
            subject,
            html: htmlBody,
            attachments,
          }),
          {
            ...RETRY_EXTERNAL_API,
            operationName: 'notification-email',
            isRetryable: isHttpRetryable,
            onRetry: (attempt, err, delayMs) => {
              logger.warn('Email send attempt failed, retrying', {
                bookingId,
                userId,
                attempt,
                nextRetryMs: delayMs,
                error: (err as Error).message,
              });
            },
          },
        );

        if (!emailResult.success) {
          throw new Error(
            `Failed to send notification email after ${RETRY_EXTERNAL_API.maxAttempts} attempts: ${emailResult.error?.message}`,
          );
        }

        logger.info('Notification email sent', {
          bookingId,
          userId,
          email: user.email,
          attempts: emailResult.attempts,
        });

        // 7. Transition booking (Removed in new 8-state model)

        // 8. Complete idempotency
        await idempotencyService.complete(idempotencyKey, {
          bookingId,
          userId,
          email: user.email,
          documentsCount: documents.length,
        });

        // 9. Audit log
        await logAudit('system', 'notification.documents_sent', 'booking', bookingId, {
          user_id: userId,
          email: user.email,
          documents: documents.map((d) => ({ type: d.type, url: d.file_url })),
        });

        logger.info('Booking notification completed', { bookingId, userId });
      } catch (error) {
        await idempotencyService.fail(idempotencyKey);
        throw error;
      }
    },

    /**
     * Generic email sending method.
     * Sends an email with optional attachment URLs.
     * Retries up to 3 times with exponential backoff using centralized retry utility.
     */
    async sendEmail(
      to: string,
      subject: string,
      body: string,
      attachments: string[],
    ): Promise<void> {
      const attachmentObjects = attachments.map((url, index) => ({
        filename: `attachment-${index + 1}.pdf`,
        url,
      }));

      const result = await withRetry(
        () => email.send({
          from: fromAddress,
          to,
          subject,
          html: body,
          attachments: attachmentObjects,
        }),
        {
          ...RETRY_EXTERNAL_API,
          operationName: 'send-email',
          isRetryable: isHttpRetryable,
          onRetry: (attempt, err, delayMs) => {
            logger.warn('Email send attempt failed, retrying', {
              to,
              subject,
              attempt,
              nextRetryMs: delayMs,
              error: (err as Error).message,
            });
          },
        },
      );

      if (!result.success) {
        throw new Error(
          `Failed to send email after ${RETRY_EXTERNAL_API.maxAttempts} attempts: ${result.error?.message}`,
        );
      }

      logger.info('Email sent', { to, subject, attempts: result.attempts });
    },
  };
}


/**
 * Format document type for display in email.
 */
function formatDocumentType(type: string): string {
  switch (type) {
    case 'invoice':
      return 'Invoice';
    case 'itinerary':
      return 'Travel Itinerary';
    case 'voucher':
      return 'Travel Vouchers';
    default:
      return type.charAt(0).toUpperCase() + type.slice(1);
  }
}
