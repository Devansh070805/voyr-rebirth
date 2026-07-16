/**
 * Property-based test for the Idempotency Service.
 *
 * Property 1: Idempotence — invoking the same operation twice with the same
 * key produces the same response.
 *
 * Validates: Requirement 13.5
 *
 * Strategy: We use an in-memory store to simulate the idempotency_keys table,
 * mock the database module, and verify that for any arbitrary key, operation,
 * requestHash, and response payload, calling start() → complete() → start()
 * again with the same key always returns the stored response without
 * re-executing the operation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import type { IdempotencyRecord } from './idempotency.service.js';

/**
 * Custom arbitrary that generates JSON-safe values.
 * JSON.stringify(-0) === "0", so JSON.parse(JSON.stringify(-0)) === 0 (positive zero).
 * We use fc.jsonValue() but filter out -0 values to avoid false negatives
 * caused by JavaScript's JSON serialization semantics (not a service bug).
 */
function jsonSafeValue(): fc.Arbitrary<unknown> {
  return fc.jsonValue().map((v) => JSON.parse(JSON.stringify(v)));
}

// In-memory store simulating the idempotency_keys table
let store: Map<string, IdempotencyRecord>;

// Mock the database module before importing the service
vi.mock('../db/index.js', () => {
  return {
    query: vi.fn(async (text: string, params?: unknown[]) => {
      const sql = text.trim().toUpperCase();

      if (sql.startsWith('UPDATE IDEMPOTENCY_KEYS')) {
        const key = params![0] as string;
        const existing = store.get(key);
        if (!existing) return { rows: [], rowCount: 0 };

        if (sql.includes("STATUS = 'COMPLETED'")) {
          existing.status = 'completed';
          existing.response = JSON.parse(params![1] as string);
        } else if (sql.includes("STATUS = 'FAILED'")) {
          existing.status = 'failed';
        } else if (sql.includes("STATUS = 'IN_PROGRESS'")) {
          existing.status = 'in_progress';
          existing.request_hash = params![1] as string;
          existing.operation = params![2] as string;
        }
        return { rows: [], rowCount: 1 };
      }

      return { rows: [], rowCount: 0 };
    }),
    queryOne: vi.fn(async (text: string, params?: unknown[]) => {
      const sql = text.trim().toUpperCase();
      const key = params![0] as string;

      // Handle the atomic INSERT ... ON CONFLICT DO NOTHING RETURNING ...
      if (sql.startsWith('INSERT INTO IDEMPOTENCY_KEYS') && sql.includes('ON CONFLICT')) {
        if (store.has(key)) {
          // Key already exists — ON CONFLICT DO NOTHING returns no rows
          return null;
        }
        const [, operation, requestHash] = params as string[];
        const record: IdempotencyRecord = {
          key,
          operation,
          request_hash: requestHash,
          response: null,
          status: 'in_progress',
          created_at: new Date(),
        };
        store.set(key, record);
        return record;
      }

      // Handle SELECT queries
      return store.get(key) ?? null;
    }),
  };
});

// Import after mocking
const { createIdempotencyService } = await import('./idempotency.service.js');

describe('Idempotency Service — Property-Based Tests', () => {
  beforeEach(() => {
    store = new Map();
  });

  it('Property 1: invoking the same operation twice with the same key produces the same response', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Arbitrary idempotency key (non-empty string)
        fc.string({ minLength: 1, maxLength: 64 }),
        // Arbitrary operation name
        fc.string({ minLength: 1, maxLength: 32 }),
        // Arbitrary request hash
        fc.string({ minLength: 1, maxLength: 64 }),
        // Arbitrary response payload (JSON-serializable, survives JSON round-trip)
        jsonSafeValue(),
        async (key, operation, requestHash, responsePayload) => {
          // Reset store for each property run
          store.clear();

          const service = createIdempotencyService();

          // First invocation: start the operation
          const firstStart = await service.start(key, operation, requestHash);
          expect(firstStart.alreadyCompleted).toBe(false);

          // Complete the operation with the response
          await service.complete(key, responsePayload);

          // Second invocation with the same key: should return stored response
          const secondStart = await service.start(key, operation, requestHash);
          expect(secondStart.alreadyCompleted).toBe(true);

          // The returned response must be deeply equal to the original
          expect(secondStart.response).toEqual(responsePayload);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('Property 1b: multiple repeated invocations all return the same stored response', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 64 }),
        fc.string({ minLength: 1, maxLength: 32 }),
        fc.string({ minLength: 1, maxLength: 64 }),
        jsonSafeValue(),
        // Number of repeated calls (2 to 10)
        fc.integer({ min: 2, max: 10 }),
        async (key, operation, requestHash, responsePayload, repeatCount) => {
          store.clear();

          const service = createIdempotencyService();

          // First invocation and completion
          await service.start(key, operation, requestHash);
          await service.complete(key, responsePayload);

          // Repeated invocations should all return the same response
          for (let i = 0; i < repeatCount; i++) {
            const result = await service.start(key, operation, requestHash);
            expect(result.alreadyCompleted).toBe(true);
            expect(result.response).toEqual(responsePayload);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property 1c: in-progress key throws ConflictError on second invocation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 64 }),
        fc.string({ minLength: 1, maxLength: 32 }),
        fc.string({ minLength: 1, maxLength: 64 }),
        async (key, operation, requestHash) => {
          store.clear();

          const service = createIdempotencyService();

          // Start the operation (now in_progress)
          await service.start(key, operation, requestHash);

          // Second invocation while in_progress should throw ConflictError
          await expect(
            service.start(key, operation, requestHash),
          ).rejects.toThrow('already in progress');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Property 1d: failed key allows retry and subsequent completion is idempotent', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 64 }),
        fc.string({ minLength: 1, maxLength: 32 }),
        fc.string({ minLength: 1, maxLength: 64 }),
        jsonSafeValue(),
        async (key, operation, requestHash, responsePayload) => {
          store.clear();

          const service = createIdempotencyService();

          // Start and fail the operation
          await service.start(key, operation, requestHash);
          await service.fail(key);

          // Retry should be allowed (not throw)
          const retryResult = await service.start(key, operation, requestHash);
          expect(retryResult.alreadyCompleted).toBe(false);

          // Complete the retry
          await service.complete(key, responsePayload);

          // Subsequent calls should return the stored response
          const finalResult = await service.start(key, operation, requestHash);
          expect(finalResult.alreadyCompleted).toBe(true);
          expect(finalResult.response).toEqual(responsePayload);
        },
      ),
      { numRuns: 100 },
    );
  });
});
