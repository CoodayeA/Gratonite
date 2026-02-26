import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  applyUiVisualPreferences,
  clearThemeManifestPreference,
  readThemeManifestPreference,
  readUiGlassModePreference,
  readUiSurfaceBackgroundModePreference,
  readUiContentScrimPreference,
  readUiBackgroundStylePreference,
  readUiLowPowerPreference,
  readUiReducedEffectsPreference,
  UI_PORTAL_BACKGROUND_STYLE_STORAGE_KEY,
  UI_CHANNEL_BACKGROUND_STYLE_STORAGE_KEY,
  UI_DM_BACKGROUND_STYLE_STORAGE_KEY,
  setUiGlassModePreference,
  setUiBackgroundStylePreference,
  setUiSurfaceBackgroundModePreference,
  setUiContentScrimPreference,
  setUiLowPowerPreference,
  setUiReducedEffectsPreference,
  setThemeManifestPreference,
  setUiV2TokensPreference,
  shouldEnableUiV2Tokens,
  readUiColorModePreference,
  setUiColorModePreference,
  applyColorMode,
  type UiColorMode,
  type UiGlassMode,
  type UiSurfaceBackgroundMode,
  type UiContentScrim,
  type UiBackgroundStyle,
} from '@/theme/initTheme';
import { applyThemeV2, resolveThemeV2 } from '@/theme/resolveTheme';
import { DEFAULT_THEME_V2 } from '@/theme/tokens-v2';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { useEffect } from 'react';

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
const T = {
  bg: '#2c2c3e',
  bgElevated: '#353348',
  bgInput: '#25243a',
  bgSoft: '#413d58',
  stroke: '#4a4660',
  accent: '#d4af37',
  text: '#e8e4e0',
  textMuted: '#a8a4b8',
  textFaint: '#6e6a80',
  textOnGold: '#1a1a2e',
} as const;

