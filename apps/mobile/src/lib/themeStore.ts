import { useSyncExternalStore } from 'react';
import * as SecureStore from 'expo-secure-store';
import type { ThemeName, ThemeDefinition, ThemeColors, ThemeFontSize, NeoExtras, GlassExtras } from './themes';
import { themes } from './themes';

// Base font size the themes are designed around (API default = 14)
const BASE_FONT_SIZE = 14;

function scaleFontSizes(base: ThemeFontSize, userFontSize: number): ThemeFontSize {
  if (userFontSize === BASE_FONT_SIZE) return base;
  const ratio = userFontSize / BASE_FONT_SIZE;
  return {
    xs: Math.round(base.xs * ratio),
    sm: Math.round(base.sm * ratio),
    md: Math.round(base.md * ratio),
    lg: Math.round(base.lg * ratio),
    xl: Math.round(base.xl * ratio),
    xxl: Math.round(base.xxl * ratio),
    xxxl: Math.round(base.xxxl * ratio),
  };
}

interface ThemeState {
  name: ThemeName;
  theme: ThemeDefinition;
  userFontSize: number;
  autoMode: boolean;
}

let state: ThemeState = {
  name: 'neobrutalism',
  theme: themes.neobrutalism,
  userFontSize: BASE_FONT_SIZE,
  autoMode: false,
};

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function buildThemeWithScale(base: ThemeDefinition, userFontSize: number): ThemeDefinition {
  if (userFontSize === BASE_FONT_SIZE) return base;
  return {
    ...base,
    fontSize: scaleFontSizes(base.fontSize, userFontSize),
  };
}

/** All valid theme names for runtime validation */
const VALID_THEMES = new Set<string>(Object.keys(themes));

export const themeStore = {
  getSnapshot(): ThemeState {
    return state;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  setTheme(name: ThemeName) {
    if (state.name === name) return;
    const base = themes[name];
    if (!base) return;
    state = { name, theme: buildThemeWithScale(base, state.userFontSize), userFontSize: state.userFontSize, autoMode: state.autoMode };
    emit();
  },
  setFontSize(size: number) {
    if (state.userFontSize === size) return;
    const base = themes[state.name];
    state = { ...state, userFontSize: size, theme: buildThemeWithScale(base, size) };
    emit();
  },
  getFontSize(): number {
    return state.userFontSize;
  },
  getTheme(): ThemeDefinition {
    return state.theme;
  },
  getThemeName(): ThemeName {
    return state.name;
  },
  setAutoMode(enabled: boolean) {
    state = { ...state, autoMode: enabled };
    SecureStore.setItemAsync('gratonite_auto_theme', String(enabled)).catch(() => {});
    emit();
  },
  getAutoMode(): boolean {
    return state.autoMode;
  },
  isValidTheme(name: string): name is ThemeName {
    return VALID_THEMES.has(name);
  },
};

export function useTheme(): ThemeState & ThemeDefinition {
  const s = useSyncExternalStore(themeStore.subscribe, themeStore.getSnapshot);
  return { ...s, ...s.theme };
}

export function useColors(): ThemeColors {
  const s = useSyncExternalStore(themeStore.subscribe, themeStore.getSnapshot);
  return s.theme.colors;
}

export function useNeo(): NeoExtras | null {
  const s = useSyncExternalStore(themeStore.subscribe, themeStore.getSnapshot);
  return s.theme.neo;
}

export function useGlass(): GlassExtras | null {
  const s = useSyncExternalStore(themeStore.subscribe, themeStore.getSnapshot);
  return s.theme.glass;
}
