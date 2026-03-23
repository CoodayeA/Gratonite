/**
 * cache.ts — Middleware for adding Cache-Control and ETag headers to responses.
 */
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Adds Cache-Control header with the specified max-age.
 */
export function cacheControl(maxAge: number) {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.set('Cache-Control', `public, max-age=${maxAge}`);
    next();
  };
}

/**
 * Adds an ETag header based on response body hash.
 * Must be used after the response body is known (wraps res.json).
 */
export function withETag() {
  return (_req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      const str = JSON.stringify(body);
      const hash = crypto.createHash('md5').update(str).digest('hex').slice(0, 16);
      const etag = `"${hash}"`;
      res.set('ETag', etag);

      // Check If-None-Match
      const ifNoneMatch = _req.get('If-None-Match');
      if (ifNoneMatch === etag) {
        res.status(304).end();
        return res;
      }

      return originalJson(body);
    } as any;
    next();
  };
}

/**
 * Route-based cache rules. Matched top-down — first match wins.
 * Only GET requests receive caching headers.
 */
/**
 * Route-based cache rules. Matched top-down — first match wins.
 * Only GET requests receive caching headers.
 *
 * Phase 9, Item 152: Added stale-while-revalidate (SWR) for frequently-hit
 * endpoints so browsers can serve stale content while revalidating in background.
 */
const CACHE_RULES: Array<{ pattern: RegExp; maxAge: number; scope: 'public' | 'private'; swr?: number }> = [
  // Never cache: auth, messages, presence, notifications, webhooks
  { pattern: /\/auth\//, maxAge: 0, scope: 'private' },
  { pattern: /\/messages/, maxAge: 0, scope: 'private' },
  { pattern: /\/notifications/, maxAge: 0, scope: 'private' },
  { pattern: /\/webhooks/, maxAge: 0, scope: 'private' },
  { pattern: /\/drafts/, maxAge: 0, scope: 'private' },

  // Emojis & stickers: rarely change (5 min fresh, 1 hour SWR)
  { pattern: /\/emojis/, maxAge: 300, scope: 'public', swr: 3600 },
  { pattern: /\/stickers/, maxAge: 300, scope: 'public', swr: 3600 },

  // Guild info: relatively stable (60s fresh, 5 min SWR)
  { pattern: /\/guilds\/[^/]+$/, maxAge: 60, scope: 'public', swr: 300 },
  // Guild channels list (60s fresh, 5 min SWR)
  { pattern: /\/guilds\/[^/]+\/channels$/, maxAge: 60, scope: 'public', swr: 300 },
  // Guild members list (30s fresh, 2 min SWR)
  { pattern: /\/guilds\/[^/]+\/members/, maxAge: 30, scope: 'private', swr: 120 },

  // User profiles: change with status (30s, private, 2 min SWR)
  { pattern: /\/users\/[^/]+$/, maxAge: 30, scope: 'private', swr: 120 },

  // Relationships / friends: moderate freshness (30s, 2 min SWR)
  { pattern: /\/relationships/, maxAge: 30, scope: 'private', swr: 120 },

  // Leaderboard: can be slightly stale (60s, 5 min SWR)
  { pattern: /\/leaderboard/, maxAge: 60, scope: 'public', swr: 300 },

  // Shop items: rarely change (5 min, 30 min SWR)
  { pattern: /\/shop/, maxAge: 300, scope: 'public', swr: 1800 },

  // Static uploads: immutable (1 day)
  { pattern: /\/files\//, maxAge: 86400, scope: 'public' },

  // Capabilities / tags: stable (5 min, 1 hour SWR)
  { pattern: /\/capabilities$/, maxAge: 300, scope: 'public', swr: 3600 },
  { pattern: /\/tags$/, maxAge: 300, scope: 'public', swr: 3600 },

  // Search results: short cache to reduce DB load on repeated searches
  { pattern: /\/search/, maxAge: 15, scope: 'private', swr: 60 },
];

/**
 * Global middleware that applies Cache-Control headers and ETag on GET
 * responses based on route pattern matching.
 */
export function autoCacheHeaders(req: Request, res: Response, next: NextFunction) {
  if (req.method !== 'GET') return next();

  // If Cache-Control was already set by a route-specific middleware, skip
  if (res.getHeader('Cache-Control')) return next();

  const path = req.path;
  const rule = CACHE_RULES.find((r) => r.pattern.test(path));

  if (rule && rule.maxAge > 0) {
    let directive = rule.scope === 'public'
      ? `public, max-age=${rule.maxAge}`
      : `private, max-age=${rule.maxAge}`;
    if (rule.swr) {
      directive += `, stale-while-revalidate=${rule.swr}`;
    }
    res.set('Cache-Control', directive);

    // Attach ETag via response body interception
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      const str = JSON.stringify(body);
      const hash = crypto.createHash('md5').update(str).digest('hex').slice(0, 16);
      const etag = `"${hash}"`;
      res.set('ETag', etag);

      const ifNoneMatch = req.get('If-None-Match');
      if (ifNoneMatch === etag) {
        res.status(304).end();
        return res;
      }

      return originalJson(body);
    } as any;
  } else if (rule && rule.maxAge === 0) {
    res.set('Cache-Control', 'no-store');
  }

  next();
}