// ---------------------------------------------------------------------------
// Style objects
// ---------------------------------------------------------------------------
const s = {
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  } as React.CSSProperties,

  heading: {
    fontSize: 13,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: T.textFaint,
    margin: 0,
  } as React.CSSProperties,

  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    background: T.bgElevated,
    borderRadius: 12,
    padding: 24,
    border: `1px solid ${T.stroke}`,
  } as React.CSSProperties,

  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  } as React.CSSProperties,

  fieldLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: T.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  } as React.CSSProperties,

  fieldControl: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  } as React.CSSProperties,

  fieldRow: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  } as React.CSSProperties,

  colorModeBtn: (active: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 16px',
    borderRadius: 8,
    border: active ? `2px solid ${T.accent}` : `1px solid ${T.stroke}`,
    background: active ? T.bgSoft : T.bgInput,
    color: active ? T.text : T.textMuted,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  }),

  select: {
    appearance: 'none',
    background: T.bgInput,
    border: `1px solid ${T.stroke}`,
    borderRadius: 8,
    padding: '8px 32px 8px 12px',
    color: T.text,
    fontSize: 14,
    cursor: 'pointer',
    outline: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23a8a4b8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
  } as React.CSSProperties,

  rangeInput: {
    width: '100%',
    maxWidth: 200,
    accentColor: T.accent,
    cursor: 'pointer',
  } as React.CSSProperties,

  rangeValue: {
    fontSize: 13,
    color: T.textMuted,
    minWidth: 40,
    textAlign: 'right',
  } as React.CSSProperties,

  toggleLabel: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    cursor: 'pointer',
    width: 40,
    height: 22,
    flexShrink: 0,
  } as React.CSSProperties,

  toggleInput: {
    position: 'absolute',
    opacity: 0,
    width: 0,
    height: 0,
  } as React.CSSProperties,

  toggleIndicator: (checked: boolean): React.CSSProperties => ({
    position: 'absolute',
    inset: 0,
    borderRadius: 11,
    background: checked ? T.accent : T.bgSoft,
    transition: 'background 0.2s ease',
    // pseudo-elements handled via box-shadow trick for the thumb
    boxShadow: checked
      ? `inset 20px 0 0 0 ${T.accent}, inset 0 0 0 0 ${T.accent}`
      : 'none',
  }),

  toggleThumb: (checked: boolean): React.CSSProperties => ({
    position: 'absolute',
    top: 2,
    left: checked ? 20 : 2,
    width: 18,
    height: 18,
    borderRadius: '50%',
    background: checked ? T.textOnGold : T.textMuted,
    transition: 'left 0.2s ease, background 0.2s ease',
    pointerEvents: 'none',
  }),

  note: {
    fontSize: 12,
    color: T.textMuted,
    lineHeight: 1.5,
    padding: '8px 0',
    borderTop: `1px solid ${T.stroke}`,
  } as React.CSSProperties,

  themeEditor: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    padding: '20px 0 0',
    borderTop: `1px solid ${T.stroke}`,
  } as React.CSSProperties,

  themeHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  } as React.CSSProperties,

  themeTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: T.text,
    margin: 0,
  } as React.CSSProperties,

  muted: {
    fontSize: 12,
    color: T.textMuted,
    margin: 0,
  } as React.CSSProperties,

  themePresets: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: 8,
  } as React.CSSProperties,

  themePresetBtn: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: '10px 14px',
    borderRadius: 8,
    border: `1px solid ${T.stroke}`,
    background: T.bgInput,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'border-color 0.15s ease',
  } as React.CSSProperties,

  themePresetName: {
    fontSize: 13,
    fontWeight: 600,
    color: T.text,
  } as React.CSSProperties,

  themePresetDesc: {
    fontSize: 11,
    color: T.textMuted,
  } as React.CSSProperties,

  themeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 12,
  } as React.CSSProperties,

  themeField: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  } as React.CSSProperties,

  themeLabel: {
    fontSize: 12,
    fontWeight: 500,
    color: T.textMuted,
  } as React.CSSProperties,

  themeActions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  } as React.CSSProperties,

  themeJson: {
    width: '100%',
    minHeight: 120,
    background: T.bgInput,
    border: `1px solid ${T.stroke}`,
    borderRadius: 8,
    padding: 12,
    color: T.text,
    fontSize: 12,
    fontFamily: 'monospace',
    resize: 'vertical',
    outline: 'none',
  } as React.CSSProperties,

  error: {
    fontSize: 12,
    color: '#ff6b6b',
    padding: '4px 0',
  } as React.CSSProperties,
};

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
const THEME_TOKEN_CONTROLS: Array<{ key: string; label: string; type: 'color' | 'text' }> = [
  { key: 'semantic/action/accent', label: 'Primary Accent', type: 'color' },
  { key: 'semantic/action/accent-2', label: 'Secondary Accent', type: 'color' },
  { key: 'semantic/surface/base', label: 'Base Surface', type: 'color' },
  { key: 'semantic/text/primary', label: 'Primary Text', type: 'color' },
  { key: 'semantic/gradient/accent', label: 'Accent Gradient', type: 'text' },
];

