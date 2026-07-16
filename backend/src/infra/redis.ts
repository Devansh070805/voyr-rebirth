import { createClient } from 'redis';
import { createLogger } from './logger.js';

const logger = createLogger('redis');

export const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
});

const isRedisRequired = process.env.NODE_ENV === 'production' || process.env.REDIS_REQUIRED === 'true';

redisClient.on('error', (err) => {
  if (isRedisRequired) {
    logger.error('Redis Client Error', { error: err.message });
  }
});

let isConnected = false;

export async function connectRedis() {
  if (!isRedisRequired) {
    logger.info('Running without Redis (cache & rate limits disabled)');
    return;
  }

  if (!isConnected) {
    try {
      await redisClient.connect();
      isConnected = true;
      logger.info('Connected to Redis');
    } catch (err) {
      logger.error('Failed to connect to Redis', { error: (err as Error).message });
      throw err;
    }
  }
}
