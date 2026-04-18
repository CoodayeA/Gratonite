import { describe, expect, it } from 'vitest';

import { clearRefreshCookies, LEGACY_REFRESH_COOKIE, readRefreshCookie, REFRESH_COOKIE } from '../../lib/authCookies';
import { buildUserSettingsResponse, sanitizePersistedSettingsPatch } from '../../lib/user-settings';

describe('auth/settings/session helpers', () => {
  it('reads the canonical refresh cookie first and falls back to the legacy alias', () => {
    expect(readRefreshCookie({ [REFRESH_COOKIE]: 'canonical', [LEGACY_REFRESH_COOKIE]: 'legacy' })).toBe('canonical');
    expect(readRefreshCookie({ [LEGACY_REFRESH_COOKIE]: 'legacy' })).toBe('legacy');
    expect(readRefreshCookie({})).toBeUndefined();
  });

  it('clears both refresh cookie names', () => {
    const cleared: string[] = [];
    const res = {
      clearCookie: (name: string) => {
        cleared.push(name);
      },
    } as any;

    clearRefreshCookies(res);

    expect(cleared).toEqual([REFRESH_COOKIE, LEGACY_REFRESH_COOKIE]);
  });

  it('strips non-persisted settings fields from patch payloads', () => {
    expect(sanitizePersistedSettingsPatch({
      theme: 'midnight',
      timezone: 'UTC',
      profileSong: { title: 'Song' },
      dndSchedule: { enabled: true },
      emailNotifications: { mentions: true },
    })).toEqual({
      theme: 'midnight',
      emailNotifications: { mentions: true },
    });
  });

  it('returns stable defaults when there is no stored settings row', () => {
    expect(buildUserSettingsResponse(null)).toMatchObject({
      theme: 'midnight',
      colorMode: 'dark',
      soundVolume: 50,
      emailNotifications: {
        mentions: false,
        dms: false,
        frequency: 'never',
        securityAlerts: false,
      },
      notificationQuietHours: null,
    });
  });
});
