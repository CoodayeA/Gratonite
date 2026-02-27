// apps/web/src/components/settings/sections/user/AppearanceSection.tsx
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  BUILT_IN_THEMES,
  applyTheme,
  getCurrentThemeId,
  type Theme,
} from '@/lib/themes';
import { ThemeCard } from '@/components/ui/ThemeCard';
import {
  applyUiVisualPreferences,
  readUiColorModePreference,
  setUiColorModePreference,
  applyColorMode,
  readUiGlassModePreference,
  setUiGlassModePreference,
  readUiLowPowerPreference,
  setUiLowPowerPreference,
  readUiReducedEffectsPreference,
  setUiReducedEffectsPreference,
  type UiColorMode,
  type UiGlassMode,
} from '@/theme/initTheme';

// ─── Styles (CSS vars only — no hardcoded hex) ────────────────────────────

const s: Record<string, React.CSSProperties> = {
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 32,
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    paddingBottom: 16,
    borderBottom: '1px solid var(--stroke)',
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--text)',
    margin: 0,
    fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
  },
  subtitle: {
    fontSize: 13,
    color: 'var(--text-muted)',
    margin: 0,
  },
  group: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  groupLabel: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    color: 'var(--text-faint)',
    margin: 0,
  },
  card: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--stroke)',
    borderRadius: 10,
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  rowLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    flex: 1,
  },
  rowLabelText: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text)',
  },
  rowLabelDesc: {
    fontSize: 12,
    color: 'var(--text-muted)',
  },
  // Theme grid
  themeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 12,
  },
  browseLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 13,
    color: 'var(--accent)',
    textDecoration: 'none',
    fontWeight: 500,
  },
  // Accent picker row
  accentRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap' as const,
  },
  accentSwatch: {
    width: 32,
    height: 32,
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--stroke)',
    cursor: 'pointer',
    flexShrink: 0,
  },
  accentLabel: {
    fontSize: 13,
    color: 'var(--text-muted)',
    flex: 1,
  },
  resetBtn: {
    fontSize: 12,
    color: 'var(--text-faint)',
    background: 'none',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-sm)',
    padding: '4px 10px',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  // Toggle
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  // Color mode pills
  modePills: {
    display: 'flex',
    gap: 6,
  },
};

function modePill(active: boolean): React.CSSProperties {
  return {
    padding: '5px 14px',
    borderRadius: 'var(--radius-pill)',
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    border: `1px solid ${active ? 'var(--accent)' : 'var(--stroke)'}`,
    background: active ? 'rgba(212,175,55,0.12)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--text-muted)',
    cursor: 'pointer',
  };
}

// ─── Toggle component ─────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative',
        width: 40,
        height: 22,
        borderRadius: 'var(--radius-lg)',
        border: 'none',
        background: checked ? 'var(--accent)' : 'var(--bg-soft)',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background 0.2s',
      }}
    >
      <span style={{
        position: 'absolute',
        top: 2,
        left: checked ? 20 : 2,
        width: 18,
        height: 18,
        borderRadius: '50%',
        background: checked ? 'var(--bg-float)' : 'var(--text-muted)',
        transition: 'left 0.2s',
      }} />
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────

