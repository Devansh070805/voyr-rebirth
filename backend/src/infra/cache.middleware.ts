import type { Request, Response, NextFunction } from 'express';

/**
 * Middleware to add Cache-Control headers for static-ish data (e.g. visa, airports, destinations).
 * @param maxAgeSeconds Time in seconds to cache the response. Default is 24 hours.
 */
export function cacheMiddleware(maxAgeSeconds = 86400) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Only cache GET requests
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', `public, max-age=${maxAgeSeconds}, stale-while-revalidate=86400`);
    }
    next();
  };
}
