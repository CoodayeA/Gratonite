/**
 * CORS_ORIGIN may be a single origin or comma-separated list, e.g.
 *   https://gratonite.chat,https://app.gratonite.chat
 * Browsers sending Origin must match one of these when using credentials.
 */
import type { CorsOptions } from 'cors';

const DEV_FALLBACK: NonNullable<CorsOptions['origin']> = [
  'http://localhost:5173',
  'http://localhost:5174',
  /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/,
];

export function parseCorsOriginsFromEnv(): NonNullable<CorsOptions['origin']> {
  const raw = process.env.CORS_ORIGIN?.trim();
  if (!raw) {
    return DEV_FALLBACK;
  }
  if (raw === '*') {
    return '*';
  }
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return DEV_FALLBACK;
  }
  if (parts.length === 1) {
    return parts[0];
  }
  return parts;
}