export function AppearanceSection() {
  const [appliedId, setAppliedId] = useState<string | null>(getCurrentThemeId);
  const [colorMode, setColorModeState] = useState<UiColorMode>(readUiColorModePreference);
  const [glassMode, setGlassModeState] = useState<UiGlassMode>(readUiGlassModePreference);
  const [lowPower, setLowPowerState] = useState<boolean>(readUiLowPowerPreference);
  const [reducedEffects, setReducedEffectsState] = useState<boolean>(readUiReducedEffectsPreference);
  // Custom accent override (persisted separately from the full theme)
  const [customAccent, setCustomAccent] = useState<string>(() => {
    return localStorage.getItem('gratonite_accent_override') ?? '';
  });

  // Re-read applied theme id whenever the section mounts (user may have
  // applied a theme from the Discover page in a different tab)
  useEffect(() => {
    setAppliedId(getCurrentThemeId());
  }, []);

  const handleApplyTheme = useCallback((theme: Theme) => {
    applyTheme(theme);
    setAppliedId(theme.id);
    // Clear any accent override so the theme's native accent shows
    setCustomAccent('');
    localStorage.removeItem('gratonite_accent_override');
  }, []);

  function handleAccentChange(value: string) {
    setCustomAccent(value);
    const root = document.documentElement;
    root.style.setProperty('--accent', value);
    root.style.setProperty('--accent-2', value);
    try {
      localStorage.setItem('gratonite_accent_override', value);
    } catch {}
  }

  function handleResetAccent() {
    setCustomAccent('');
    localStorage.removeItem('gratonite_accent_override');
    // Restore the active theme's accent
    const active = BUILT_IN_THEMES.find(t => t.id === appliedId);
    if (active) {
      document.documentElement.style.setProperty('--accent', active.vars['--accent']);
      document.documentElement.style.setProperty('--accent-2', active.vars['--accent-2']);
    }
  }

  function handleColorMode(mode: UiColorMode) {
    setColorModeState(mode);
    setUiColorModePreference(mode);
    applyColorMode();
  }

  function handleGlassMode(mode: UiGlassMode) {
    setGlassModeState(mode);
    setUiGlassModePreference(mode);
    applyUiVisualPreferences();
  }

  function handleLowPower(val: boolean) {
    setLowPowerState(val);
    setUiLowPowerPreference(val);
    applyUiVisualPreferences();
  }

  function handleReducedEffects(val: boolean) {
    setReducedEffectsState(val);
    setUiReducedEffectsPreference(val);
    applyUiVisualPreferences();
  }

  return (
    <section style={s['section']}>
      <div style={s['header']}>
        <h2 style={s['title']}>Appearance</h2>
        <p style={s['subtitle']}>Customise how Gratonite looks for you.</p>
      </div>

      {/* ── Theme ───────────────────────────────────────────────────────── */}
      <div style={s['group']}>
        <h3 style={s['groupLabel']}>Theme</h3>
        <div style={s['themeGrid']}>
          {BUILT_IN_THEMES.map(theme => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              appliedId={appliedId}
              onApply={handleApplyTheme}
            />
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link to="/discover?tab=themes" style={s['browseLink']}>
            Explore more themes →
          </Link>
          <Link
            to="/themes/create"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              height: 30,
              padding: '0 12px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent)',
              color: '#1a1a2e',
              fontSize: 12,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            + Create Theme
          </Link>
        </div>
      </div>

      {/* ── Accent colour ───────────────────────────────────────────────── */}
      <div style={s['group']}>
        <h3 style={s['groupLabel']}>Accent Colour</h3>
        <div style={s['card']}>
          <div style={s['row']}>
            <div style={s['rowLabel']}>
              <span style={s['rowLabelText']}>Custom accent</span>
              <span style={s['rowLabelDesc']}>
                Override the accent colour on top of the selected theme.
              </span>
            </div>
            <div style={s['accentRow']}>
              <input
                type="color"
                value={customAccent || '#d4af37'}
                onChange={e => handleAccentChange(e.target.value)}
                style={s['accentSwatch']}
                title="Pick accent colour"
              />
              {customAccent && (
                <button type="button" style={s['resetBtn']} onClick={handleResetAccent}>
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Colour mode ────────────────────────────────────────────────── */}
      <div style={s['group']}>
        <h3 style={s['groupLabel']}>Colour Mode</h3>
        <div style={s['card']}>
          <div style={s['row']}>
            <div style={s['rowLabel']}>
              <span style={s['rowLabelText']}>Mode</span>
              <span style={s['rowLabelDesc']}>Light, dark, or follow system preference.</span>
            </div>
            <div style={s['modePills']}>
              {(['light', 'dark', 'system'] as UiColorMode[]).map(m => (
                <button
                  key={m}
                  type="button"
                  style={modePill(colorMode === m)}
                  onClick={() => handleColorMode(m)}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Visual effects ──────────────────────────────────────────────── */}
      <div style={s['group']}>
        <h3 style={s['groupLabel']}>Visual Effects</h3>
        <div style={s['card']}>
          <div style={s['toggleRow']}>
            <div style={s['rowLabel']}>
              <span style={s['rowLabelText']}>Glass surfaces</span>
              <span style={s['rowLabelDesc']}>Frosted glass effect on panels and sidebars.</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['off', 'subtle', 'full'] as UiGlassMode[]).map(m => (
                <button
                  key={m}
                  type="button"
                  style={modePill(glassMode === m)}
                  onClick={() => handleGlassMode(m)}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div style={s['toggleRow']}>
            <div style={s['rowLabel']}>
              <span style={s['rowLabelText']}>Reduced effects</span>
              <span style={s['rowLabelDesc']}>Disable animations and blur effects.</span>
            </div>
            <Toggle checked={reducedEffects} onChange={handleReducedEffects} />
          </div>

          <div style={s['toggleRow']}>
            <div style={s['rowLabel']}>
              <span style={s['rowLabelText']}>Low power mode</span>
              <span style={s['rowLabelDesc']}>Reduces background rendering for battery life.</span>
            </div>
            <Toggle checked={lowPower} onChange={handleLowPower} />
          </div>
        </div>
      </div>
    </section>
  );
}
