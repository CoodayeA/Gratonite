import { resolveThemeV2, applyThemeV2 } from '@/theme/resolveTheme';
import type { ThemeManifestV2 } from '@/theme/resolveTheme';
import { loadSavedTheme } from '@/lib/themes';

// ── Color Mode (Light / Dark / System) ──────────────────────────────────────

export const UI_COLOR_MODE_STORAGE_KEY = 'ui_color_mode_v1';
export type UiColorMode = 'light' | 'dark' | 'system';

export function readUiColorModePreference(): UiColorMode {
  const raw = window.localStorage.getItem(UI_COLOR_MODE_STORAGE_KEY);
  if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  return 'dark'; // default
}

export function setUiColorModePreference(mode: UiColorMode) {
  window.localStorage.setItem(UI_COLOR_MODE_STORAGE_KEY, mode);
}

export function resolveEffectiveColorMode(preference: UiColorMode): 'light' | 'dark' {
  if (preference === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return preference;
}

export function applyColorMode() {
  const preference = readUiColorModePreference();
  const effective = resolveEffectiveColorMode(preference);
  document.documentElement.dataset['colorMode'] = effective;
}

export function listenForSystemColorSchemeChange() {
  const mq = window.matchMedia('(prefers-color-scheme: light)');
  mq.addEventListener('change', () => {
    if (readUiColorModePreference() === 'system') {
      applyColorMode();
    }
  });
}

// ── V2 Tokens ───────────────────────────────────────────────────────────────

export const UI_V2_TOKENS_STORAGE_KEY = 'ui_v2_tokens';
export const UI_V2_THEME_MANIFEST_STORAGE_KEY = 'ui_v2_theme_manifest';
export const UI_GLASS_MODE_STORAGE_KEY = 'ui_glass_mode_v1';
export const UI_LOW_POWER_STORAGE_KEY = 'ui_low_power_v1';
export const UI_REDUCED_EFFECTS_STORAGE_KEY = 'ui_reduced_effects_v1';
export const UI_SURFACE_BACKGROUND_MODE_STORAGE_KEY = 'ui_surface_background_mode_v1';
export const UI_CONTENT_SCRIM_STORAGE_KEY = 'ui_content_scrim_v1';
export const UI_PORTAL_BACKGROUND_STYLE_STORAGE_KEY = 'ui_portal_background_style_v1';
export const UI_CHANNEL_BACKGROUND_STYLE_STORAGE_KEY = 'ui_channel_background_style_v1';
export const UI_DM_BACKGROUND_STYLE_STORAGE_KEY = 'ui_dm_background_style_v1';

export type UiGlassMode = 'off' | 'subtle' | 'full';
export type UiSurfaceBackgroundMode = 'contained' | 'full';
export type UiContentScrim = 'soft' | 'balanced' | 'strong';
export type UiBackgroundStyle = 'auto' | 'aurora' | 'mesh' | 'minimal';

function readFlagFromQuery(): boolean | null {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('ui_v2_tokens');
  if (raw === null) return null;
  if (raw === '1' || raw === 'true') return true;
  if (raw === '0' || raw === 'false') return false;
  return null;
}

function readPersistedFlag(): boolean | null {
  const raw = window.localStorage.getItem(UI_V2_TOKENS_STORAGE_KEY);
  if (raw === null) return null;
  return raw === '1';
}

export function setUiV2TokensPreference(enabled: boolean) {
  window.localStorage.setItem(UI_V2_TOKENS_STORAGE_KEY, enabled ? '1' : '0');
}

export function readThemeManifestPreference(): ThemeManifestV2 | null {
  const raw = window.localStorage.getItem(UI_V2_THEME_MANIFEST_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ThemeManifestV2;
  } catch {
    return null;
  }
}

export function setThemeManifestPreference(manifest: ThemeManifestV2) {
  window.localStorage.setItem(UI_V2_THEME_MANIFEST_STORAGE_KEY, JSON.stringify(manifest));
}

export function clearThemeManifestPreference() {
  window.localStorage.removeItem(UI_V2_THEME_MANIFEST_STORAGE_KEY);
}

export function readUiGlassModePreference(): UiGlassMode {
  const raw = window.localStorage.getItem(UI_GLASS_MODE_STORAGE_KEY);
  if (raw === 'off' || raw === 'subtle' || raw === 'full') return raw;
  return 'subtle';
}

export function setUiGlassModePreference(mode: UiGlassMode) {
  window.localStorage.setItem(UI_GLASS_MODE_STORAGE_KEY, mode);
}

export function readUiLowPowerPreference(): boolean {
  return window.localStorage.getItem(UI_LOW_POWER_STORAGE_KEY) === '1';
}

export function setUiLowPowerPreference(enabled: boolean) {
  window.localStorage.setItem(UI_LOW_POWER_STORAGE_KEY, enabled ? '1' : '0');
}

export function readUiReducedEffectsPreference(): boolean {
  return window.localStorage.getItem(UI_REDUCED_EFFECTS_STORAGE_KEY) === '1';
}

export function setUiReducedEffectsPreference(enabled: boolean) {
  window.localStorage.setItem(UI_REDUCED_EFFECTS_STORAGE_KEY, enabled ? '1' : '0');
}

export function readUiSurfaceBackgroundModePreference(): UiSurfaceBackgroundMode {
  const raw = window.localStorage.getItem(UI_SURFACE_BACKGROUND_MODE_STORAGE_KEY);
  if (raw === 'contained' || raw === 'full') return raw;
  return 'contained';
}

export function setUiSurfaceBackgroundModePreference(mode: UiSurfaceBackgroundMode) {
  window.localStorage.setItem(UI_SURFACE_BACKGROUND_MODE_STORAGE_KEY, mode);
}

export function readUiContentScrimPreference(): UiContentScrim {
  const raw = window.localStorage.getItem(UI_CONTENT_SCRIM_STORAGE_KEY);
  if (raw === 'soft' || raw === 'balanced' || raw === 'strong') return raw;
  return 'balanced';
}

export function setUiContentScrimPreference(mode: UiContentScrim) {
  window.localStorage.setItem(UI_CONTENT_SCRIM_STORAGE_KEY, mode);
}

export function readUiBackgroundStylePreference(
  key:
    | typeof UI_PORTAL_BACKGROUND_STYLE_STORAGE_KEY
    | typeof UI_CHANNEL_BACKGROUND_STYLE_STORAGE_KEY
    | typeof UI_DM_BACKGROUND_STYLE_STORAGE_KEY,
): UiBackgroundStyle {
  const raw = window.localStorage.getItem(key);
  if (raw === 'auto' || raw === 'aurora' || raw === 'mesh' || raw === 'minimal') return raw;
  return 'auto';
}

export function setUiBackgroundStylePreference(
  key:
    | typeof UI_PORTAL_BACKGROUND_STYLE_STORAGE_KEY
    | typeof UI_CHANNEL_BACKGROUND_STYLE_STORAGE_KEY
    | typeof UI_DM_BACKGROUND_STYLE_STORAGE_KEY,
  mode: UiBackgroundStyle,
) {
  window.localStorage.setItem(key, mode);
}

export function applyUiVisualPreferences() {
  const root = document.documentElement;
  root.dataset['themeGlass'] = readUiGlassModePreference();
  root.dataset['uiLowPower'] = readUiLowPowerPreference() ? 'true' : 'false';
  root.dataset['uiReducedEffects'] = readUiReducedEffectsPreference() ? 'true' : 'false';
  root.dataset['uiSurfaceBackground'] = readUiSurfaceBackgroundModePreference();
  root.dataset['uiContentScrim'] = readUiContentScrimPreference();
  root.dataset['uiPortalBg'] = readUiBackgroundStylePreference(UI_PORTAL_BACKGROUND_STYLE_STORAGE_KEY);
  root.dataset['uiChannelBg'] = readUiBackgroundStylePreference(UI_CHANNEL_BACKGROUND_STYLE_STORAGE_KEY);
  root.dataset['uiDmBg'] = readUiBackgroundStylePreference(UI_DM_BACKGROUND_STYLE_STORAGE_KEY);
}

export function shouldEnableUiV2Tokens(): boolean {
  const queryValue = readFlagFromQuery();
  if (queryValue !== null) {
    setUiV2TokensPreference(queryValue);
    return queryValue;
  }

  const persisted = readPersistedFlag();
  if (persisted !== null) return persisted;

  return import.meta.env.VITE_UI_V2_TOKENS === 'true';
}

export function initThemeV2() {
  applyColorMode();
  listenForSystemColorSchemeChange();
  loadSavedTheme();          // ← restores persisted CSS-var theme on every page load
  // Restore custom accent override if one was saved
  const accentOverride = localStorage.getItem('gratonite_accent_override');
  if (accentOverride && /^#[0-9a-fA-F]{6}$/.test(accentOverride)) {
    document.documentElement.style.setProperty('--accent', accentOverride);
    document.documentElement.style.setProperty('--accent-2', accentOverride);
  }
  applyUiVisualPreferences();
  if (!shouldEnableUiV2Tokens()) return;
  const { theme } = resolveThemeV2(readThemeManifestPreference() ?? undefined);
  applyThemeV2(theme);
}
