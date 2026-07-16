import type { MigrationBuilder } from 'node-pg-migrate';

/**
 * Migration 004: Add destination, nights, and people columns to packages table.
 * These fields are required by the Package Module's CreatePackageRequest interface
 * to store trip details when a user creates a draft package.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumns('packages', {
    destination: { type: 'text', notNull: false },
    nights: { type: 'integer', notNull: false },
    people: { type: 'integer', notNull: false },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumns('packages', ['destination', 'nights', 'people']);
}
