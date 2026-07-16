import type { MigrationBuilder } from 'node-pg-migrate';

/**
 * Migration 016: Broker fulfillment ledger — tracks supply-side obligations per booking line.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('booking_fulfillments', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    booking_id: { type: 'uuid', notNull: true, references: 'bookings(id)', onDelete: 'CASCADE' },
    quote_item_id: { type: 'uuid', references: 'quote_items(id)', onDelete: 'SET NULL' },
    supply_source: { type: 'text', notNull: true },
    supply_product: { type: 'text', notNull: true },
    curated_listing_id: { type: 'uuid', references: 'curated_listings(id)', onDelete: 'SET NULL' },
    cost_amount: { type: 'numeric', notNull: true, default: 0 },
    sell_amount: { type: 'numeric', notNull: true, default: 0 },
    margin_amount: { type: 'numeric', notNull: true, default: 0 },
    currency: { type: 'text', notNull: true, default: "'USD'" },
    margin_rule_id: { type: 'uuid', references: 'provider_margin_rules(id)', onDelete: 'SET NULL' },
    customer_segment: { type: 'text', notNull: true, default: "'b2c'" },
    provider_search_ref: { type: 'text' },
    provider_booking_ref: { type: 'text' },
    fulfillment_status: { type: 'text', notNull: true, default: "'pending_provider'" },
    settlement_status: { type: 'text', notNull: true, default: "'unpaid'" },
    payload: { type: 'jsonb', notNull: true, default: '{}' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('booking_fulfillments', ['booking_id']);
  pgm.createIndex('booking_fulfillments', ['fulfillment_status', 'supply_source']);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('booking_fulfillments');
}
