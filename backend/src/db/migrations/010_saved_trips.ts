import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('saved_trips', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { type: 'uuid', notNull: true, references: 'users(id)', onDelete: 'CASCADE' },
    conversation_id: { type: 'uuid', references: 'conversations(id)', onDelete: 'SET NULL' },
    item_type: { type: 'text', notNull: true },
    title: { type: 'text', notNull: true },
    location: { type: 'text', notNull: true },
    price: { type: 'text', notNull: true },
    image: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('saved_trips', 'user_id');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('saved_trips');
}
