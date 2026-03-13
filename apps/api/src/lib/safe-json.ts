/**
 * Safe JSON.parse wrapper — returns fallback on invalid input instead of throwing.
 * Use for Redis data, external payloads, or any string that might be corrupted.
 */
import { logger } from './logger';
export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    logger.error('[safeJsonParse] failed to parse:', err);
    return fallback;
  }
}
