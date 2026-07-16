import type { MigrationBuilder } from 'node-pg-migrate';

/**
 * Migration 007: Conversations and conversation messages.
 *
 * Adds persistent conversation storage so chat history survives page reloads.
 * Each conversation is scoped to a user and optionally linked to a package.
 * Messages store role, content, and any tool call data as JSONB.
 */

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('conversations', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { type: 'uuid', notNull: true, references: 'users(id)' },
    package_id: { type: 'uuid', references: 'packages(id)' },
    title: { type: 'text', notNull: true, default: "'New Trip'" },
    destination: { type: 'text' },
    status: { type: 'text', notNull: true, default: "'active'" },
    share_token: { type: 'text', unique: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('conversations', 'user_id');
  pgm.createIndex('conversations', 'share_token');

  pgm.createTable('conversation_messages', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    conversation_id: { type: 'uuid', notNull: true, references: 'conversations(id)', onDelete: 'CASCADE' },
    role: { type: 'text', notNull: true },
    content: { type: 'text', notNull: true, default: "''" },
    tool_calls: { type: 'jsonb' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('conversation_messages', 'conversation_id');

  // Auto-update updated_at on conversations when messages are inserted
  pgm.sql(`
    CREATE OR REPLACE FUNCTION update_conversation_timestamp()
    RETURNS TRIGGER AS $$
    BEGIN
      UPDATE conversations SET updated_at = now() WHERE id = NEW.conversation_id;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  pgm.sql(`
    CREATE TRIGGER trg_update_conversation_timestamp
    AFTER INSERT ON conversation_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_timestamp();
  `);
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.sql('DROP TRIGGER IF EXISTS trg_update_conversation_timestamp ON conversation_messages');
  pgm.sql('DROP FUNCTION IF EXISTS update_conversation_timestamp()');
  pgm.dropTable('conversation_messages');
  pgm.dropTable('conversations');
}
