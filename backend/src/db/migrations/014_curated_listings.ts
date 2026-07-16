import type { MigrationBuilder } from 'node-pg-migrate';

/**
 * Migration 014: Admin-curated travel listings for chat priority and broker sales.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('curated_listings', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    listing_type: { type: 'text', notNull: true },
    title: { type: 'text', notNull: true },
    description: { type: 'text' },
    destination_slug: { type: 'text', notNull: true },
    country: { type: 'text' },
    city: { type: 'text' },
    payload: { type: 'jsonb', notNull: true, default: '{}' },
    cost_price: { type: 'numeric', notNull: true, default: 0 },
    sell_price: { type: 'numeric', notNull: true, default: 0 },
    currency: { type: 'text', notNull: true, default: "'USD'" },
    priority: { type: 'integer', notNull: true, default: 0 },
    is_active: { type: 'boolean', notNull: true, default: true },
    valid_from: { type: 'timestamptz' },
    valid_to: { type: 'timestamptz' },
    created_by: { type: 'text' },
    inventory_option_id: { type: 'uuid', references: 'service_options(id)', onDelete: 'SET NULL' },
    fulfillment_mode: { type: 'text', notNull: true, default: "'manual'" },
    metadata: { type: 'jsonb', notNull: true, default: '{}' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('curated_listings', ['destination_slug', 'listing_type', 'is_active']);
  pgm.createIndex('curated_listings', [{ name: 'priority', sort: 'DESC' }]);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('curated_listings');
}
