import Redis from 'ioredis';

if (!process.env.REDIS_URL) {
  console.warn('[redis] WARNING: REDIS_URL is not set, falling back to redis://localhost:6379. Set REDIS_URL in production.');
}
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(redisUrl);

redis.on('connect', () => {
  console.info('[redis] connected');
});

redis.on('error', (err) => {
  console.error('[redis] error:', err);
});
