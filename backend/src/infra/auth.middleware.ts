/**
 * Authentication Middleware — Validates that requests come through the gateway.
 *
 * The API gateway validates JWTs and forwards user identity via headers:
 *   x-user-id, x-user-email, x-request-id
 *
 * This middleware enforces that protected routes have a valid x-user-id header,
 * providing defense-in-depth in case the backend is accidentally exposed
 * without the gateway in front of it.
 *
 * Public routes (auth, webhooks, health) are excluded.
 */

import type { Request, Response, NextFunction } from 'express';
import { createLogger } from './logger.js';

const logger = createLogger('auth-middleware');

/**
 * Paths that do not require authentication.
 * These match the gateway's public endpoint list.
 */
const PUBLIC_PATHS = [
  '/health',
  '/metrics',
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/google',
  '/auth/logout',
];

/**
 * Path prefixes that do not require authentication.
 */
const PUBLIC_PREFIXES = [
  '/webhook/',
  '/hotels/',
];

function isPublicPath(path: string): boolean {
  if (PUBLIC_PATHS.includes(path)) return true;
  return PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/**
 * Express middleware that requires x-user-id on protected routes.
 * Should be registered after body parsing but before route handlers.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (isPublicPath(req.path)) {
    return next();
  }

  const userId = req.headers['x-user-id'] as string | undefined;

  if (!userId || userId.trim().length === 0) {
    logger.warn('Request missing x-user-id on protected route', {
      path: req.path,
      method: req.method,
      requestId: req.headers['x-request-id'] as string,
    });
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
        statusCode: 401,
      },
    });
    return;
  }

  next();
}
