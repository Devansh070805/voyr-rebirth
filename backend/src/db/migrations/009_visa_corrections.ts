import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('visa_corrections', {
    id: { type: 'serial', primaryKey: true },
    passport_country: { type: 'char(2)', notNull: true },
    destination_country: { type: 'char(2)', notNull: true },
    field: { type: 'text', notNull: true },
    current_value: { type: 'text' },
    suggested_value: { type: 'text', notNull: true },
    notes: { type: 'text' },
    status: { type: 'text', notNull: true, default: "'pending'" },
    admin_notes: { type: 'text' },
    reviewed_by: { type: 'text' },
    reviewed_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('visa_corrections', 'passport_country');
  pgm.createIndex('visa_corrections', 'status');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('visa_corrections');
}
