import type { Request, Response, NextFunction } from 'express';
import { redisClient } from './redis.js';
import { createLogger } from './logger.js';

const logger = createLogger('rate-limit');

export function createRateLimiter(limit: number, windowSeconds: number) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = (req.headers['x-client-ip'] as string) || req.ip || 'unknown';
    const userId = (req.headers['x-user-id'] as string) || 'unauthenticated';

    const ipKey = `rate_limit:ip:${ip}`;
    const userKey = `rate_limit:user:${userId}`;

    try {
      if (!redisClient.isReady) {
        logger.warn('Redis not ready, skipping rate limit');
        return next();
      }

      const multi = redisClient.multi();
      multi.incr(ipKey);
      multi.expire(ipKey, windowSeconds, 'NX');
      multi.incr(userKey);
      multi.expire(userKey, windowSeconds, 'NX');

      const results = await multi.exec();
      
      const ipCount = Number(results[0]) || 0;
      const userCount = Number(results[2]) || 0;

      if (ipCount > limit || userCount > limit) {
        res.status(429).json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Too Many Requests: Rate limit exceeded (Max ${limit} per ${windowSeconds}s).`,
            statusCode: 429,
          }
        });
        return;
      }

      next();
    } catch (err) {
      logger.error('Rate limit error', { error: (err as Error).message });
      // Fail open
      next();
    }
  };
}
