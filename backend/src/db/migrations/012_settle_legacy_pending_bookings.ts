import type { MigrationBuilder } from 'node-pg-migrate';

/**
 * Bookings no longer stop at BOOKING_PENDING_MANUAL_CONFIRMATION.
 * Move any legacy rows to BOOKING_CONFIRMED so ops queues stay accurate.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.sql(`
    UPDATE bookings
    SET status = 'BOOKING_CONFIRMED'
    WHERE status = 'BOOKING_PENDING_MANUAL_CONFIRMATION'
  `);
}

export async function down(_pgm: MigrationBuilder): Promise<void> {
  // Irreversible data migration — legacy pending rows are not restored.
}
