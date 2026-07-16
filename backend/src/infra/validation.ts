/**
 * Shared Validation Helpers — Used across all route files.
 *
 * Consolidates validation functions previously duplicated in every routes file.
 */

import { ValidationError } from './error-handler.js';

/**
 * Require a non-empty string value.
 */
export function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${field} is required and must be a non-empty string`);
  }
  return value.trim();
}

/**
 * Require a numeric value.
 */
export function requireNumber(value: unknown, field: string): number {
  const num = Number(value);
  if (isNaN(num)) {
    throw new ValidationError(`${field} is required and must be a number`);
  }
  return num;
}

/**
 * Require a positive number.
 */
export function requirePositiveNumber(value: unknown, field: string): number {
  const num = requireNumber(value, field);
  if (num <= 0) {
    throw new ValidationError(`${field} must be a positive number`);
  }
  return num;
}

/**
 * Require a positive integer.
 */
export function requirePositiveInt(value: unknown, field: string): number {
  const num = requireNumber(value, field);
  if (!Number.isInteger(num) || num <= 0) {
    throw new ValidationError(`${field} must be a positive integer`);
  }
  return num;
}

/**
 * Require a date string in YYYY-MM-DD format.
 */
export function requireDate(value: unknown, field: string): string {
  const str = requireString(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    throw new ValidationError(`${field} must be a valid date in YYYY-MM-DD format`);
  }
  return str;
}

/**
 * Require a boolean value.
 */
export function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new ValidationError(`${field} is required and must be a boolean`);
  }
  return value;
}

/**
 * Require an idempotency key from request headers.
 */
export function requireIdempotencyKey(headers: Record<string, unknown>): string {
  const key = (headers['x-idempotency-key'] || headers['idempotency-key']) as string | undefined;
  if (typeof key !== 'string' || key.trim().length === 0) {
    throw new ValidationError('Idempotency-Key header is required');
  }
  return key.trim();
}
