import type { SoundName } from './audio';

const STORAGE_KEY = 'gratonite_notification_sound_prefs_v1';
const EVENT_NAME = 'gratonite:notification-sound-prefs';

export interface NotificationSoundPrefs {
  enabled: boolean;
  volume: number; // 0-100
  sounds: Record<SoundName, boolean>;
}

export const DEFAULT_NOTIFICATION_SOUND_PREFS: NotificationSoundPrefs = {
  enabled: true,
  volume: 80,
  sounds: {
    ringtone: true,
    'outgoing-ring': true,
    'call-connect': true,
    'call-end': true,
    message: true,
    mention: true,
    dm: true,
  },
};

function sanitize(input: unknown): NotificationSoundPrefs {
  const raw = (input ?? {}) as Partial<NotificationSoundPrefs> & { sounds?: Record<string, unknown> };
  const volume = Math.max(0, Math.min(100, Number(raw.volume ?? DEFAULT_NOTIFICATION_SOUND_PREFS.volume) || 0));
  const sounds = { ...DEFAULT_NOTIFICATION_SOUND_PREFS.sounds };
  for (const key of Object.keys(sounds) as SoundName[]) {
    if (typeof raw.sounds?.[key] === 'boolean') sounds[key] = raw.sounds[key] as boolean;
  }
  return {
    enabled: raw.enabled !== undefined ? Boolean(raw.enabled) : DEFAULT_NOTIFICATION_SOUND_PREFS.enabled,
    volume,
    sounds,
  };
}

export function readNotificationSoundPrefs(): NotificationSoundPrefs {
  if (typeof window === 'undefined') return DEFAULT_NOTIFICATION_SOUND_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_SOUND_PREFS;
    return sanitize(JSON.parse(raw));
  } catch {
    return DEFAULT_NOTIFICATION_SOUND_PREFS;
  }
}

export function saveNotificationSoundPrefs(prefs: NotificationSoundPrefs): NotificationSoundPrefs {
  const next = sanitize(prefs);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: next }));
  }
  return next;
}

export function updateNotificationSoundPrefs(
  updater: (current: NotificationSoundPrefs) => NotificationSoundPrefs,
): NotificationSoundPrefs {
  return saveNotificationSoundPrefs(updater(readNotificationSoundPrefs()));
}

export function subscribeNotificationSoundPrefs(
  listener: (prefs: NotificationSoundPrefs) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<NotificationSoundPrefs>).detail;
    listener(sanitize(detail));
  };
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}

