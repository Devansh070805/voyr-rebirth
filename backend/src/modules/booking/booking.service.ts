/**
 * Booking Service — State machine and post-payment confirmation.
 *
 * After payment succeeds, bookings move to BOOKING_CONFIRMED automatically
 * and document generation is enqueued (no manual admin approval step).
 */

import { query, queryOne, queryRows, transaction } from '../../db/index.js';
import { TRANSITION_TABLE } from '../../infra/state-machine.engine.js';
import type { BookingState } from '../../infra/state-machine.engine.js';
import {
  createIdempotencyService,
  createStateMachineEngine,
  createLogger,
  ValidationError,
  NotFoundError,
  getMetricsService,
} from '../../infra/index.js';
import { logAudit } from '../../infra/audit.service.js';

const logger = createLogger('booking-service');
const idempotencyService = createIdempotencyService();
const stateMachine = createStateMachineEngine();

const BS = Object.fromEntries(
  (Object.keys(TRANSITION_TABLE) as BookingState[]).map((k) => [k, k]),
) as Record<BookingState, BookingState>;

const POST_CONFIRM_STATES: BookingState[] = [
  BS.BOOKING_CONFIRMED,
  BS.DOCUMENTS_GENERATING,
  BS.DOCUMENTS_GENERATED,
  BS.CUSTOMER_NOTIFIED,
];

function toBS(s: string | undefined | null, field = 'status'): BookingState {
  if (!s) throw new NotFoundError(`Booking ${field} not found`);
  if (!TRANSITION_TABLE[s as BookingState]) {
    throw new ValidationError(`Invalid booking ${field}: "${s}"`);
  }
  return s as BookingState;
}

function isPostConfirmState(status: BookingState): boolean {
  return POST_CONFIRM_STATES.includes(status);
}

export interface Booking {
  id: string;
  quote_id: string;
  status: BookingState;
  created_at: string;
}

export interface BookingService {
  createBooking(quoteId: string, idempotencyKey: string): Promise<Booking>;
  createPaymentTrackingBooking(quoteId: string): Promise<{ id: string }>;
  getBooking(bookingId: string): Promise<Booking>;
}

export interface EnqueueDocumentGenerationCallback {
  (bookingId: string, idempotencyKey: string): Promise<void>;
}

async function createFulfillmentsForBooking(bookingId: string, quoteId: string): Promise<void> {
  try {
    const { createFulfillmentService } = await import('../fulfillment/fulfillment.service.js');
    await createFulfillmentService().createFromQuoteItems(bookingId, quoteId);
  } catch (fulErr) {
    logger.error('Failed to create booking fulfillments', {
      booking_id: bookingId,
      error: (fulErr as Error).message,
    });
  }
}

async function startDocumentGeneration(
  bookingId: string,
  enqueueDocumentGeneration?: EnqueueDocumentGenerationCallback,
): Promise<void> {
  await stateMachine.transition(
    bookingId,
    BS.BOOKING_CONFIRMED,
    BS.DOCUMENTS_GENERATING,
    'system_auto',
  );

  if (enqueueDocumentGeneration) {
    await enqueueDocumentGeneration(bookingId, `doc_gen_${bookingId}`);
  } else {
    await query(
      `INSERT INTO document_jobs (booking_id, status) VALUES ($1, 'QUEUED')`,
      [bookingId],
    );
  }
}

async function confirmBookingAfterPayment(
  bookingId: string,
  quoteId: string,
  currentStatus: BookingState,
  enqueueDocumentGeneration?: EnqueueDocumentGenerationCallback,
): Promise<Booking> {
  if (isPostConfirmState(currentStatus)) {
    const existing = await queryOne<Booking>(
      `SELECT id, quote_id, status, created_at FROM bookings WHERE id = $1`,
      [bookingId],
    );
    return existing!;
  }

  if (currentStatus === BS.BOOKING_PENDING_MANUAL_CONFIRMATION) {
    await stateMachine.transition(
      bookingId,
      BS.BOOKING_PENDING_MANUAL_CONFIRMATION,
      BS.BOOKING_CONFIRMED,
      'legacy_settle',
    );
  } else if (currentStatus === BS.PAYMENT_PAID) {
    await stateMachine.transition(
      bookingId,
      BS.PAYMENT_PAID,
      BS.BOOKING_CONFIRMED,
      'payment_confirmed',
    );
  } else {
    throw new ValidationError(
      `Cannot confirm booking ${bookingId} from status ${currentStatus}`,
    );
  }

  await snapshotQuoteItems(bookingId, quoteId);
  await createFulfillmentsForBooking(bookingId, quoteId);

  await logAudit('system', 'booking.confirmed', 'booking', bookingId, {
    previous_status: currentStatus,
    new_status: BS.BOOKING_CONFIRMED,
  });

  try {
    await startDocumentGeneration(bookingId, enqueueDocumentGeneration);
  } catch (docError) {
    logger.error('Failed to enqueue document generation', {
      booking_id: bookingId,
      error: (docError as Error).message,
    });
  }

  getMetricsService().recordBookingEvent('CONFIRMED');

  const updated = await queryOne<Booking>(
    `SELECT id, quote_id, status, created_at FROM bookings WHERE id = $1`,
    [bookingId],
  );
  return updated!;
}

