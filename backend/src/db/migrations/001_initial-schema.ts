import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('users', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    email: { type: 'text', notNull: true, unique: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createTable('suppliers', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    name: { type: 'text', notNull: true },
    type: { type: 'text', notNull: true },
    metadata: { type: 'jsonb' },
  });

  pgm.createTable('locations', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    city: { type: 'text', notNull: true },
    country: { type: 'text', notNull: true },
    lat: { type: 'numeric', notNull: true },
    lng: { type: 'numeric', notNull: true },
  });

  pgm.createTable('services', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    supplier_id: { type: 'uuid', notNull: true, references: 'suppliers(id)' },
    location_id: { type: 'uuid', notNull: true, references: 'locations(id)' },
    type: { type: 'text', notNull: true },
    name: { type: 'text', notNull: true },
    metadata: { type: 'jsonb' },
  });

  pgm.createTable('service_options', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    service_id: { type: 'uuid', notNull: true, references: 'services(id)' },
    name: { type: 'text', notNull: true },
    capacity: { type: 'integer', notNull: true },
    metadata: { type: 'jsonb' },
  });

  pgm.createTable('service_prices', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    option_id: { type: 'uuid', notNull: true, references: 'service_options(id)' },
    price: { type: 'numeric', notNull: true },
    currency: { type: 'text', notNull: true },
    valid_from: { type: 'date', notNull: true },
    valid_to: { type: 'date', notNull: true },
  });

  pgm.createTable('service_availability', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    option_id: { type: 'uuid', notNull: true, references: 'service_options(id)' },
    date: { type: 'date', notNull: true },
    available: { type: 'boolean', notNull: true, default: true },
  });

  pgm.createTable('service_policies', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    service_id: { type: 'uuid', notNull: true, references: 'services(id)' },
    cancellation_policy: { type: 'text', notNull: true },
    refund_rules: { type: 'text', notNull: true },
  });

  pgm.createTable('packages', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { type: 'uuid', notNull: true, references: 'users(id)' },
    status: { type: 'text', notNull: true, default: "'DRAFT'" },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createTable('package_items', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    package_id: { type: 'uuid', notNull: true, references: 'packages(id)' },
    option_id: { type: 'uuid', notNull: true, references: 'service_options(id)' },
    quantity: { type: 'integer', notNull: true },
    selected_date: { type: 'date', notNull: true },
  });

  pgm.createTable('quotes', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    package_id: { type: 'uuid', notNull: true, references: 'packages(id)' },
    currency: { type: 'text', notNull: true },
    base_amount: { type: 'numeric', notNull: true },
    tax_amount: { type: 'numeric', notNull: true },
    markup_amount: { type: 'numeric', notNull: true },
    fee_amount: { type: 'numeric', notNull: true },
    discount_amount: { type: 'numeric', notNull: true },
    final_amount: { type: 'numeric', notNull: true },
    valid_until: { type: 'timestamptz', notNull: true },
    status: { type: 'text', notNull: true, default: "'ACTIVE'" },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createTable('quote_items', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    quote_id: { type: 'uuid', notNull: true, references: 'quotes(id)' },
    service_snapshot: { type: 'jsonb', notNull: true },
  });

  pgm.createTable('quote_events', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    quote_id: { type: 'uuid', notNull: true, references: 'quotes(id)' },
    event: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createTable('payments', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    quote_id: { type: 'uuid', notNull: true, references: 'quotes(id)' },
    provider: { type: 'text', notNull: true },
    provider_ref: { type: 'text' },
    amount: { type: 'numeric', notNull: true },
    status: { type: 'text', notNull: true, default: "'PENDING'" },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createTable('payment_events', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    payment_id: { type: 'uuid', notNull: true, references: 'payments(id)' },
    payload: { type: 'jsonb', notNull: true },
  });

  pgm.createTable('bookings', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    quote_id: { type: 'uuid', notNull: true, references: 'quotes(id)' },
    status: { type: 'text', notNull: true, default: "'BOOKING_PENDING_MANUAL_CONFIRMATION'" },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createTable('booking_items', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    booking_id: { type: 'uuid', notNull: true, references: 'bookings(id)' },
    snapshot: { type: 'jsonb', notNull: true },
  });

  pgm.createTable('booking_events', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    booking_id: { type: 'uuid', notNull: true, references: 'bookings(id)' },
    event: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createTable('documents', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    booking_id: { type: 'uuid', notNull: true, references: 'bookings(id)' },
    type: { type: 'text', notNull: true },
    file_url: { type: 'text' },
    status: { type: 'text', notNull: true, default: "'PENDING'" },
  });

  pgm.createTable('document_jobs', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    booking_id: { type: 'uuid', notNull: true, references: 'bookings(id)' },
    status: { type: 'text', notNull: true, default: "'QUEUED'" },
  });

  pgm.createTable('idempotency_keys', {
    key: { type: 'text', primaryKey: true },
    operation: { type: 'text', notNull: true },
    request_hash: { type: 'text', notNull: true },
    response: { type: 'jsonb' },
    status: { type: 'text', notNull: true, default: "'in_progress'" },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createTable('audit_logs', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    actor: { type: 'text', notNull: true },
    action: { type: 'text', notNull: true },
    entity: { type: 'text', notNull: true },
    entity_id: { type: 'uuid' },
    metadata: { type: 'jsonb' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.sql(`
    CREATE OR REPLACE FUNCTION prevent_quote_update()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'UPDATE operations are not allowed on the quotes table. Quotes are immutable.';
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER quotes_immutability_trigger
    BEFORE UPDATE ON quotes
    FOR EACH ROW
    EXECUTE FUNCTION prevent_quote_update();
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Drop trigger and function first
  pgm.sql('DROP TRIGGER IF EXISTS quotes_immutability_trigger ON quotes;');
  pgm.sql('DROP FUNCTION IF EXISTS prevent_quote_update();');

  // Drop tables in reverse dependency order
  pgm.dropTable('audit_logs');
  pgm.dropTable('idempotency_keys');
  pgm.dropTable('document_jobs');
  pgm.dropTable('documents');
  pgm.dropTable('booking_events');
  pgm.dropTable('booking_items');
  pgm.dropTable('bookings');
  pgm.dropTable('payment_events');
  pgm.dropTable('payments');
  pgm.dropTable('quote_events');
  pgm.dropTable('quote_items');
  pgm.dropTable('quotes');
  pgm.dropTable('package_items');
  pgm.dropTable('packages');
  pgm.dropTable('service_policies');
  pgm.dropTable('service_availability');
  pgm.dropTable('service_prices');
  pgm.dropTable('service_options');
  pgm.dropTable('services');
  pgm.dropTable('locations');
  pgm.dropTable('suppliers');
  pgm.dropTable('users');
}