const THEME_PRESETS_V3: Array<{ name: string; description: string; overrides: Record<string, string> }> = [
  {
    name: 'Ice',
    description: 'Lighter cyan/ice glass',
    overrides: {
      'semantic/surface/base': '#10182a',
      'semantic/surface/raised': 'rgba(27, 39, 61, 0.84)',
      'semantic/surface/soft': 'rgba(37, 52, 79, 0.82)',
      'semantic/action/accent': '#7ad8ff',
      'semantic/action/accent-2': '#a3c7ff',
      'semantic/gradient/accent': 'linear-gradient(135deg, #7ad8ff, #a3c7ff 55%, #d3ebff)',
    },
  },
  {
    name: 'Cyberpunk',
    description: 'Indigo + cyan neon glass',
    overrides: {
      'semantic/surface/base': '#12162b',
      'semantic/surface/raised': 'rgba(25, 30, 58, 0.84)',
      'semantic/surface/soft': 'rgba(35, 42, 74, 0.82)',
      'semantic/action/accent': '#7a5cff',
      'semantic/action/accent-2': '#2ee6ff',
      'semantic/gradient/accent': 'linear-gradient(135deg, #7a5cff, #2ee6ff 58%, #a88aff)',
    },
  },
  {
    name: 'Ember',
    description: 'Warm orange + gold glass',
    overrides: {
      'semantic/surface/base': '#1a1411',
      'semantic/surface/raised': 'rgba(42, 26, 20, 0.84)',
      'semantic/surface/soft': 'rgba(55, 34, 25, 0.82)',
      'semantic/action/accent': '#ff7a45',
      'semantic/action/accent-2': '#ffd36b',
      'semantic/gradient/accent': 'linear-gradient(135deg, #ff7a45, #ffd36b)',
    },
  },
  {
    name: 'Toxic',
    description: 'Green neon community theme',
    overrides: {
      'semantic/surface/base': '#0f1510',
      'semantic/surface/raised': 'rgba(18, 33, 22, 0.84)',
      'semantic/surface/soft': 'rgba(27, 45, 31, 0.82)',
      'semantic/action/accent': '#2dff9f',
      'semantic/action/accent-2': '#b8ff62',
      'semantic/gradient/accent': 'linear-gradient(135deg, #2dff9f, #b8ff62)',
    },
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function AppearanceSection() {
  const [colorMode, setColorMode] = useState<UiColorMode>(() => readUiColorModePreference());
  const [fontScale, setFontScaleState] = useState(1);
  const [messageDisplay, setMessageDisplayState] = useState('cozy');
  const [uiV2TokensEnabled, setUiV2TokensEnabled] = useState(() => shouldEnableUiV2Tokens());
  const [uiGlassMode, setUiGlassMode] = useState<UiGlassMode>(() => readUiGlassModePreference());
  const [uiSurfaceBackgroundMode, setUiSurfaceBackgroundMode] = useState<UiSurfaceBackgroundMode>(
    () => readUiSurfaceBackgroundModePreference(),
  );
  const [uiContentScrim, setUiContentScrim] = useState<UiContentScrim>(() => readUiContentScrimPreference());
  const [uiLowPower, setUiLowPower] = useState(() => readUiLowPowerPreference());
  const [uiReducedEffects, setUiReducedEffects] = useState(() => readUiReducedEffectsPreference());
  const [uiPortalBackgroundStyle, setUiPortalBackgroundStyle] = useState<UiBackgroundStyle>(
    () => readUiBackgroundStylePreference(UI_PORTAL_BACKGROUND_STYLE_STORAGE_KEY),
  );
  const [uiChannelBackgroundStyle, setUiChannelBackgroundStyle] = useState<UiBackgroundStyle>(
    () => readUiBackgroundStylePreference(UI_CHANNEL_BACKGROUND_STYLE_STORAGE_KEY),
  );
  const [uiDmBackgroundStyle, setUiDmBackgroundStyle] = useState<UiBackgroundStyle>(
    () => readUiBackgroundStylePreference(UI_DM_BACKGROUND_STYLE_STORAGE_KEY),
  );
  const [themeName, setThemeName] = useState(() => readThemeManifestPreference()?.name ?? DEFAULT_THEME_V2.name);
  const [themeOverrides, setThemeOverrides] = useState<Record<string, string>>(
    () => readThemeManifestPreference()?.overrides ?? {},
  );
  const [themeImportValue, setThemeImportValue] = useState('');
  const [themeError, setThemeError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      api.users.updateSettings({ fontScale, messageDisplay, theme: 'dark' }).catch(() => undefined);
    }, 300);
    return () => clearTimeout(timer);
  }, [fontScale, messageDisplay]);

  function setFontScale(value: number) {
    setFontScaleState(value);
  }

  function setMessageDisplay(value: string) {
    setMessageDisplayState(value);
  }

  function handleToggleUiV2Tokens(nextEnabled: boolean) {
    setUiV2TokensPreference(nextEnabled);
    setUiV2TokensEnabled(nextEnabled);
    window.location.reload();
  }

  function handleChangeGlassMode(nextMode: UiGlassMode) {
    setUiGlassModePreference(nextMode);
    setUiGlassMode(nextMode);
    applyUiVisualPreferences();
  }

  function handleToggleLowPower(enabled: boolean) {
    setUiLowPowerPreference(enabled);
    setUiLowPower(enabled);
    applyUiVisualPreferences();
  }

  function handleToggleReducedEffects(enabled: boolean) {
    setUiReducedEffectsPreference(enabled);
    setUiReducedEffects(enabled);
    applyUiVisualPreferences();
  }

  function handleChangeSurfaceBackgroundMode(mode: UiSurfaceBackgroundMode) {
    setUiSurfaceBackgroundModePreference(mode);
    setUiSurfaceBackgroundMode(mode);
    applyUiVisualPreferences();
  }

  function handleChangeContentScrim(mode: UiContentScrim) {
    setUiContentScrimPreference(mode);
    setUiContentScrim(mode);
    applyUiVisualPreferences();
  }

  function handleChangeBackgroundStyle(scope: 'portal' | 'channel' | 'dm', mode: UiBackgroundStyle) {
    const key =
      scope === 'portal'
        ? UI_PORTAL_BACKGROUND_STYLE_STORAGE_KEY
        : scope === 'channel'
          ? UI_CHANNEL_BACKGROUND_STYLE_STORAGE_KEY
          : UI_DM_BACKGROUND_STYLE_STORAGE_KEY;
    setUiBackgroundStylePreference(key, mode);
    if (scope === 'portal') setUiPortalBackgroundStyle(mode);
    if (scope === 'channel') setUiChannelBackgroundStyle(mode);
    if (scope === 'dm') setUiDmBackgroundStyle(mode);
    applyUiVisualPreferences();
  }

  function handleResetVisualPreferences() {
    setUiGlassModePreference('subtle');
    setUiSurfaceBackgroundModePreference('contained');
    setUiContentScrimPreference('balanced');
    setUiBackgroundStylePreference(UI_PORTAL_BACKGROUND_STYLE_STORAGE_KEY, 'auto');
    setUiBackgroundStylePreference(UI_CHANNEL_BACKGROUND_STYLE_STORAGE_KEY, 'auto');
    setUiBackgroundStylePreference(UI_DM_BACKGROUND_STYLE_STORAGE_KEY, 'auto');
    setUiLowPowerPreference(false);
    setUiReducedEffectsPreference(false);
    setUiGlassMode('subtle');
    setUiSurfaceBackgroundMode('contained');
    setUiContentScrim('balanced');
    setUiPortalBackgroundStyle('auto');
    setUiChannelBackgroundStyle('auto');
    setUiDmBackgroundStyle('auto');
    setUiLowPower(false);
    setUiReducedEffects(false);
    applyUiVisualPreferences();
  }

  function handleApplyVisualPreset(preset: 'balanced' | 'immersive' | 'performance') {
    if (preset === 'balanced') {
      handleResetVisualPreferences();
      return;
    }
    if (preset === 'immersive') {
      setUiGlassModePreference('full');
      setUiSurfaceBackgroundModePreference('full');
      setUiContentScrimPreference('soft');
      setUiLowPowerPreference(false);
      setUiReducedEffectsPreference(false);
      setUiBackgroundStylePreference(UI_PORTAL_BACKGROUND_STYLE_STORAGE_KEY, 'aurora');
      setUiBackgroundStylePreference(UI_CHANNEL_BACKGROUND_STYLE_STORAGE_KEY, 'mesh');
      setUiBackgroundStylePreference(UI_DM_BACKGROUND_STYLE_STORAGE_KEY, 'aurora');
      setUiGlassMode('full');
      setUiSurfaceBackgroundMode('full');
      setUiContentScrim('soft');
      setUiLowPower(false);
      setUiReducedEffects(false);
      setUiPortalBackgroundStyle('aurora');
      setUiChannelBackgroundStyle('mesh');
      setUiDmBackgroundStyle('aurora');
      applyUiVisualPreferences();
      return;
    }
    setUiGlassModePreference('off');
    setUiSurfaceBackgroundModePreference('contained');
    setUiContentScrimPreference('strong');
    setUiLowPowerPreference(true);
    setUiReducedEffectsPreference(true);
    setUiBackgroundStylePreference(UI_PORTAL_BACKGROUND_STYLE_STORAGE_KEY, 'minimal');
    setUiBackgroundStylePreference(UI_CHANNEL_BACKGROUND_STYLE_STORAGE_KEY, 'minimal');
    setUiBackgroundStylePreference(UI_DM_BACKGROUND_STYLE_STORAGE_KEY, 'minimal');
    setUiGlassMode('off');
    setUiSurfaceBackgroundMode('contained');
    setUiContentScrim('strong');
    setUiLowPower(true);
    setUiReducedEffects(true);
    setUiPortalBackgroundStyle('minimal');
    setUiChannelBackgroundStyle('minimal');
    setUiDmBackgroundStyle('minimal');
    applyUiVisualPreferences();
  }

  function applyThemeManifest(overrides: Record<string, string>, name = themeName) {
    const manifest = { version: DEFAULT_THEME_V2.version, name, overrides };
    const { theme } = resolveThemeV2(manifest);
    setThemeManifestPreference(manifest);
    applyThemeV2(theme);
  }

  function handleThemeOverrideChange(tokenKey: string, value: string) {
    const nextOverrides = { ...themeOverrides, [tokenKey]: value };
    setThemeOverrides(nextOverrides);
    setThemeError('');
    if (uiV2TokensEnabled) {
      applyThemeManifest(nextOverrides);
    }
  }

  function handleApplyThemePreset(preset: (typeof THEME_PRESETS_V3)[number]) {
    const nextOverrides = { ...themeOverrides, ...preset.overrides };
    setThemeName(preset.name);
    setThemeOverrides(nextOverrides);
    setThemeError('');
    if (uiV2TokensEnabled) {
      applyThemeManifest(nextOverrides, preset.name);
    } else {
      setThemeManifestPreference({
        version: DEFAULT_THEME_V2.version,
        name: preset.name,
        overrides: nextOverrides,
      });
    }
  }

  function handleResetTheme() {
    setThemeName(DEFAULT_THEME_V2.name);
    setThemeOverrides({});
    setThemeImportValue('');
    setThemeError('');
    clearThemeManifestPreference();
    if (uiV2TokensEnabled) {
      applyThemeV2(DEFAULT_THEME_V2);
    }
  }

  async function handleExportTheme() {
    const payload = {
      version: DEFAULT_THEME_V2.version,
      name: themeName.trim() || DEFAULT_THEME_V2.name,
      overrides: themeOverrides,
    };
    const serialized = JSON.stringify(payload, null, 2);
    await navigator.clipboard.writeText(serialized);
    setThemeImportValue(serialized);
  }

  function handleImportTheme() {
    setThemeError('');
    try {
      const parsed = JSON.parse(themeImportValue) as {
        version?: string;
        name?: string;
        overrides?: Record<string, string>;
      };
      const nextName = (parsed.name ?? DEFAULT_THEME_V2.name).trim() || DEFAULT_THEME_V2.name;
      const nextOverrides = parsed.overrides ?? {};
      setThemeName(nextName);
      setThemeOverrides(nextOverrides);
      if (uiV2TokensEnabled) {
        applyThemeManifest(nextOverrides, nextName);
      } else {
        setThemeManifestPreference({
          version: parsed.version ?? DEFAULT_THEME_V2.version,
          name: nextName,
          overrides: nextOverrides,
        });
      }
    } catch (err) {
      setThemeError(getErrorMessage(err));
    }
  }

  // Helper to render a custom toggle switch
  function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
    return (
      <label style={s.toggleLabel}>
        <input
          type="checkbox"
          style={s.toggleInput}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span style={s.toggleIndicator(checked)} />
        <span style={s.toggleThumb(checked)} />
      </label>
    );
  }

  return (
    <section style={s.section}>
      <h2 style={s.heading}>Appearance</h2>
      <div style={s.card}>
        {/* Color Mode */}
        <div style={s.field}>
          <div style={s.fieldLabel}>Color Mode</div>
          <div style={s.fieldRow}>
            {(['light', 'dark', 'system'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                style={s.colorModeBtn(colorMode === mode)}
                onClick={() => {
                  setUiColorModePreference(mode);
                  setColorMode(mode);
                  applyColorMode();
                  // Re-apply V2 tokens to respect light/dark token filtering
                  if (shouldEnableUiV2Tokens()) {
                    const { theme } = resolveThemeV2(readThemeManifestPreference() ?? undefined);
                    applyThemeV2(theme);
                  }
                  api.users.updateSettings({ theme: mode }).catch(() => undefined);
                }}
              >
                {mode === 'light' && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                )}
                {mode === 'dark' && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
                {mode === 'system' && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                )}
                <span>{mode.charAt(0).toUpperCase() + mode.slice(1)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Visual Presets */}
        <div style={s.field}>
          <div style={s.fieldLabel}>Visual Presets</div>
          <div style={s.fieldRow}>
            <Button variant="ghost" onClick={() => handleApplyVisualPreset('balanced')}>Balanced</Button>
            <Button variant="ghost" onClick={() => handleApplyVisualPreset('immersive')}>Immersive</Button>
            <Button variant="ghost" onClick={() => handleApplyVisualPreset('performance')}>Performance</Button>
            <Button variant="ghost" onClick={handleResetVisualPreferences}>Reset Visuals</Button>
          </div>
        </div>

        {/* Message Density */}
        <div style={s.field}>
          <div style={s.fieldLabel}>Message Density</div>
          <div style={s.fieldControl}>
            <select
              style={s.select}
              value={messageDisplay}
              onChange={(event) => setMessageDisplay(event.target.value)}
            >
              <option value="cozy">Cozy</option>
              <option value="compact">Compact</option>
            </select>
          </div>
        </div>

        {/* Font Scale */}
        <div style={s.field}>
          <div style={s.fieldLabel}>Font Scale</div>
          <div style={s.fieldControl}>
            <input
              style={s.rangeInput}
              type="range"
              min="0.8"
              max="1.4"
              step="0.05"
              value={fontScale}
              onChange={(event) => setFontScale(Number(event.target.value))}
            />
            <span style={s.rangeValue as React.CSSProperties}>{fontScale.toFixed(2)}x</span>
          </div>
        </div>

        {/* Modern UI Preview */}
        <div style={s.field}>
          <div style={s.fieldLabel}>Modern UI Preview</div>
          <div style={s.fieldControl}>
            <Toggle checked={uiV2TokensEnabled} onChange={handleToggleUiV2Tokens} />
            <span style={s.rangeValue as React.CSSProperties}>{uiV2TokensEnabled ? 'On' : 'Off'}</span>
          </div>
        </div>

        {/* Glass Mode */}
        <div style={s.field}>
          <div style={s.fieldLabel}>Glass Mode</div>
          <div style={s.fieldControl}>
            <select
              style={s.select}
              value={uiGlassMode}
              onChange={(event) => handleChangeGlassMode(event.target.value as UiGlassMode)}
            >
              <option value="off">Off</option>
              <option value="subtle">Subtle</option>
              <option value="full">Full</option>
            </select>
          </div>
        </div>

        {/* Surface Background Mode */}
        <div style={s.field}>
          <div style={s.fieldLabel}>Surface Background Mode</div>
          <div style={s.fieldControl}>
            <select
              style={s.select}
              value={uiSurfaceBackgroundMode}
              onChange={(event) => handleChangeSurfaceBackgroundMode(event.target.value as UiSurfaceBackgroundMode)}
            >
              <option value="contained">Contained</option>
              <option value="full">Full Surface</option>
            </select>
          </div>
        </div>

        {/* Content Scrim */}
        <div style={s.field}>
          <div style={s.fieldLabel}>Content Scrim</div>
          <div style={s.fieldControl}>
            <select
              style={s.select}
              value={uiContentScrim}
              onChange={(event) => handleChangeContentScrim(event.target.value as UiContentScrim)}
            >
              <option value="soft">Soft</option>
              <option value="balanced">Balanced</option>
              <option value="strong">Strong</option>
            </select>
          </div>
        </div>

        {/* Portal Background Style */}
        <div style={s.field}>
          <div style={s.fieldLabel}>Portal Background Style</div>
          <div style={s.fieldControl}>
            <select
              style={s.select}
              value={uiPortalBackgroundStyle}
              onChange={(event) => handleChangeBackgroundStyle('portal', event.target.value as UiBackgroundStyle)}
            >
              <option value="auto">Auto</option>
              <option value="aurora">Aurora</option>
              <option value="mesh">Mesh</option>
              <option value="minimal">Minimal</option>
            </select>
          </div>
        </div>

        {/* Channel Background Style */}
        <div style={s.field}>
          <div style={s.fieldLabel}>Channel Background Style</div>
          <div style={s.fieldControl}>
            <select
              style={s.select}
              value={uiChannelBackgroundStyle}
              onChange={(event) => handleChangeBackgroundStyle('channel', event.target.value as UiBackgroundStyle)}
            >
              <option value="auto">Auto</option>
              <option value="aurora">Aurora</option>
              <option value="mesh">Mesh</option>
              <option value="minimal">Minimal</option>
            </select>
          </div>
        </div>

        {/* DM Background Style */}
        <div style={s.field}>
          <div style={s.fieldLabel}>DM Background Style</div>
          <div style={s.fieldControl}>
            <select
              style={s.select}
              value={uiDmBackgroundStyle}
              onChange={(event) => handleChangeBackgroundStyle('dm', event.target.value as UiBackgroundStyle)}
            >
              <option value="auto">Auto</option>
              <option value="aurora">Aurora</option>
              <option value="mesh">Mesh</option>
              <option value="minimal">Minimal</option>
            </select>
          </div>
        </div>

        {/* Low Power Mode */}
        <div style={s.field}>
          <div style={s.fieldLabel}>Low Power Mode</div>
          <div style={s.fieldControl}>
            <Toggle checked={uiLowPower} onChange={handleToggleLowPower} />
            <span style={s.rangeValue as React.CSSProperties}>{uiLowPower ? 'On' : 'Off'}</span>
          </div>
        </div>

        {/* Reduced Effects */}
        <div style={s.field}>
          <div style={s.fieldLabel}>Reduced Effects</div>
          <div style={s.fieldControl}>
            <Toggle checked={uiReducedEffects} onChange={handleToggleReducedEffects} />
            <span style={s.rangeValue as React.CSSProperties}>{uiReducedEffects ? 'On' : 'Off'}</span>
          </div>
        </div>

        {/* Note */}
        <div style={s.note}>
          Background and scrim settings affect message surfaces in portals, DMs, and voice chat panels to preserve readability while keeping custom visual style.
        </div>

        {/* Theme Studio */}
        <div style={s.themeEditor}>
          <div style={s.themeHeader}>
            <h3 style={s.themeTitle}>Theme Studio (v1)</h3>
            <p style={s.muted}>
              Customize core theme tokens and share by exporting/importing JSON.
            </p>
          </div>
          <div style={s.themePresets}>
            {THEME_PRESETS_V3.map((preset) => (
              <button
                key={preset.name}
                type="button"
                style={s.themePresetBtn}
                onClick={() => handleApplyThemePreset(preset)}
              >
                <span style={s.themePresetName}>{preset.name}</span>
                <span style={s.themePresetDesc}>{preset.description}</span>
              </button>
            ))}
          </div>
          <div style={s.field}>
            <div style={s.fieldLabel}>Theme Name</div>
            <div style={s.fieldControl}>
              <Input
                type="text"
                value={themeName}
                onChange={(event) => setThemeName(event.target.value)}
                placeholder="My Theme"
              />
            </div>
          </div>
          <div style={s.themeGrid}>
            {THEME_TOKEN_CONTROLS.map((token) => {
              const value = themeOverrides[token.key] ?? DEFAULT_THEME_V2.tokens[token.key] ?? '';
              return (
                <label key={token.key} style={s.themeField}>
                  <span style={s.themeLabel}>{token.label}</span>
                  {token.type === 'color' ? (
                    <input
                      type="color"
                      value={value}
                      onChange={(event) => handleThemeOverrideChange(token.key, event.target.value)}
                    />
                  ) : (
                    <Input
                      type="text"
                      value={value}
                      onChange={(event) => handleThemeOverrideChange(token.key, event.target.value)}
                    />
                  )}
                </label>
              );
            })}
          </div>
          <div style={s.themeActions}>
            <Button type="button" onClick={() => applyThemeManifest(themeOverrides)}>
              Apply
            </Button>
            <Button type="button" variant="ghost" onClick={handleExportTheme}>
              Export
            </Button>
            <Button type="button" variant="ghost" onClick={handleImportTheme}>
              Import
            </Button>
            <Button type="button" variant="ghost" onClick={handleResetTheme}>
              Reset
            </Button>
          </div>
          <textarea
            style={s.themeJson}
            value={themeImportValue}
            onChange={(event) => setThemeImportValue(event.target.value)}
            placeholder='Paste a theme JSON payload here, then click "Import".'
            rows={6}
          />
          {themeError && <div style={s.error}>{themeError}</div>}
        </div>
      </div>
    </section>
  );
}
