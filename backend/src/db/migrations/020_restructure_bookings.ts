import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns('bookings', {
    account_type: { type: 'varchar' },
    parent_account_ref: { type: 'uuid' },
    traveler_ref: { type: 'uuid' },
    booking_type: { type: 'varchar' },
    source_provider: { type: 'varchar' },
    destination: { type: 'varchar' },
    travel_start_date: { type: 'date' },
    travel_end_date: { type: 'date' },
  });

  pgm.alterColumn('bookings', 'status', { default: 'Draft' });

  // Map existing statuses to new enforced statuses
  pgm.sql(`
    UPDATE bookings SET status = 'Draft' WHERE status IN ('DRAFT_PACKAGE', 'QUOTE_GENERATED', 'QUOTE_EXPIRED');
    UPDATE bookings SET status = 'Requested' WHERE status IN ('BOOKING_PENDING_MANUAL_CONFIRMATION', 'SUPPLIER_CONFIRMATION_PENDING', 'PAYMENT_PENDING');
    UPDATE bookings SET status = 'Confirmed' WHERE status IN ('BOOKING_CONFIRMED');
    UPDATE bookings SET status = 'Paid' WHERE status IN ('PAYMENT_PAID');
    UPDATE bookings SET status = 'Ticketed/booked' WHERE status IN ('DOCUMENTS_GENERATING', 'DOCUMENTS_GENERATED', 'CUSTOMER_NOTIFIED');
    UPDATE bookings SET status = 'Cancelled' WHERE status IN ('CANCEL_REQUESTED', 'CANCELLED');
    UPDATE bookings SET status = 'Refunded' WHERE status IN ('REFUND_PENDING', 'REFUNDED');
    UPDATE bookings SET status = 'Failed' WHERE status IN ('PAYMENT_FAILED', 'FAILED');
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.alterColumn('bookings', 'status', { default: 'BOOKING_PENDING_MANUAL_CONFIRMATION' });
  pgm.dropColumns('bookings', [
    'account_type',
    'parent_account_ref',
    'traveler_ref',
    'booking_type',
    'source_provider',
    'destination',
    'travel_start_date',
    'travel_end_date',
  ]);
}
