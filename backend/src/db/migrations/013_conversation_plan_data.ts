import type { MigrationBuilder } from 'node-pg-migrate';

/**
 * Migration 013: Persist structured trip plan on conversations.
 * Stores live API snapshots, user selections, and planning metadata.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn('conversations', {
    plan_data: { type: 'jsonb', notNull: true, default: '{}' },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn('conversations', 'plan_data');
}
