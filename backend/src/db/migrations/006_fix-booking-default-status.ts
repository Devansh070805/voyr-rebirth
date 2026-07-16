import type { MigrationBuilder } from 'node-pg-migrate';

/**
 * Migration 006: Fix bookings table default status.
 *
 * The initial migration set the default booking status to
 * 'BOOKING_PENDING_MANUAL_CONFIRMATION', but bookings are first created
 * in 'PAYMENT_PENDING' state by the payment service. This migration
 * updates the default to match the actual first state in the payment flow.
 */

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.alterColumn('bookings', 'status', {
    default: "'PAYMENT_PENDING'",
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.alterColumn('bookings', 'status', {
    default: "'BOOKING_PENDING_MANUAL_CONFIRMATION'",
  });
}
