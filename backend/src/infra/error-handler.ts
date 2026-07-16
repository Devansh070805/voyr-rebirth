/**
 * Express error handling middleware.
 * Catches errors, logs them with the structured logger, and returns
 * standardized JSON error responses.
 */

import type { Request, Response, NextFunction } from 'express';
import { createLogger } from './logger.js';

const logger = createLogger('error-handler');

/**
 * Base application error with HTTP status code.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, code: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * 409 Conflict — used by idempotency service when an operation is in progress.
 */
export class ConflictError extends AppError {
  constructor(message = 'Operation already in progress') {
    super(message, 409, 'CONFLICT');
  }
}

/**
 * 400 Bad Request — validation errors.
 */
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

/**
 * 404 Not Found.
 */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

/**
 * 401 Unauthorized.
 */
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

/**
 * 403 Forbidden — authenticated but not permitted.
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

/**
 * Invalid state transition error — used by the state machine engine.
 */
export class InvalidTransitionError extends AppError {
  public readonly fromState: string;
  public readonly toState: string;

  constructor(fromState: string, toState: string) {
    super(
      `Invalid transition from ${fromState} to ${toState}`,
      422,
      'INVALID_TRANSITION',
    );
    this.fromState = fromState;
    this.toState = toState;
  }
}

/**
 * Standardized error response shape.
 */
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    statusCode: number;
  };
}

/**
 * Express error handling middleware.
 * Must be registered after all routes.
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = (req.headers['x-request-id'] as string) || 'unknown';

  if (err instanceof AppError) {
    logger.withRequestId(requestId).warn(err.message, {
      code: err.code,
      statusCode: err.statusCode,
      path: req.path,
      method: req.method,
    });

    const response: ErrorResponse = {
      error: {
        code: err.code,
        message: err.message,
        statusCode: err.statusCode,
      },
    };

    res.status(err.statusCode).json(response);
    return;
  }

  // Unexpected errors — log stack in non-production only
  logger.withRequestId(requestId).error('Unhandled error', {
    error: err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    path: req.path,
    method: req.method,
  });

  const response: ErrorResponse = {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      statusCode: 500,
    },
  };

  res.status(500).json(response);
}
