import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/jwt';

// Augment Express Request to carry userId
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Missing or malformed Authorization header' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const { userId } = verifyAccessToken(token);
    req.userId = userId;
    next();
  } catch {
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Invalid or expired token' });
  }
}
