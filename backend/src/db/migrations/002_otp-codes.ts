/**
 * Migration: Create otp_codes table for storing hashed OTPs with expiry.
 * This table supports the Auth module's email OTP login flow.
 */

import type { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable('otp_codes', {
    email: {
      type: 'text',
      primaryKey: true,
      notNull: true,
    },
    otp_hash: {
      type: 'text',
      notNull: true,
    },
    expires_at: {
      type: 'timestamp with time zone',
      notNull: true,
    },
    attempts: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('now()'),
    },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable('otp_codes');
}
