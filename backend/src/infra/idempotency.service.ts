/**
 * Idempotency Service.
 * Ensures critical operations (payment, booking, document generation, notifications)
 * produce the same result when retried with the same idempotency key.
 *
 * Uses the `idempotency_keys` table:
 *   key TEXT PK, operation TEXT, request_hash TEXT, response JSONB,
 *   status TEXT ('in_progress' | 'completed' | 'failed'), created_at TIMESTAMPTZ
 */

import { query, queryOne } from '../db/index.js';
import { ConflictError } from './error-handler.js';
import { createLogger } from './logger.js';

const logger = createLogger('idempotency');

export interface IdempotencyRecord {
  key: string;
  operation: string;
  request_hash: string;
  response: unknown;
  status: 'in_progress' | 'completed' | 'failed';
  created_at: Date;
}

export interface IdempotencyService {
  /**
   * Check if an idempotency key already exists.
   * Returns the record if found, null otherwise.
   */
  check(key: string): Promise<IdempotencyRecord | null>;

  /**
   * Start a new idempotent operation.
   * Inserts a row with status 'in_progress'.
   * Throws ConflictError if the key already exists with 'in_progress' status.
   * Returns the stored response if the key already exists with 'completed' status.
   */
  start(key: string, operation: string, requestHash: string): Promise<{ alreadyCompleted: boolean; response?: unknown }>;

  /**
   * Mark an operation as completed and store the response.
   */
  complete(key: string, response: unknown): Promise<void>;

  /**
   * Mark an operation as failed.
   */
  fail(key: string): Promise<void>;
}

/**
 * Creates the idempotency service backed by PostgreSQL.
 */
export function createIdempotencyService(): IdempotencyService {
  return {
    async check(key: string): Promise<IdempotencyRecord | null> {
      const row = await queryOne<IdempotencyRecord>(
        `SELECT key, operation, request_hash, response, status, created_at
         FROM idempotency_keys
         WHERE key = $1`,
        [key],
      );
      return row;
    },

    async start(
      key: string,
      operation: string,
      requestHash: string,
    ): Promise<{ alreadyCompleted: boolean; response?: unknown }> {
      // Atomic upsert: INSERT ... ON CONFLICT to avoid race conditions
      // between concurrent requests with the same idempotency key.
      const inserted = await queryOne<IdempotencyRecord>(
        `INSERT INTO idempotency_keys (key, operation, request_hash, status)
         VALUES ($1, $2, $3, 'in_progress')
         ON CONFLICT (key) DO NOTHING
         RETURNING key, operation, request_hash, response, status, created_at`,
        [key, operation, requestHash],
      );

      if (inserted) {
        // Successfully inserted — this is a new operation
        logger.info('Started idempotent operation', { key, operation });
        return { alreadyCompleted: false };
      }

      // Key already exists — check its status
      const existing = await queryOne<IdempotencyRecord>(
        `SELECT key, operation, request_hash, response, status
         FROM idempotency_keys
         WHERE key = $1`,
        [key],
      );

      if (!existing) {
        // Extremely unlikely: row was deleted between INSERT and SELECT
        logger.warn('Idempotency key disappeared between insert and select', { key });
        throw new ConflictError(`Operation "${operation}" with key "${key}" encountered a race condition`);
      }

      if (existing.status === 'completed') {
        logger.info('Idempotency key already completed, returning stored response', { key, operation });
        return { alreadyCompleted: true, response: existing.response };
      }

      if (existing.status === 'in_progress') {
        logger.warn('Idempotency key in progress, returning 409', { key, operation });
        throw new ConflictError(`Operation "${operation}" with key "${key}" is already in progress`);
      }

      // If status is 'failed', allow retry by updating to in_progress
      await query(
        `UPDATE idempotency_keys
         SET status = 'in_progress', request_hash = $2, operation = $3
         WHERE key = $1 AND status = 'failed'`,
        [key, requestHash, operation],
      );
      logger.info('Retrying previously failed idempotent operation', { key, operation });
      return { alreadyCompleted: false };
    },

    async complete(key: string, response: unknown): Promise<void> {
      await query(
        `UPDATE idempotency_keys
         SET status = 'completed', response = $2
         WHERE key = $1`,
        [key, JSON.stringify(response)],
      );
      logger.info('Completed idempotent operation', { key });
    },

    async fail(key: string): Promise<void> {
      await query(
        `UPDATE idempotency_keys
         SET status = 'failed'
         WHERE key = $1`,
        [key],
      );
      logger.warn('Failed idempotent operation', { key });
    },
  };
}
