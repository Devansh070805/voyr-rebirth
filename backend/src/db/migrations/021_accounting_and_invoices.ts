import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  // 1. Accounting Analytics on Bookings
  pgm.addColumns('bookings', {
    base_fare: { type: 'numeric' },
    total_taxes: { type: 'numeric' },
    gst_amount: { type: 'numeric' },
    platform_fees: { type: 'numeric' },
    operator_margin: { type: 'numeric' },
  });

  // 2. Invoices Table
  pgm.createTable('invoices', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    booking_id: { type: 'uuid', notNull: true, references: 'bookings(id)' },
    serial_number: { type: 'text', notNull: true, unique: true },
    issuer: { type: 'jsonb', notNull: true }, // e.g. { name, address, tax_id }
    receiver: { type: 'jsonb', notNull: true }, // e.g. { name, address, tax_id }
    payment_status: { type: 'text', notNull: true, default: "'UNPAID'" }, // UNPAID, PARTIAL, PAID
    settlement_status: { type: 'text', notNull: true, default: "'UNSETTLED'" }, // UNSETTLED, PENDING, SETTLED
    is_international: { type: 'boolean', notNull: true, default: false },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('invoices');
  pgm.dropColumns('bookings', [
    'base_fare',
    'total_taxes',
    'gst_amount',
    'platform_fees',
    'operator_margin'
  ]);
}
