/**
 * middleware/rateLimit.ts — Redis-backed sliding window rate limiters.
 *
 * Uses sorted sets in Redis to implement a sliding window counter.
 * Each request adds a timestamped entry; expired entries are pruned
 * on every check. The remaining count determines whether the request
 * is allowed.
 *
 * Exports three pre-configured middlewares:
 *   - authRateLimit     — 5 req/min per IP   (login, register)
 *   - apiRateLimit      — 60 req/min per user (authenticated API)
 *   - messageRateLimit  — 5 msg/5s per user+channel (message send)
 *
 * @module middleware/rateLimit
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';
import { redis } from '../lib/redis';

// ---------------------------------------------------------------------------
// In-memory fallback rate limiter (used when Redis is unavailable)
// ---------------------------------------------------------------------------

/**
 * Simple in-memory sliding window tracker. Not shared across processes, but
 * provides degraded protection when Redis is down rather than failing open.
 */
const memoryStore = new Map<string, number[]>();

/** Periodically prune stale keys to prevent unbounded memory growth. */
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of memoryStore) {
    const fresh = timestamps.filter(t => now - t < 120_000);
    if (fresh.length === 0) memoryStore.delete(key);
    else memoryStore.set(key, fresh);
  }
}, 60_000).unref();

/**
 * Check rate limit using the in-memory store. Returns true if the request
 * should be allowed, false if it exceeds the limit.
 */
function checkMemoryRateLimit(key: string, maxRequests: number, windowSeconds: number): boolean {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  let timestamps = memoryStore.get(key) ?? [];
  timestamps = timestamps.filter(t => now - t < windowMs);
  if (timestamps.length >= maxRequests) {
    memoryStore.set(key, timestamps);
    return false;
  }
  timestamps.push(now);
  memoryStore.set(key, timestamps);
  return true;
}

// ---------------------------------------------------------------------------
// Core sliding-window implementation
// ---------------------------------------------------------------------------

interface RateLimitConfig {
  /** Redis key prefix (e.g. "rl:auth"). */
  prefix: string;
  /** Maximum number of requests allowed within the window. */
  maxRequests: number;
  /** Window size in seconds. */
  windowSeconds: number;
  /** Function to derive the rate-limit key from the request. */
  keyFn: (req: Request) => string | null;
}

/**
 * Creates an Express middleware that enforces a sliding-window rate limit
 * backed by a Redis sorted set.
 *
 * Algorithm:
 *   1. Derive a key from the request (IP, userId, etc.).
 *   2. Remove sorted-set members older than `now - windowSeconds`.
 *   3. Count remaining members.
 *   4. If count >= maxRequests, respond 429 with `Retry-After`.
 *   5. Otherwise, add the current timestamp and allow.
 *
 * All Redis commands run inside a pipeline for atomicity and performance.
 */
export function createRateLimiter(config: RateLimitConfig) {
  const { prefix, maxRequests, windowSeconds, keyFn } = config;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const identifier = keyFn(req);

    // If we can't derive a key (e.g. no userId on an unauthenticated route),
    // let the request through — auth middleware will reject it anyway.
    if (!identifier) {
      next();
      return;
    }

    const key = `${prefix}:${identifier}`;
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    try {
      const pipeline = redis.pipeline();

      // 1. Remove entries outside the sliding window.
      pipeline.zremrangebyscore(key, 0, windowStart);

      // 2. Count remaining entries.
      pipeline.zcard(key);

      // 3. Add the current request (score = timestamp, member = unique id).
      pipeline.zadd(key, now, `${now}:${Math.random().toString(36).slice(2, 8)}`);

      // 4. Set TTL so the key self-cleans if the user stops making requests.
      pipeline.expire(key, windowSeconds + 1);

      const results = await pipeline.exec();

      // results[1] is the zcard result: [error, count]
      const count = (results?.[1]?.[1] as number) ?? 0;

      if (count >= maxRequests) {
        // Calculate when the oldest entry in the window will expire.
        const oldestEntries = await redis.zrange(key, 0, 0, 'WITHSCORES');
        const oldestTimestamp = oldestEntries.length >= 2 ? Number(oldestEntries[1]) : now;
        const retryAfterMs = (oldestTimestamp + windowSeconds * 1000) - now;
        const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));

        res.set('Retry-After', String(retryAfterSeconds));
        res.status(429).json({
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please try again later.',
          retryAfter: retryAfterSeconds,
        });
        return;
      }

      // Attach rate-limit info headers for client visibility.
      res.set('X-RateLimit-Limit', String(maxRequests));
      res.set('X-RateLimit-Remaining', String(maxRequests - count - 1));
      res.set('X-RateLimit-Reset', String(Math.ceil((now + windowSeconds * 1000) / 1000)));

      next();
    } catch (err) {
      // Redis is unreachable — fall back to in-memory rate limiting.
      logger.error(`[rateLimit] Redis error for key "${key}", using in-memory fallback:`, err);
      if (!checkMemoryRateLimit(key, maxRequests, windowSeconds)) {
        res.set('Retry-After', String(windowSeconds));
        res.status(429).json({
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please try again later.',
          retryAfter: windowSeconds,
        });
        return;
      }
      next();
    }
  };
}

