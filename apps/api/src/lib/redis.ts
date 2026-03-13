import Redis from 'ioredis';
import { logger } from './logger';

if (!process.env.REDIS_URL) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: REDIS_URL is required in production. Set REDIS_URL to your Redis instance URL.');
  }
  console.warn('[redis] WARNING: REDIS_URL is not set, falling back to redis://localhost:6379. Set REDIS_URL in production.');
}
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(redisUrl);

redis.on('connect', () => {
  console.info('[redis] connected');
});

redis.on('error', (err) => {
  logger.error('[redis] error:', err);
});
