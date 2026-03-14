/**
 * Theme registry — single source of truth for all available themes.
 * Replaces hardcoded theme arrays in SettingsModal and App.tsx.
 */

import { ThemeDefinition, ThemeCategory } from './types';
import { themePresets, themePresetsMap } from './presets';

// Re-export for convenience
export type { ThemeDefinition, ThemeCategory };

/** Get a theme by ID. Returns undefined if not found. */
export function getTheme(id: string): ThemeDefinition | undefined {
  return themePresetsMap[id];
}

/** Get all built-in themes. */
export function getAllThemes(): ThemeDefinition[] {
  return themePresets;
}

/** Get themes filtered by category. */
export function getThemesByCategory(category: ThemeCategory): ThemeDefinition[] {
  return themePresets.filter((t) => t.category === category);
}

/** Get all unique categories that have at least one theme. */
export function getCategories(): ThemeCategory[] {
  const cats = new Set(themePresets.map((t) => t.category));
  return Array.from(cats);
}

/** Search themes by name or description (case-insensitive). */
export function searchThemes(query: string): ThemeDefinition[] {
  const q = query.toLowerCase().trim();
  if (!q) return themePresets;
  return themePresets.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q)
  );
}

/** Get all theme IDs. */
export function getThemeIds(): string[] {
  return themePresets.map((t) => t.id);
}

/** Check if a theme ID is valid. */
export function isValidTheme(id: string): boolean {
  return id in themePresetsMap;
}

// ── Custom (user-created) themes stored in localStorage ──

const CUSTOM_THEMES_KEY = 'gratonite_custom_themes';

/** Get user's custom themes from localStorage. */
export function getCustomThemes(): ThemeDefinition[] {
  try {
    const raw = localStorage.getItem(CUSTOM_THEMES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Save a custom theme to localStorage. */
export function saveCustomTheme(theme: ThemeDefinition): void {
  const customs = getCustomThemes();
  const idx = customs.findIndex((t) => t.id === theme.id);
  if (idx >= 0) customs[idx] = theme;
  else customs.push(theme);
  localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(customs));
}

/** Delete a custom theme from localStorage. */
export function deleteCustomTheme(id: string): void {
  const customs = getCustomThemes().filter((t) => t.id !== id);
  localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(customs));
}

/** Get all themes (built-in + custom). */
export function getAllThemesIncludingCustom(): ThemeDefinition[] {
  return [...themePresets, ...getCustomThemes()];
}

/** Resolve a theme by ID from built-in presets OR custom themes. */
export function resolveTheme(id: string): ThemeDefinition | undefined {
  return themePresetsMap[id] || getCustomThemes().find((t) => t.id === id);
}

// ── Theme favorites ──

const FAVORITES_KEY = 'gratonite_theme_favorites';

export function getFavoriteThemeIds(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function toggleFavoriteTheme(id: string): boolean {
  const favs = getFavoriteThemeIds();
  const idx = favs.indexOf(id);
  if (idx >= 0) {
    favs.splice(idx, 1);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
    return false;
  } else {
    favs.push(id);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
    return true;
  }
}

export function isFavoriteTheme(id: string): boolean {
  return getFavoriteThemeIds().includes(id);
}

// ── Recently used themes ──

const RECENT_KEY = 'gratonite_recent_themes';
const MAX_RECENT = 5;

export function getRecentThemeIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addRecentTheme(id: string): void {
  const recent = getRecentThemeIds().filter((r) => r !== id);
  recent.unshift(id);
  if (recent.length > MAX_RECENT) recent.length = MAX_RECENT;
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
}

// ── Scheduled day/night themes ──

const SCHEDULE_KEY = 'gratonite_theme_schedule';

export interface ThemeSchedule {
  enabled: boolean;
  dayTheme: string;
  nightTheme: string;
  /** Hour to switch to day theme (0-23) */
  dayHour: number;
  /** Hour to switch to night theme (0-23) */
  nightHour: number;
}

export function getThemeSchedule(): ThemeSchedule | null {
  try {
    const raw = localStorage.getItem(SCHEDULE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setThemeSchedule(schedule: ThemeSchedule): void {
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule));
}

export function getScheduledTheme(): string | null {
  const schedule = getThemeSchedule();
  if (!schedule?.enabled) return null;
  const hour = new Date().getHours();
  if (hour >= schedule.dayHour && hour < schedule.nightHour) {
    return schedule.dayTheme;
  }
  return schedule.nightTheme;
}
