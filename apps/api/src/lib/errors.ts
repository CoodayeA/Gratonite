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

type NormalizedAppError = {
  status: number;
  code: string;
  message: string;
  reportable: boolean;
  details?: Record<string, string[]>;
};

type DbLikeError = {
  code?: string;
  message?: string;
  detail?: string;
  constraint?: string;
};

function normalizeDbError(err: DbLikeError): NormalizedAppError | null {
  const code = err.code || '';

  if (code === '23505') {
    return {
      status: 409,
      code: 'CONFLICT',
      message: 'A record with the same unique value already exists.',
      reportable: false,
    };
  }
  if (code === '23503') {
    return {
      status: 409,
      code: 'FOREIGN_KEY_VIOLATION',
      message: 'Referenced resource does not exist or cannot be linked.',
      reportable: false,
    };
  }
  if (code === '23502') {
    return {
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Missing a required field.',
      reportable: false,
    };
  }
  if (code === '22P02') {
    return {
      status: 400,
      code: 'INVALID_INPUT',
      message: 'One or more fields have an invalid format.',
      reportable: false,
    };
  }
  if (code === '42P01' || code === '42703') {
    return {
      status: 503,
      code: 'FEATURE_UNAVAILABLE',
      message: 'This feature is temporarily unavailable while data schema catches up.',
      reportable: false,
    };
  }
  if (code === '57P01' || code === '57P03') {
    return {
      status: 503,
      code: 'DATABASE_UNAVAILABLE',
      message: 'Database is temporarily unavailable. Please retry shortly.',
      reportable: false,
    };
  }

  return null;
}

export function normalizeError(err: unknown): NormalizedAppError {
  if (err instanceof AppError) {
    return {
      status: err.statusCode,
      code: err.code,
      message: err.message,
      reportable: err.statusCode >= 500,
    };
  }

  const serviceLike = err as { name?: string; code?: string; message?: string; statusCode?: number; details?: Record<string, string[]> };
  if (serviceLike?.name === 'ServiceError' && serviceLike.code && serviceLike.message) {
    const statusByCode: Record<string, number> = {
      VALIDATION_ERROR: 400,
      NOT_FOUND: 404,
      FORBIDDEN: 403,
      UNAUTHORIZED: 401,
      CONFLICT: 409,
      DUPLICATE_NAME: 409,
      RATE_LIMITED: 429,
      MFA_REQUIRED: 401,
      INVALID_MFA_CODE: 401,
      BLOCKED_CONTENT: 400,
      WORD_FILTER_WARN: 400,
      MAX_PINS: 400,
      AUTOMOD_BLOCKED: 403,
    };
    const status = serviceLike.statusCode || statusByCode[serviceLike.code] || 400;
    return {
      status,
      code: serviceLike.code,
      message: serviceLike.message,
      reportable: status >= 500,
      details: serviceLike.details,
    };
  }

  const dbLike = err as DbLikeError;
  const normalizedDb = normalizeDbError(dbLike);
  if (normalizedDb) return normalizedDb;

  if (dbLike?.message?.includes('EACCES')) {
    return {
      status: 503,
      code: 'FILE_ACCESS_DENIED',
      message: 'Server file access is restricted in this environment.',
      reportable: false,
    };
  }
  if (dbLike?.message?.includes('MFA_ENCRYPTION_KEY is required in production')) {
    return {
      status: 503,
      code: 'CONFIGURATION_ERROR',
      message: 'MFA is temporarily unavailable due to missing server encryption key.',
      reportable: false,
    };
  }

  return {
    status: 500,
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
    reportable: true,
  };
}

export function handleAppError(res: Response, err: unknown, prefix: string = 'api'): void {
  const normalized = normalizeError(err);
  if (normalized.reportable) {
    logger.error(`[${prefix}] unexpected error:`, err);
  } else {
    logger.warn(`[${prefix}] handled operational error:`, {
      code: normalized.code,
      message: normalized.message,
      source: (err as { code?: string; message?: string })?.code || (err as { message?: string })?.message,
    });
  }
  res.status(normalized.status).json({
    code: normalized.code,
    message: normalized.message,
    ...(normalized.details ? { details: normalized.details } : {}),
  });
}

export function sendError(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({ code, message });
}
