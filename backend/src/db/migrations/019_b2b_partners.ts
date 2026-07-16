import type { MigrationBuilder } from 'node-pg-migrate';

/**
 * Migration 019: B2B partner organizations and admin-managed member access.
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('b2b_partners', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    name: { type: 'text', notNull: true },
    company_code: { type: 'text', notNull: true, unique: true },
    contact_email: { type: 'text' },
    notes: { type: 'text' },
    status: { type: 'text', notNull: true, default: "'active'" },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createTable('b2b_partner_members', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    partner_id: { type: 'uuid', notNull: true, references: 'b2b_partners(id)', onDelete: 'CASCADE' },
    user_id: { type: 'uuid', references: 'users(id)', onDelete: 'SET NULL' },
    email: { type: 'text', notNull: true },
    status: { type: 'text', notNull: true, default: "'active'" },
    granted_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    revoked_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('b2b_partner_members', ['email']);
  pgm.createIndex('b2b_partner_members', ['user_id']);
  pgm.createIndex('b2b_partner_members', ['partner_id', 'status']);
  pgm.createIndex('b2b_partner_members', ['email', 'status']);
  pgm.createIndex('b2b_partner_members', ['partner_id', 'email'], { unique: true });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('b2b_partner_members');
  pgm.dropTable('b2b_partners');
}
