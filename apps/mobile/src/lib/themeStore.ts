import { useSyncExternalStore } from 'react';
import type { ThemeName, ThemeDefinition, ThemeColors, NeoExtras } from './themes';
import { themes } from './themes';

interface ThemeState {
  name: ThemeName;
  theme: ThemeDefinition;
}

let state: ThemeState = {
  name: 'neobrutalism',
  theme: themes.neobrutalism,
};

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

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
    const theme = themes[name];
    if (!theme) return;
    state = { name, theme };
    emit();
  },
  getTheme(): ThemeDefinition {
    return state.theme;
  },
  getThemeName(): ThemeName {
    return state.name;
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
