/**
 * Tests for the retry utility and dead-letter queue consumer.
 */

import { describe, it, expect, vi } from 'vitest';
import { withRetry, withRetryOrThrow, isHttpRetryable } from './retry.js';
import type { RetryOptions } from './retry.js';

// Use minimal delays for tests
const TEST_RETRY_OPTIONS: Partial<RetryOptions> = {
  maxAttempts: 3,
  baseDelayMs: 10,
  maxDelayMs: 100,
  jitter: false,
  operationName: 'test-operation',
};

describe('withRetry', () => {
  it('should return success on first attempt when operation succeeds', async () => {
    const fn = vi.fn().mockResolvedValue('result');

    const result = await withRetry(fn, TEST_RETRY_OPTIONS);

    expect(result.success).toBe(true);
    expect(result.result).toBe('result');
    expect(result.attempts).toBe(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and succeed on subsequent attempt', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('transient error'))
      .mockResolvedValue('success');

    const result = await withRetry(fn, TEST_RETRY_OPTIONS);

    expect(result.success).toBe(true);
    expect(result.result).toBe('success');
    expect(result.attempts).toBe(2);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should exhaust all retries and return failure', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('persistent error'));

    const result = await withRetry(fn, TEST_RETRY_OPTIONS);

    expect(result.success).toBe(false);
    expect(result.error?.message).toBe('persistent error');
    expect(result.attempts).toBe(3);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should respect maxAttempts configuration', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    const result = await withRetry(fn, { ...TEST_RETRY_OPTIONS, maxAttempts: 5 });

    expect(result.attempts).toBe(5);
    expect(fn).toHaveBeenCalledTimes(5);
  });

  it('should not retry non-retryable errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('400 Bad Request'));

    const result = await withRetry(fn, {
      ...TEST_RETRY_OPTIONS,
      isRetryable: (err) => {
        const msg = (err as Error).message;
        return !msg.includes('400');
      },
    });

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should call onRetry callback before each retry', async () => {
    const onRetry = vi.fn();
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('error 1'))
      .mockRejectedValueOnce(new Error('error 2'))
      .mockResolvedValue('ok');

    await withRetry(fn, { ...TEST_RETRY_OPTIONS, onRetry });

    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), expect.any(Number));
    expect(onRetry).toHaveBeenCalledWith(2, expect.any(Error), expect.any(Number));
  });

  it('should apply exponential backoff delays', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');

    const delays: number[] = [];
    const onRetry = (_attempt: number, _err: unknown, delayMs: number) => {
      delays.push(delayMs);
    };

    await withRetry(fn, {
      ...TEST_RETRY_OPTIONS,
      baseDelayMs: 100,
      maxDelayMs: 1000, // High cap so it doesn't interfere
      backoffMultiplier: 2,
      jitter: false,
      onRetry,
    });

    // First retry: 100 * 2^0 = 100ms
    expect(delays[0]).toBe(100);
    // Second retry: 100 * 2^1 = 200ms
    expect(delays[1]).toBe(200);
  });

  it('should cap delay at maxDelayMs', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');

    const delays: number[] = [];
    const onRetry = (_attempt: number, _err: unknown, delayMs: number) => {
      delays.push(delayMs);
    };

    await withRetry(fn, {
      maxAttempts: 5,
      baseDelayMs: 10,
      maxDelayMs: 50,
      backoffMultiplier: 2,
      jitter: false,
      onRetry,
    });

    // All delays should be <= maxDelayMs
    for (const delay of delays) {
      expect(delay).toBeLessThanOrEqual(50);
    }
  });
});

describe('withRetryOrThrow', () => {
  it('should return result on success', async () => {
    const fn = vi.fn().mockResolvedValue(42);

    const result = await withRetryOrThrow(fn, TEST_RETRY_OPTIONS);

    expect(result).toBe(42);
  });

  it('should throw on final failure', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('permanent failure'));

    await expect(
      withRetryOrThrow(fn, TEST_RETRY_OPTIONS),
    ).rejects.toThrow('permanent failure');
  });
});

describe('isHttpRetryable', () => {
  it('should return true for 5xx errors', () => {
    expect(isHttpRetryable(new Error('Server error 500'))).toBe(true);
    expect(isHttpRetryable(new Error('502 Bad Gateway'))).toBe(true);
    expect(isHttpRetryable(new Error('503 Service Unavailable'))).toBe(true);
  });

  it('should return true for 429 rate limit', () => {
    expect(isHttpRetryable(new Error('429 Too Many Requests'))).toBe(true);
  });

  it('should return false for 4xx client errors (except 429)', () => {
    expect(isHttpRetryable(new Error('400 Bad Request'))).toBe(false);
    expect(isHttpRetryable(new Error('401 Unauthorized'))).toBe(false);
    expect(isHttpRetryable(new Error('404 Not Found'))).toBe(false);
    expect(isHttpRetryable(new Error('422 Unprocessable Entity'))).toBe(false);
  });

  it('should return true for network errors', () => {
    expect(isHttpRetryable(new Error('ECONNREFUSED'))).toBe(true);
    expect(isHttpRetryable(new Error('ECONNRESET'))).toBe(true);
    expect(isHttpRetryable(new Error('ETIMEDOUT'))).toBe(true);
    expect(isHttpRetryable(new Error('socket hang up'))).toBe(true);
  });

  it('should return true for unknown errors (safe default)', () => {
    expect(isHttpRetryable(new Error('something unexpected'))).toBe(true);
    expect(isHttpRetryable('string error')).toBe(true);
  });
});