export function createBookingService(
  enqueueDocumentGeneration?: EnqueueDocumentGenerationCallback,
): BookingService {
  return {
    async createBooking(quoteId: string, idempotencyKey: string): Promise<Booking> {
      const requestHash = JSON.stringify({ quoteId });
      const idempotencyResult = await idempotencyService.start(
        idempotencyKey,
        'booking.create',
        requestHash,
      );

      if (idempotencyResult.alreadyCompleted) {
        return idempotencyResult.response as Booking;
      }

      try {
        const quote = await queryOne<{ id: string }>(
          `SELECT id FROM quotes WHERE id = $1`,
          [quoteId],
        );
        if (!quote) {
          throw new NotFoundError(`Quote ${quoteId} not found`);
        }

        const payment = await queryOne<{ id: string; status: string }>(
          `SELECT id, status FROM payments WHERE quote_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [quoteId],
        );
        if (!payment || payment.status !== 'PAID') {
          throw new ValidationError(`Quote ${quoteId} does not have a completed payment`);
        }

        const existingBooking = await queryOne<{ id: string; status: string }>(
          `SELECT id, status FROM bookings WHERE quote_id = $1`,
          [quoteId],
        );

        if (existingBooking) {
          const status = toBS(existingBooking.status);
          if (status === BS.PAYMENT_PENDING) {
            throw new ValidationError(
              `Booking for quote ${quoteId} is still awaiting payment settlement`,
            );
          }

          const booking = await confirmBookingAfterPayment(
            existingBooking.id,
            quoteId,
            status,
            enqueueDocumentGeneration,
          );
          await idempotencyService.complete(idempotencyKey, booking);
          return booking;
        }

        const bookingId = await transaction(async (client) => {
          const bookingResult = await client.query<{ id: string }>(
            `INSERT INTO bookings (quote_id, status)
             VALUES ($1, 'BOOKING_CONFIRMED')
             RETURNING id`,
            [quoteId],
          );
          const newBookingId = bookingResult.rows[0].id;

          const quoteItemsResult = await client.query<{ service_snapshot: Record<string, unknown> }>(
            `SELECT service_snapshot FROM quote_items WHERE quote_id = $1`,
            [quoteId],
          );

          for (const item of quoteItemsResult.rows) {
            await client.query(
              `INSERT INTO booking_items (booking_id, snapshot) VALUES ($1, $2)`,
              [newBookingId, JSON.stringify(item.service_snapshot)],
            );
          }

          await client.query(
            `INSERT INTO booking_events (booking_id, event, created_at)
             VALUES ($1, $2, NOW())`,
            [
              newBookingId,
              JSON.stringify({
                from: BS.PAYMENT_PAID,
                to: BS.BOOKING_CONFIRMED,
                trigger: 'payment_confirmed',
              }),
            ],
          );

          return newBookingId;
        });

        await createFulfillmentsForBooking(bookingId, quoteId);

        try {
          await startDocumentGeneration(bookingId, enqueueDocumentGeneration);
        } catch (docError) {
          logger.error('Failed to enqueue document generation', {
            booking_id: bookingId,
            error: (docError as Error).message,
          });
        }

        const booking = await queryOne<Booking>(
          `SELECT id, quote_id, status, created_at FROM bookings WHERE id = $1`,
          [bookingId],
        );

        await idempotencyService.complete(idempotencyKey, booking);
        await logAudit('system', 'booking.created', 'booking', bookingId, {
          quote_id: quoteId,
          status: booking!.status,
        });
        getMetricsService().recordBookingEvent('CONFIRMED');

        return booking!;
      } catch (error) {
        await idempotencyService.fail(idempotencyKey);
        throw error;
      }
    },

    async getBooking(bookingId: string): Promise<Booking> {
      const booking = await queryOne<Booking>(
        `SELECT id, quote_id, status, created_at FROM bookings WHERE id = $1`,
        [bookingId],
      );
      if (!booking) {
        throw new NotFoundError(`Booking ${bookingId} not found`);
      }
      return booking;
    },

    async createPaymentTrackingBooking(quoteId: string): Promise<{ id: string }> {
      return transaction(async (client) => {
        const result = await client.query<{ id: string }>(
          `INSERT INTO bookings (quote_id, status)
           VALUES ($1, 'PAYMENT_PENDING')
           RETURNING id`,
          [quoteId],
        );
        const bookingId = result.rows[0].id;

        await client.query(
          `INSERT INTO booking_events (booking_id, event, created_at)
           VALUES ($1, $2, NOW())`,
          [
            bookingId,
            JSON.stringify({
              from: BS.QUOTE_GENERATED,
              to: BS.PAYMENT_PENDING,
              trigger: 'checkout_initiated',
            }),
          ],
        );

        return { id: bookingId };
      });
    },
  };
}

async function snapshotQuoteItems(bookingId: string, quoteId: string): Promise<void> {
  const existingItems = await queryRows<{ id: string }>(
    `SELECT id FROM booking_items WHERE booking_id = $1`,
    [bookingId],
  );
  if (existingItems.length > 0) {
    return;
  }

  const quoteItems = await queryRows<{ service_snapshot: Record<string, unknown> }>(
    `SELECT service_snapshot FROM quote_items WHERE quote_id = $1`,
    [quoteId],
  );

  await transaction(async (client) => {
    for (const item of quoteItems) {
      await client.query(
        `INSERT INTO booking_items (booking_id, snapshot) VALUES ($1, $2)`,
        [bookingId, JSON.stringify(item.service_snapshot)],
      );
    }
  });
}
