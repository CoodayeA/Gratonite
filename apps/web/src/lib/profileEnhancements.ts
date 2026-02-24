export type StatusExpiryPreset = '1h' | '4h' | 'today' | 'never';

export type ProfileEnhancementsPrefs = {
  serverTagGuildId: string | null;
  statusText: string;
  statusExpiresAt: number | null;
  widgets: string[];
};

type PersistedState = {
  users: Record<string, ProfileEnhancementsPrefs>;
};

const STORAGE_KEY = 'gratonite_profile_enhancements_v1';
const CHANGE_EVENT = 'gratonite:profile-enhancements-change';

export const DEFAULT_PROFILE_ENHANCEMENTS: ProfileEnhancementsPrefs = {
  serverTagGuildId: null,
  statusText: '',
  statusExpiresAt: null,
  widgets: [],
};

function readPersistedState(): PersistedState {
  if (typeof window === 'undefined') return { users: {} };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { users: {} };
    const parsed = JSON.parse(raw) as PersistedState;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.users !== 'object') {
      return { users: {} };
    }
    return parsed;
  } catch {
    return { users: {} };
  }
}

function writePersistedState(state: PersistedState) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function readProfileEnhancementsPrefs(userId: string | null | undefined): ProfileEnhancementsPrefs {
  if (!userId) return DEFAULT_PROFILE_ENHANCEMENTS;
  const state = readPersistedState();
  const prefs = state.users[userId];
  if (!prefs) return DEFAULT_PROFILE_ENHANCEMENTS;
  return {
    serverTagGuildId: prefs.serverTagGuildId ?? null,
    statusText: prefs.statusText ?? '',
    statusExpiresAt: prefs.statusExpiresAt ?? null,
    widgets: Array.isArray(prefs.widgets) ? prefs.widgets : [],
  };
}

export function saveProfileEnhancementsPrefs(userId: string, prefs: ProfileEnhancementsPrefs) {
  const state = readPersistedState();
  state.users[userId] = prefs;
  writePersistedState(state);
}

export function computeExpiryFromPreset(preset: StatusExpiryPreset): number | null {
  if (preset === 'never') return null;
  const now = Date.now();
  if (preset === '1h') return now + 60 * 60 * 1000;
  if (preset === '4h') return now + 4 * 60 * 60 * 1000;

  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

export function getActiveStatusText(prefs: ProfileEnhancementsPrefs): string {
  if (!prefs.statusText.trim()) return '';
  if (prefs.statusExpiresAt && Date.now() > prefs.statusExpiresAt) return '';
  return prefs.statusText.trim();
}

export function subscribeProfileEnhancementChanges(onChange: () => void) {
  if (typeof window === 'undefined') return () => undefined;
  const handler = () => onChange();
  window.addEventListener('storage', handler);
  window.addEventListener(CHANGE_EVENT, handler);
  return () => {
    window.removeEventListener('storage', handler);
    window.removeEventListener(CHANGE_EVENT, handler);
  };
}
