import type { Response } from 'express';
import { logger } from './logger';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code: string = 'UNKNOWN_ERROR',
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function handleAppError(res: Response, err: unknown, prefix: string = 'api'): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ code: err.code, message: err.message });
  } else {
    logger.error(`[${prefix}] unexpected error:`, err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
}

export function sendError(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({ code, message });
}
