import type { Request, Response, NextFunction } from 'express';
import { createLogger } from './logger.js';

const logger = createLogger('admin-middleware');

function parseAllowlist(): { emails: Set<string>; userIds: Set<string> } {
  const emails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const userIds = (process.env.ADMIN_USER_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  return { emails: new Set(emails), userIds: new Set(userIds) };
}

/**
 * True when the authenticated user (via gateway headers) is in ADMIN_EMAILS or ADMIN_USER_IDS.
 * In non-production, if no allowlist is configured, any authenticated user may access admin routes.
 */
export function isAdminRequest(req: Request): boolean {
  const userId = ((req.headers['x-user-id'] as string) || '').trim();
  const email = ((req.headers['x-user-email'] as string) || '').trim().toLowerCase();

  if (!userId) {
    return false;
  }

  const { emails, userIds } = parseAllowlist();
  if (emails.size === 0 && userIds.size === 0) {
    return process.env.NODE_ENV !== 'production';
  }

  return userIds.has(userId) || (email.length > 0 && emails.has(email));
}

/**
 * Requires an authenticated admin user (JWT forwarded as x-user-id / x-user-email).
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (isAdminRequest(req)) {
    req.headers['x-admin-id'] = (req.headers['x-user-id'] as string) || 'admin';
    return next();
  }

  logger.warn('Admin access denied', {
    path: req.path,
    method: req.method,
    userId: req.headers['x-user-id'] as string,
    email: req.headers['x-user-email'] as string,
    requestId: req.headers['x-request-id'] as string,
  });
  res.status(403).json({
    error: {
      code: 'FORBIDDEN',
      message: 'Admin access required',
      statusCode: 403,
    },
  });
}
