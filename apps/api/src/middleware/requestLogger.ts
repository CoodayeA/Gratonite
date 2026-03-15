import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../lib/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const requestId = crypto.randomUUID().slice(0, 8);
  const start = Date.now();

  // Attach request ID to request object for downstream use
  (req as any).requestId = requestId;

  // Set response header
  res.setHeader('X-Request-Id', requestId);

  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path !== '/health' && !req.path.startsWith('/socket.io')) {
      logger.info({
        msg: 'request',
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration,
        userAgent: req.headers['user-agent']?.slice(0, 100),
      });
    }
  });

  next();
}
