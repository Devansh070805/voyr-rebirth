import type { MigrationBuilder } from 'node-pg-migrate';

/**
 * Migration 017: Cross-conversation travel profile for broker-grade continuity.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('user_travel_profiles', {
    user_id: { type: 'uuid', primaryKey: true, references: 'users(id)', onDelete: 'CASCADE' },
    customer_segment: { type: 'text', notNull: true, default: "'b2c'" },
    home_airport: { type: 'text' },
    passport_country: { type: 'text' },
    default_currency: { type: 'text', default: "'USD'" },
    travel_style: { type: 'text' },
    dietary_notes: { type: 'text' },
    mobility_notes: { type: 'text' },
    party_default: { type: 'jsonb', notNull: true, default: '{"adults":2,"children":0}' },
    learned_preferences: { type: 'jsonb', notNull: true, default: '{}' },
    last_destinations: { type: 'jsonb', notNull: true, default: '[]' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addColumn('conversations', {
    rolling_summary: { type: 'text' },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn('conversations', 'rolling_summary');
  pgm.dropTable('user_travel_profiles');
}
