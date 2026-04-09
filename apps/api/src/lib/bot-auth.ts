/**
 * lib/bot-auth.ts — Middleware for authenticating bot API tokens.
 *
 * Bot JWTs are signed with the same JWT_SECRET as user tokens but contain
 * `{ botId, type: 'bot' }` instead of `{ userId }`.
 *
 * Two middlewares:
 *   - requireBotAuth: only bot tokens accepted
 *   - requireBotOrUserAuth: accepts either bot tokens or user tokens
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

if (!process.env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is not set. Refusing to start bot auth with insecure defaults.');
}

const JWT_SECRET = process.env.JWT_SECRET;

declare global {
  namespace Express {
    interface Request {
      botId?: string;
    }
  }
}

interface BotTokenPayload {
  botId: string;
  type: 'bot';
}

function isBotPayload(payload: unknown): payload is BotTokenPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    (payload as any).type === 'bot' &&
    typeof (payload as any).botId === 'string'
  );
}

/**
 * Middleware that requires a bot JWT token (`Authorization: Bearer <token>`).
 * Sets `req.botId` on success.
 */
export function requireBotAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Missing Authorization header' });
    return;
  }

  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as unknown;
    if (!isBotPayload(payload)) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'Not a bot token' });
      return;
    }
    req.botId = payload.botId;
    next();
  } catch {
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Invalid or expired token' });
  }
}

/**
 * Middleware that accepts either a user token or a bot token.
 * Sets `req.userId` for user tokens, `req.botId` for bot tokens.
 */
export function requireBotOrUserAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Missing Authorization header' });
    return;
  }

  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as any;
    if (isBotPayload(payload)) {
      req.botId = payload.botId;
    } else if (typeof payload.userId === 'string') {
      req.userId = payload.userId;
    } else {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'Invalid token payload' });
      return;
    }
    next();
  } catch {
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Invalid or expired token' });
  }
}
