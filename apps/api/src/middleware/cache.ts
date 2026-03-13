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
