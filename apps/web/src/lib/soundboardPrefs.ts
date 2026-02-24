export interface SoundboardPrefs {
  enabled: boolean;
  volume: number; // 0-100
  entranceEnabled: boolean;
  entranceGlobalSoundId: string | null;
  entranceByGuild: Record<string, string | null>;
  favorites: string[];
}

const STORAGE_KEY = 'gratonite_soundboard_prefs_v1';
const EVENT_NAME = 'gratonite:soundboard-prefs';

export const DEFAULT_SOUNDBOARD_PREFS: SoundboardPrefs = {
  enabled: true,
  volume: 80,
  entranceEnabled: true,
  entranceGlobalSoundId: null,
  entranceByGuild: {},
  favorites: [],
};

function sanitize(input: unknown): SoundboardPrefs {
  const raw = (input ?? {}) as Partial<SoundboardPrefs>;
  return {
    enabled: raw.enabled !== undefined ? Boolean(raw.enabled) : true,
    volume: Math.max(0, Math.min(100, Number(raw.volume ?? 80) || 0)),
    entranceEnabled: raw.entranceEnabled !== undefined ? Boolean(raw.entranceEnabled) : true,
    entranceGlobalSoundId: typeof raw.entranceGlobalSoundId === 'string' ? raw.entranceGlobalSoundId : null,
    entranceByGuild: raw.entranceByGuild && typeof raw.entranceByGuild === 'object'
      ? Object.fromEntries(Object.entries(raw.entranceByGuild).filter(([, v]) => v === null || typeof v === 'string'))
      : {},
    favorites: Array.isArray(raw.favorites) ? raw.favorites.filter((v): v is string => typeof v === 'string').slice(0, 100) : [],
  };
}

export function readSoundboardPrefs(): SoundboardPrefs {
  if (typeof window === 'undefined') return DEFAULT_SOUNDBOARD_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SOUNDBOARD_PREFS;
    return sanitize(JSON.parse(raw));
  } catch {
    return DEFAULT_SOUNDBOARD_PREFS;
  }
}

export function saveSoundboardPrefs(prefs: SoundboardPrefs): SoundboardPrefs {
  const next = sanitize(prefs);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: next }));
  }
  return next;
}

export function updateSoundboardPrefs(updater: (current: SoundboardPrefs) => SoundboardPrefs): SoundboardPrefs {
  return saveSoundboardPrefs(updater(readSoundboardPrefs()));
}

export function subscribeSoundboardPrefs(listener: (prefs: SoundboardPrefs) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (event: Event) => listener(sanitize((event as CustomEvent<SoundboardPrefs>).detail));
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}

