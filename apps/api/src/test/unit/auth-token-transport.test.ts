import { describe, expect, it } from 'vitest';

import { REFRESH_COOKIE } from '../../lib/authCookies';
import { isNativeAuthClient, readRefreshTokenFromRequest } from '../../lib/authTokenTransport';

describe('auth token transport helpers', () => {
  it('detects native auth clients from explicit mobile headers', () => {
    expect(isNativeAuthClient({ headers: { 'x-gratonite-client': 'mobile' } })).toBe(true);
    expect(isNativeAuthClient({ headers: { 'x-gratonite-client': 'ios' } })).toBe(true);
    expect(isNativeAuthClient({ headers: { 'x-gratonite-client': 'android' } })).toBe(true);
    expect(isNativeAuthClient({ headers: { 'x-gratonite-client': 'react-native' } })).toBe(true);
    expect(isNativeAuthClient({ headers: { 'x-gratonite-client': 'web' } })).toBe(false);
    expect(isNativeAuthClient({ headers: {} })).toBe(false);
  });

  it('reads refresh tokens from native body or header before cookies', () => {
    expect(readRefreshTokenFromRequest({ body: { refreshToken: 'body-token' }, headers: {}, cookies: {} })).toBe('body-token');
    expect(readRefreshTokenFromRequest({ body: {}, headers: { 'x-refresh-token': 'header-token' }, cookies: {} })).toBe('header-token');
    expect(readRefreshTokenFromRequest({ body: {}, headers: {}, cookies: { [REFRESH_COOKIE]: 'cookie-token' } })).toBe('cookie-token');
    expect(readRefreshTokenFromRequest({ body: { refreshToken: 'body-token' }, headers: { 'x-refresh-token': 'header-token' }, cookies: { [REFRESH_COOKIE]: 'cookie-token' } })).toBe('body-token');
  });
});