// ---------------------------------------------------------------------------
// Pre-configured middlewares
// ---------------------------------------------------------------------------

/**
 * authRateLimit — 5 requests per 60 seconds, keyed by IP.
 * Apply to login / register endpoints to prevent brute-force attacks.
 */
export const authRateLimit = createRateLimiter({
  prefix: 'rl:auth',
  maxRequests: 5,
  windowSeconds: 60,
  keyFn: (req) => req.ip ?? req.socket.remoteAddress ?? null,
});

/**
 * apiRateLimit — 200 requests per 60 seconds, keyed by authenticated userId.
 * Apply globally to the API router (after auth middleware resolves userId).
 * Note: 60 was too low — page load alone can trigger 50+ requests when a user
 * is in multiple guilds (channels, roles, members, messages per guild).
 */
export const apiRateLimit = createRateLimiter({
  prefix: 'rl:api',
  maxRequests: 200,
  windowSeconds: 60,
  keyFn: (req) => req.userId ?? null,
});

/**
 * publicInviteRateLimit — 30 requests per 60 seconds, keyed by IP.
 * Apply to GET /invites/:code to prevent brute-force enumeration.
 */
export const publicInviteRateLimit = createRateLimiter({
  prefix: 'rl:invite',
  maxRequests: 30,
  windowSeconds: 60,
  keyFn: (req) => req.ip ?? req.socket.remoteAddress ?? null,
});

/**
 * publicFileRateLimit — 60 requests per 60 seconds, keyed by IP.
 * Apply to GET /files/:fileId to prevent bandwidth abuse.
 */
export const publicFileRateLimit = createRateLimiter({
  prefix: 'rl:file',
  maxRequests: 60,
  windowSeconds: 60,
  keyFn: (req) => req.ip ?? req.socket.remoteAddress ?? null,
});

/**
 * usernameCheckRateLimit — 10 requests per 60 seconds, keyed by IP.
 * Apply to GET /auth/username-available to prevent user enumeration.
 */
export const usernameCheckRateLimit = createRateLimiter({
  prefix: 'rl:uname',
  maxRequests: 10,
  windowSeconds: 60,
  keyFn: (req) => req.ip ?? req.socket.remoteAddress ?? null,
});

/**
 * globalIpRateLimit — 300 requests per 60 seconds, keyed by IP.
 * Applied before body parsing so large payloads are rejected before
 * the JSON parser processes them.
 */
export const globalIpRateLimit = createRateLimiter({
  prefix: 'rl:global',
  maxRequests: 600,
  windowSeconds: 60,
  keyFn: (req) => req.ip ?? req.socket.remoteAddress ?? null,
});

/**
 * messageRateLimit — 5 messages per 5 seconds, keyed by userId + channelId.
 * Apply to the POST /channels/:channelId/messages endpoint to prevent spam.
 */
export const messageRateLimit = createRateLimiter({
  prefix: 'rl:msg',
  maxRequests: 5,
  windowSeconds: 5,
  keyFn: (req) => {
    const userId = req.userId;
    const channelId = req.params.channelId;
    if (!userId || !channelId) return null;
    return `${userId}:${channelId}`;
  },
});

/**
 * emailVerifyRateLimit — 5 requests per hour, keyed by IP.
 * Apply to POST /verify-email/request and /verify-email/confirm.
 */
export const emailVerifyRateLimit = createRateLimiter({
  prefix: 'rl:emailverify',
  maxRequests: 5,
  windowSeconds: 3600,
  keyFn: (req) => req.ip ?? req.socket.remoteAddress ?? null,
});

/**
 * mfaSetupRateLimit — 10 requests per hour, keyed by userId.
 * Apply to MFA setup/enable endpoints.
 */
export const mfaSetupRateLimit = createRateLimiter({
  prefix: 'rl:mfasetup',
  maxRequests: 10,
  windowSeconds: 3600,
  keyFn: (req) => req.userId ?? null,
});

/**
 * searchRateLimit — 20 requests per 60 seconds, keyed by userId.
 * Apply to GET /search/messages to prevent abuse.
 */
export const searchRateLimit = createRateLimiter({
  prefix: 'rl:search',
  maxRequests: 20,
  windowSeconds: 60,
  keyFn: (req) => req.userId ?? null,
});

/**
 * botApiRateLimit — 30 requests per 60 seconds, keyed by botId.
 * Apply to bot-authenticated API endpoints.
 */
export const botApiRateLimit = createRateLimiter({
  prefix: 'rl:bot',
  maxRequests: 30,
  windowSeconds: 60,
  keyFn: (req) => req.botId ?? null,
});
