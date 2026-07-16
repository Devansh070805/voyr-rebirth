import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Alter users table
  pgm.addColumns('users', {
    google_id: { type: 'text', unique: true },
    auth_provider: { type: 'text', default: 'otp' },
    display_name: { type: 'text' },
    avatar_url: { type: 'text' }
  });

  // Create refresh_tokens table
  pgm.createTable('refresh_tokens', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { type: 'uuid', references: 'users(id)', onDelete: 'CASCADE' },
    token_hash: { type: 'text', unique: true, notNull: true },
    expires_at: { type: 'timestamptz', notNull: true },
    created_at: { type: 'timestamptz', default: pgm.func('now()') },
    revoked_at: { type: 'timestamptz' }
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('refresh_tokens');
  pgm.dropColumns('users', ['google_id', 'auth_provider', 'display_name', 'avatar_url']);
}
