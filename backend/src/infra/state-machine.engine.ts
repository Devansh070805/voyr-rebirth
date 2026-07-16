/**
 * State Machine Engine for the Booking Lifecycle.
 * Encodes the full 17-state transition table and enforces that all state
 * changes go through validated transitions.
 *
 * On each transition:
 *   1. Validates the transition against the table
 *   2. Updates bookings.status in the database
 *   3. Inserts a booking_events row
 *   4. Inserts an audit_logs row
 */

import { transaction } from '../db/index.js';
import { InvalidTransitionError } from './error-handler.js';
import { logAudit } from './audit.service.js';
import { createLogger } from './logger.js';

const logger = createLogger('state-machine');


export type BookingState =
  | 'DRAFT_PACKAGE'
  | 'QUOTE_GENERATED'
  | 'QUOTE_EXPIRED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_PAID'
  | 'BOOKING_PENDING_MANUAL_CONFIRMATION'
  | 'SUPPLIER_CONFIRMATION_PENDING'
  | 'BOOKING_CONFIRMED'
  | 'DOCUMENTS_GENERATING'
  | 'DOCUMENTS_GENERATED'
  | 'CUSTOMER_NOTIFIED'
  | 'CANCEL_REQUESTED'
  | 'CANCELLED'
  | 'REFUND_PENDING'
  | 'REFUNDED'
  | 'FAILED';

interface TransitionTarget {
  to: BookingState;
  trigger: string;
}


export const TRANSITION_TABLE: Record<BookingState, TransitionTarget[]> = {
  DRAFT_PACKAGE: [
    { to: 'QUOTE_GENERATED', trigger: 'quote_created' },
  ],
  QUOTE_GENERATED: [
    { to: 'QUOTE_EXPIRED', trigger: 'expiry_check' },
    { to: 'PAYMENT_PENDING', trigger: 'checkout_initiated' },
  ],
  QUOTE_EXPIRED: [],
  PAYMENT_PENDING: [
    { to: 'PAYMENT_PAID', trigger: 'webhook_success' },
    { to: 'PAYMENT_FAILED', trigger: 'webhook_failure' },
  ],
  PAYMENT_FAILED: [],
  PAYMENT_PAID: [
    { to: 'BOOKING_CONFIRMED', trigger: 'payment_confirmed' },
  ],
  /** @deprecated Legacy rows only — settled via migration / legacy_settle */
  BOOKING_PENDING_MANUAL_CONFIRMATION: [
    { to: 'BOOKING_CONFIRMED', trigger: 'legacy_settle' },
  ],
  SUPPLIER_CONFIRMATION_PENDING: [
    { to: 'BOOKING_CONFIRMED', trigger: 'supplier_confirm' },
  ],
  BOOKING_CONFIRMED: [
    { to: 'DOCUMENTS_GENERATING', trigger: 'system_auto' },
  ],
  DOCUMENTS_GENERATING: [
    { to: 'DOCUMENTS_GENERATED', trigger: 'worker_complete' },
    { to: 'FAILED', trigger: 'max_retries_exceeded' },
  ],
  DOCUMENTS_GENERATED: [
    { to: 'CUSTOMER_NOTIFIED', trigger: 'notification_sent' },
  ],
  CUSTOMER_NOTIFIED: [],
  CANCEL_REQUESTED: [
    { to: 'CANCELLED', trigger: 'cancellation_processed' },
    { to: 'REFUND_PENDING', trigger: 'refund_initiated' },
  ],
  CANCELLED: [],
  REFUND_PENDING: [
    { to: 'REFUNDED', trigger: 'refund_completed' },
  ],
  REFUNDED: [],
  FAILED: [],
};


// ─── Pure state machine (no I/O, testable without a database) ────────────

export interface StateMachineEngine {
  /**
   * Attempt a state transition. Validates against the transition table,
   * updates the database, and logs the event.
   * Throws InvalidTransitionError if the transition is not allowed.
   */
  transition(
    bookingId: string,
    fromState: BookingState,
    toState: BookingState,
    trigger: string,
    metadata?: Record<string, unknown>,
  ): Promise<BookingState>;

  /**
   * Returns all valid next states from the current state.
   */
  validTransitions(currentState: BookingState): TransitionTarget[];

  /**
   * Validates whether a transition from → to is allowed.
   */
  isValidTransition(from: BookingState, to: BookingState): boolean;
}


/**
 * Create a pure state machine — validates transitions without I/O.
 * Ideal for unit tests that don't need a database.
 */
export function createStateMachine() {
  return {
    validTransitions(currentState: BookingState): TransitionTarget[] {
      return TRANSITION_TABLE[currentState] ?? [];
    },

    isValidTransition(from: BookingState, to: BookingState): boolean {
      const allowed = TRANSITION_TABLE[from];
      return allowed?.some((t) => t.to === to) ?? false;
    },

    /**
     * Validate a transition and return the matching target.
     * Throws InvalidTransitionError if not allowed.
     */
    validateTransition(fromState: BookingState, toState: BookingState): TransitionTarget {
      const allowed = TRANSITION_TABLE[fromState];
      const match = allowed?.find((t) => t.to === toState);
      if (!match) {
        throw new InvalidTransitionError(fromState, toState);
      }
      return match;
    },
  };
}


/**
 * Create a persistent state machine — wraps the pure machine with database writes.
 */
export function createStateMachineEngine(): StateMachineEngine {
  const pure = createStateMachine();

  return {
    async transition(
      bookingId: string,
      fromState: BookingState,
      toState: BookingState,
      trigger: string,
      metadata?: Record<string, unknown>,
    ): Promise<BookingState> {
      // 1. Validate the transition (pure, no I/O)
      pure.validateTransition(fromState, toState);

      // 2. Execute within a transaction: update status + insert event
      await transaction(async (client) => {
        // Update booking status (with optimistic lock on current state)
        const updateResult = await client.query(
          `UPDATE bookings
           SET status = $1
           WHERE id = $2 AND status = $3`,
          [toState, bookingId, fromState],
        );

        if (updateResult.rowCount === 0) {
          throw new InvalidTransitionError(fromState, toState);
        }

        // Insert booking event
        await client.query(
          `INSERT INTO booking_events (booking_id, event, created_at)
           VALUES ($1, $2, NOW())`,
          [bookingId, JSON.stringify({ from: fromState, to: toState, trigger, ...metadata })],
        );
      });

      // 3. Insert audit log (outside transaction — non-critical)
      await logAudit(
        'system',
        `booking.transition.${trigger}`,
        'booking',
        bookingId,
        { from: fromState, to: toState, trigger, ...metadata },
      );

      logger.info('State transition completed', { bookingId, fromState, toState, trigger, ...metadata });
      return toState;
    },

    validTransitions(currentState: BookingState): TransitionTarget[] {
      return pure.validTransitions(currentState);
    },

    isValidTransition(from: BookingState, to: BookingState): boolean {
      return pure.isValidTransition(from, to);
    },
  };
}
