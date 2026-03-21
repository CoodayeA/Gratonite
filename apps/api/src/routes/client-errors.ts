import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';

export const clientErrorsRouter = Router();

// ---------------------------------------------------------------------------
// Simple in-memory IP rate limiter (max 20 per minute per IP)
// ---------------------------------------------------------------------------
const ipHits = new Map<string, { count: number; resetsAt: number }>();
const IP_LIMIT = 20;
const WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipHits.get(ip);
  if (!entry || now >= entry.resetsAt) {
    ipHits.set(ip, { count: 1, resetsAt: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > IP_LIMIT;
}

// Periodic cleanup so the map doesn't grow forever
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of ipHits) {
    if (now >= entry.resetsAt) ipHits.delete(ip);
  }
}, WINDOW_MS);

// ---------------------------------------------------------------------------
// POST /api/v1/client-errors
// ---------------------------------------------------------------------------
clientErrorsRouter.post('/', (req: Request, res: Response): void => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    res.status(429).json({ code: 'RATE_LIMITED', message: 'Too many error reports' });
    return;
  }

  const { message, stack, url, userAgent, userId, timestamp, componentStack, sessionId } = req.body ?? {};

  if (!message || typeof message !== 'string') {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'message is required' });
    return;
  }

  // Basic length guards
  const safeStr = (v: unknown, max = 4096): string | undefined => {
    if (typeof v !== 'string') return undefined;
    return v.slice(0, max);
  };

  logger.error(JSON.stringify({
    level: 'error',
    tag: '[CLIENT_ERROR]',
    message: safeStr(message, 1024),
    stack: safeStr(stack, 4096),
    url: safeStr(url, 2048),
    userAgent: safeStr(userAgent, 512),
    userId: safeStr(userId, 128),
    sessionId: safeStr(sessionId, 128),
    componentStack: safeStr(componentStack, 4096),
    timestamp: safeStr(timestamp, 64) || new Date().toISOString(),
    ip,
  }));

  res.status(204).end();
});
