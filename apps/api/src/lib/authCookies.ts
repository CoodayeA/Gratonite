import type { Response } from 'express';

export const REFRESH_COOKIE = 'gratonite_refresh';
export const LEGACY_REFRESH_COOKIE = 'gratonite_refresh_token';
export const REFRESH_COOKIE_NAMES = [REFRESH_COOKIE, LEGACY_REFRESH_COOKIE] as const;

type CookieSource = Partial<Record<string, string | undefined>>;

export function readRefreshCookie(cookies: CookieSource | undefined): string | undefined {
  if (!cookies) return undefined;
  for (const name of REFRESH_COOKIE_NAMES) {
    const value = cookies[name];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

export function clearRefreshCookies(res: Response): void {
  for (const name of REFRESH_COOKIE_NAMES) {
    res.clearCookie(name, { path: '/' });
  }
}
