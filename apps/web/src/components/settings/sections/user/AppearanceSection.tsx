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

export function AppearanceSection() {
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

  return (
    <section className="settings-section">
      <h2 className="settings-shell-section-heading">Appearance</h2>
      <div className="settings-card">
        <div className="settings-field">
          <div className="settings-field-label">Theme</div>
          <div className="settings-field-value">Dark (default)</div>
        </div>
        <div className="settings-field">
          <div className="settings-field-label">Visual Presets</div>
          <div className="settings-field-control settings-field-row">
            <Button variant="ghost" onClick={() => handleApplyVisualPreset('balanced')}>Balanced</Button>
            <Button variant="ghost" onClick={() => handleApplyVisualPreset('immersive')}>Immersive</Button>
            <Button variant="ghost" onClick={() => handleApplyVisualPreset('performance')}>Performance</Button>
            <Button variant="ghost" onClick={handleResetVisualPreferences}>Reset Visuals</Button>
          </div>
        </div>
        <div className="settings-field">
          <div className="settings-field-label">Message Density</div>
          <div className="settings-field-control">
            <select
              className="settings-select"
              value={messageDisplay}
              onChange={(event) => setMessageDisplay(event.target.value)}
            >
              <option value="cozy">Cozy</option>
              <option value="compact">Compact</option>
            </select>
          </div>
        </div>
        <div className="settings-field">
          <div className="settings-field-label">Font Scale</div>
          <div className="settings-field-control">
            <input
              className="settings-range"
              type="range"
              min="0.8"
              max="1.4"
              step="0.05"
              value={fontScale}
              onChange={(event) => setFontScale(Number(event.target.value))}
            />
            <span className="settings-range-value">{fontScale.toFixed(2)}x</span>
          </div>
        </div>
        <div className="settings-field">
          <div className="settings-field-label">Modern UI Preview</div>
          <div className="settings-field-control">
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={uiV2TokensEnabled}
                onChange={(event) => handleToggleUiV2Tokens(event.target.checked)}
              />
              <span className="settings-toggle-indicator" />
            </label>
            <span className="settings-range-value">{uiV2TokensEnabled ? 'On' : 'Off'}</span>
          </div>
        </div>
        <div className="settings-field">
          <div className="settings-field-label">Glass Mode</div>
          <div className="settings-field-control">
            <select
              className="settings-select"
              value={uiGlassMode}
              onChange={(event) => handleChangeGlassMode(event.target.value as UiGlassMode)}
            >
              <option value="off">Off</option>
              <option value="subtle">Subtle</option>
              <option value="full">Full</option>
            </select>
          </div>
        </div>
        <div className="settings-field">
          <div className="settings-field-label">Surface Background Mode</div>
          <div className="settings-field-control">
            <select
              className="settings-select"
              value={uiSurfaceBackgroundMode}
              onChange={(event) => handleChangeSurfaceBackgroundMode(event.target.value as UiSurfaceBackgroundMode)}
            >
              <option value="contained">Contained</option>
              <option value="full">Full Surface</option>
            </select>
          </div>
        </div>
        <div className="settings-field">
          <div className="settings-field-label">Content Scrim</div>
          <div className="settings-field-control">
            <select
              className="settings-select"
              value={uiContentScrim}
              onChange={(event) => handleChangeContentScrim(event.target.value as UiContentScrim)}
            >
              <option value="soft">Soft</option>
              <option value="balanced">Balanced</option>
              <option value="strong">Strong</option>
            </select>
          </div>
        </div>
        <div className="settings-field">
          <div className="settings-field-label">Portal Background Style</div>
          <div className="settings-field-control">
            <select
              className="settings-select"
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
        <div className="settings-field">
          <div className="settings-field-label">Channel Background Style</div>
          <div className="settings-field-control">
            <select
              className="settings-select"
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
        <div className="settings-field">
          <div className="settings-field-label">DM Background Style</div>
          <div className="settings-field-control">
            <select
              className="settings-select"
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
        <div className="settings-field">
          <div className="settings-field-label">Low Power Mode</div>
          <div className="settings-field-control">
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={uiLowPower}
                onChange={(event) => handleToggleLowPower(event.target.checked)}
              />
              <span className="settings-toggle-indicator" />
            </label>
            <span className="settings-range-value">{uiLowPower ? 'On' : 'Off'}</span>
          </div>
        </div>
        <div className="settings-field">
          <div className="settings-field-label">Reduced Effects</div>
          <div className="settings-field-control">
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={uiReducedEffects}
                onChange={(event) => handleToggleReducedEffects(event.target.checked)}
              />
              <span className="settings-toggle-indicator" />
            </label>
            <span className="settings-range-value">{uiReducedEffects ? 'On' : 'Off'}</span>
          </div>
        </div>
        <div className="settings-note">
          Background and scrim settings affect message surfaces in portals, DMs, and voice chat panels to preserve readability while keeping custom visual style.
        </div>
        <div className="settings-theme-editor">
          <div className="settings-theme-header">
            <h3 className="settings-theme-title">Theme Studio (v1)</h3>
            <p className="settings-muted">
              Customize core theme tokens and share by exporting/importing JSON.
            </p>
          </div>
          <div className="settings-theme-presets">
            {THEME_PRESETS_V3.map((preset) => (
              <button
                key={preset.name}
                type="button"
                className="settings-theme-preset"
                onClick={() => handleApplyThemePreset(preset)}
              >
                <span className="settings-theme-preset-name">{preset.name}</span>
                <span className="settings-theme-preset-desc">{preset.description}</span>
              </button>
            ))}
          </div>
          <div className="settings-field">
            <div className="settings-field-label">Theme Name</div>
            <div className="settings-field-control">
              <Input
                type="text"
                value={themeName}
                onChange={(event) => setThemeName(event.target.value)}
                placeholder="My Theme"
              />
            </div>
          </div>
          <div className="settings-theme-grid">
            {THEME_TOKEN_CONTROLS.map((token) => {
              const value = themeOverrides[token.key] ?? DEFAULT_THEME_V2.tokens[token.key] ?? '';
              return (
                <label key={token.key} className="settings-theme-field">
                  <span className="settings-theme-label">{token.label}</span>
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
          <div className="settings-theme-actions">
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
            className="settings-theme-json"
            value={themeImportValue}
            onChange={(event) => setThemeImportValue(event.target.value)}
            placeholder='Paste a theme JSON payload here, then click "Import".'
            rows={6}
          />
          {themeError && <div className="settings-error">{themeError}</div>}
        </div>
      </div>
    </section>
  );
}
