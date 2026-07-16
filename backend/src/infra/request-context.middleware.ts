/**
 * Request Context Middleware — Propagates x-request-id from the gateway
 * into an AsyncLocalStorage context so all loggers within a request
 * can include the request ID automatically.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import type { Request, Response, NextFunction } from 'express';

export interface RequestContext {
  requestId: string;
  userId?: string;
}

export const requestContextStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Express middleware that extracts x-request-id and x-user-id from headers
 * and stores them in AsyncLocalStorage for the duration of the request.
 */
export function requestContextMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const context: RequestContext = {
    requestId: (req.headers['x-request-id'] as string) || 'no-request-id',
    userId: req.headers['x-user-id'] as string | undefined,
  };

  requestContextStorage.run(context, () => next());
}

/**
 * Get the current request context (if within a request).
 */
export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}
