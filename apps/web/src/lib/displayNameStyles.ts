export type DisplayNameFont =
  | 'tempo'
  | 'sakura'
  | 'jellybean'
  | 'modern'
  | 'medieval'
  | 'bit8'
  | 'vampyre'
  | 'arcade';

export type DisplayNameEffect = 'solid' | 'gradient' | 'neon' | 'toon' | 'pop';

export type DisplayNameStyle = {
  font: DisplayNameFont;
  effect: DisplayNameEffect;
  colorA: string;
  colorB: string;
};

export type DisplayNameStylePrefs = {
  stylesEnabled: boolean;
  global: DisplayNameStyle;
  perServer: Record<string, DisplayNameStyle>;
};

type PersistedState = {
  users: Record<string, DisplayNameStylePrefs>;
};

const STORAGE_KEY = 'gratonite_display_name_styles_v1';
const CHANGE_EVENT = 'gratonite:display-name-style-change';

export const DISPLAY_NAME_FONTS: Array<{ id: DisplayNameFont; label: string }> = [
  { id: 'tempo', label: 'Tempo' },
  { id: 'sakura', label: 'Sakura' },
  { id: 'jellybean', label: 'Jellybean' },
  { id: 'modern', label: 'Modern' },
  { id: 'medieval', label: 'Medieval' },
  { id: 'bit8', label: '8Bit' },
  { id: 'vampyre', label: 'Vampyre' },
  { id: 'arcade', label: 'Arcade' },
];

export const DISPLAY_NAME_EFFECTS: Array<{ id: DisplayNameEffect; label: string }> = [
  { id: 'solid', label: 'Solid' },
  { id: 'gradient', label: 'Gradient' },
  { id: 'neon', label: 'Neon' },
  { id: 'toon', label: 'Toon' },
  { id: 'pop', label: 'Pop' },
];

const SURPRISE_COLORS = [
  ['#68d7ff', '#ffcb7f'],
  ['#86ffda', '#7db9ff'],
  ['#ff9adf', '#ffd36a'],
  ['#f6ff8b', '#7dffd4'],
  ['#ff9b9b', '#ffec8b'],
];

export const DEFAULT_DISPLAY_NAME_STYLE: DisplayNameStyle = {
  font: 'tempo',
  effect: 'solid',
  colorA: '#68d7ff',
  colorB: '#ffcb7f',
};

export const DEFAULT_DISPLAY_NAME_PREFS: DisplayNameStylePrefs = {
  stylesEnabled: true,
  global: DEFAULT_DISPLAY_NAME_STYLE,
  perServer: {},
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

export function readDisplayNameStylePrefs(userId: string | null | undefined): DisplayNameStylePrefs {
  if (!userId) return DEFAULT_DISPLAY_NAME_PREFS;
  const state = readPersistedState();
  const prefs = state.users[userId];
  if (!prefs) return DEFAULT_DISPLAY_NAME_PREFS;
  return {
    stylesEnabled: prefs.stylesEnabled ?? true,
    global: prefs.global ?? DEFAULT_DISPLAY_NAME_STYLE,
    perServer: prefs.perServer ?? {},
  };
}

export function saveDisplayNameStylePrefs(userId: string, prefs: DisplayNameStylePrefs) {
  const state = readPersistedState();
  state.users[userId] = prefs;
  writePersistedState(state);
}

export function getEffectiveDisplayNameStyle(
  prefs: DisplayNameStylePrefs,
  guildId?: string | null,
): DisplayNameStyle {
  if (guildId && prefs.perServer[guildId]) return prefs.perServer[guildId];
  return prefs.global;
}

export function createSurpriseStyle(): DisplayNameStyle {
  const font = DISPLAY_NAME_FONTS[Math.floor(Math.random() * DISPLAY_NAME_FONTS.length)]?.id ?? 'tempo';
  const effect = DISPLAY_NAME_EFFECTS[Math.floor(Math.random() * DISPLAY_NAME_EFFECTS.length)]?.id ?? 'solid';
  const palette = SURPRISE_COLORS[Math.floor(Math.random() * SURPRISE_COLORS.length)] ?? ['#68d7ff', '#ffcb7f'];
  return {
    font,
    effect,
    colorA: palette[0] ?? '#68d7ff',
    colorB: palette[1] ?? '#ffcb7f',
  };
}

export function subscribeDisplayNameStyleChanges(onChange: () => void) {
  if (typeof window === 'undefined') return () => undefined;
  const handler = () => onChange();
  window.addEventListener('storage', handler);
  window.addEventListener(CHANGE_EVENT, handler);
  return () => {
    window.removeEventListener('storage', handler);
    window.removeEventListener(CHANGE_EVENT, handler);
  };
}
