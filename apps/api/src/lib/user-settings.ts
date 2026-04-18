import { DEFAULT_EMAIL_NOTIFICATIONS, mergeEmailNotificationsJson } from './emailNotificationPrefs';
import type { UserSettings } from '../db/schema/settings';

const persistedSettingsKeys = [
  'theme',
  'colorMode',
  'fontFamily',
  'fontSize',
  'glassMode',
  'buttonShape',
  'soundMuted',
  'soundVolume',
  'soundPack',
  'reducedMotion',
  'lowPower',
  'highContrast',
  'compactMode',
  'accentColor',
  'screenReaderMode',
  'linkUnderlines',
  'focusIndicatorSize',
  'colorBlindMode',
  'customThemeId',
  'themePreferences',
  'birthday',
  'emailNotifications',
  'notificationQuietHours',
] as const;

type PersistedSettingsKey = (typeof persistedSettingsKeys)[number];

export type PersistedSettingsPatch = Partial<Pick<UserSettings, PersistedSettingsKey>>;

export function sanitizePersistedSettingsPatch(
  input: Record<string, unknown>,
): PersistedSettingsPatch {
  const sanitized: PersistedSettingsPatch = {};
  for (const key of persistedSettingsKeys) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      (sanitized as Record<string, unknown>)[key] = input[key];
    }
  }
  return sanitized;
}

export function buildUserSettingsResponse(settings: UserSettings | null | undefined) {
  if (!settings) {
    return {
      theme: 'midnight',
      colorMode: 'dark',
      fontFamily: 'Inter',
      fontSize: 14,
      glassMode: 'full',
      buttonShape: 'rounded',
      soundMuted: false,
      soundVolume: 50,
      soundPack: 'default',
      reducedMotion: false,
      lowPower: false,
      highContrast: false,
      compactMode: false,
      accentColor: null,
      customThemeId: null,
      themePreferences: null,
      emailNotifications: { ...DEFAULT_EMAIL_NOTIFICATIONS },
      notificationQuietHours: null,
    };
  }

  const { id, userId, createdAt, updatedAt, ...rest } = settings;
  return {
    ...rest,
    emailNotifications: mergeEmailNotificationsJson(rest.emailNotifications),
  };
}
