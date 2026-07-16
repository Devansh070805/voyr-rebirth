import type { MigrationBuilder } from 'node-pg-migrate';

/**
 * Migration 015: Configurable broker margins by provider, segment, and destination.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('provider_margin_rules', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    provider: { type: 'text', notNull: true },
    listing_type: { type: 'text' },
    destination_slug: { type: 'text' },
    customer_segment: { type: 'text', notNull: true, default: "'all'" },
    margin_type: { type: 'text', notNull: true, default: "'percent'" },
    margin_value: { type: 'numeric', notNull: true, default: 0 },
    min_margin_amount: { type: 'numeric' },
    is_active: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('provider_margin_rules', ['provider', 'customer_segment', 'is_active']);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('provider_margin_rules');
}
