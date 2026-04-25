/**
 * ThemePicker — full Portal customization UI: vibe, accent, background,
 * planet, density, font, animations, custom image, presets save/load.
 *
 * Owners save to guild default. Members save to their personal override.
 * Selecting/changing controls updates a live preview via setPreview() but
 * does NOT save until the user clicks Save.
 */
import { useEffect, useState } from 'react';
import { Save, RotateCcw, Trash2, Bookmark } from 'lucide-react';
import { usePortalTheme } from './themes/PortalThemeProvider';
import { portalThemeApi, PortalThemePresetRow } from './themes/api';
import {
  PortalTheme,
  PortalVibe,
  PortalBackgroundStyle,
  PortalPlanetStyle,
  PortalDensity,
  PortalFontPersonality,
  PortalAnimations,
  SYSTEM_DEFAULT_THEME,
  parseAccent,
} from './themes/types';

const VIBES: { id: PortalVibe; label: string; sub: string }[] = [
  { id: 'holographic', label: 'Holographic', sub: 'Floating planet, glassy quests' },
  { id: 'solar-system', label: 'Solar System', sub: 'Orbiting planet quests' },
  { id: 'liquid-lava', label: 'Liquid Lava', sub: 'Organic blobs, warm flow' },
  { id: 'iso-city', label: 'Iso City', sub: 'Isometric tower district' },
];

const BG_STYLES: PortalBackgroundStyle[] = [
  'deep-space',
  'aurora',
  'solid',
  'animated-grid',
  'liquid-blobs',
  'custom-image',
];

const PLANETS: PortalPlanetStyle[] = ['green', 'violet', 'amber', 'azure', 'rose', 'mono', 'custom'];
const PLANET_SWATCH: Record<PortalPlanetStyle, string> = {
  green: '#5cf09a',
  violet: '#b785ff',
  amber: '#ffb84d',
  azure: '#5fc7ff',
  rose: '#ff7aa2',
  mono: '#cccccc',
  custom: 'transparent',
};

const ACCENT_PRESETS = [
  '#00ff88',
  '#5fc7ff',
  '#b785ff',
  '#ff7aa2',
  '#ffb84d',
  '#ffffff',
  '#526df5',
  '#ff4d4d',
];

interface Props {
  /** Whose theme are we editing? */
  scope: 'guildDefault' | 'memberOverride';
  onClose?: () => void;
}

export function ThemePicker({ scope, onClose }: Props) {
  const ctx = usePortalTheme();
  const [draft, setDraft] = useState<PortalTheme>(() => {
    const initial =
      scope === 'guildDefault'
        ? ctx.guildDefault ?? SYSTEM_DEFAULT_THEME
        : ctx.memberOverride ?? ctx.guildDefault ?? SYSTEM_DEFAULT_THEME;
    return { ...initial };
  });
  const [saving, setSaving] = useState(false);
  const [presets, setPresets] = useState<PortalThemePresetRow[]>([]);
  const [presetName, setPresetName] = useState('');
  const [savingPreset, setSavingPreset] = useState(false);

  // Live preview
  useEffect(() => {
    ctx.setPreview(draft);
    return () => ctx.setPreview(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  // Load presets
  useEffect(() => {
    portalThemeApi
      .listPresets(ctx.guildId)
      .then((r) => setPresets(r.presets))
      .catch(() => {});
  }, [ctx.guildId]);

  const update = <K extends keyof PortalTheme>(key: K, value: PortalTheme[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      if (scope === 'guildDefault') await ctx.saveGuildDefault(draft);
      else await ctx.saveMemberOverride(draft);
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  const reset = () => setDraft({ ...SYSTEM_DEFAULT_THEME });

  const clearOverride = async () => {
    await ctx.clearMemberOverride();
    onClose?.();
  };

  const savePreset = async () => {
    if (!presetName.trim()) return;
    setSavingPreset(true);
    try {
      const r = await portalThemeApi.savePreset(ctx.guildId, presetName.trim(), draft);
      setPresets((list) => [...list.filter((p) => p.id !== r.preset.id), r.preset]);
      setPresetName('');
    } finally {
      setSavingPreset(false);
    }
  };

  const applyPreset = (p: PortalThemePresetRow) => setDraft({ ...p.theme });
  const deletePreset = async (id: string) => {
    await portalThemeApi.deletePreset(ctx.guildId, id);
    setPresets((list) => list.filter((p) => p.id !== id));
  };

  const accentParsed = parseAccent(draft.accentColor);
  const isCustomAccent = !ACCENT_PRESETS.includes(draft.accentColor);

  return (
    <div className="theme-picker">
      <header className="theme-picker-head">
        <div>
          <h2>Portal customization</h2>
          <p className="theme-picker-sub">
            {scope === 'guildDefault'
              ? "You're editing the guild default — every member sees this unless they override."
              : "You're editing your personal view of this portal."}
          </p>
        </div>
        {onClose ? (
          <button className="theme-picker-close" onClick={onClose} aria-label="Close picker">
            ×
          </button>
        ) : null}
      </header>

      <Section label="Vibe" hint="The overall layout and feel.">
        <div className="theme-picker-vibes">
          {VIBES.map((v) => (
            <button
              key={v.id}
              type="button"
              className={`theme-picker-vibe-card ${draft.vibe === v.id ? 'is-active' : ''}`}
              onClick={() => update('vibe', v.id)}
            >
              <div className={`theme-picker-vibe-thumb thumb-${v.id}`} />
              <div className="theme-picker-vibe-label">{v.label}</div>
              <div className="theme-picker-vibe-sub">{v.sub}</div>
            </button>
          ))}
        </div>
      </Section>

      <Section label="Accent color">
        <div className="theme-picker-swatches">
          {ACCENT_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              className={`theme-picker-swatch ${draft.accentColor === c ? 'is-active' : ''}`}
              style={{ background: c }}
              onClick={() => update('accentColor', c)}
              aria-label={`Accent ${c}`}
            />
          ))}
          <label className="theme-picker-swatch theme-picker-swatch-custom" title="Custom hex">
            <input
              type="color"
              value={accentParsed.from}
              onChange={(e) => update('accentColor', e.target.value)}
            />
            <span style={{ background: isCustomAccent ? draft.accentColor : 'transparent' }} />
          </label>
        </div>
      </Section>

      <Section label="Background">
        <div className="theme-picker-grid-3">
          {BG_STYLES.map((b) => (
            <button
              key={b}
              type="button"
              className={`theme-picker-bg-card bg-${b} ${draft.backgroundStyle === b ? 'is-active' : ''}`}
              onClick={() => update('backgroundStyle', b)}
            >
              <span>{b.replace(/-/g, ' ')}</span>
            </button>
          ))}
        </div>
        {draft.backgroundStyle === 'custom-image' ? (
          <input
            type="url"
            placeholder="https://… image URL"
            value={draft.customBackgroundUrl ?? ''}
            onChange={(e) => update('customBackgroundUrl', e.target.value || null)}
            className="theme-picker-input"
          />
        ) : null}
      </Section>

      <Section label="Planet style">
        <div className="theme-picker-swatches">
          {PLANETS.map((p) => (
            <button
              key={p}
              type="button"
              className={`theme-picker-planet ${draft.planetStyle === p ? 'is-active' : ''}`}
              style={{ background: PLANET_SWATCH[p] }}
              onClick={() => update('planetStyle', p)}
              aria-label={p}
              title={p}
            >
              {p === 'custom' ? '+' : ''}
            </button>
          ))}
        </div>
        {draft.planetStyle === 'custom' ? (
          <input
            type="url"
            placeholder="https://… planet image"
            value={draft.customPlanetUrl ?? ''}
            onChange={(e) => update('customPlanetUrl', e.target.value || null)}
            className="theme-picker-input"
          />
        ) : null}
      </Section>

      <Section label="Density">
        <Segmented
          value={draft.density}
          options={[
            { id: 'cozy', label: 'Cozy' },
            { id: 'comfortable', label: 'Comfortable' },
            { id: 'compact', label: 'Compact' },
          ]}
          onChange={(v) => update('density', v as PortalDensity)}
        />
      </Section>

      <Section label="Typography">
        <Segmented
          value={draft.fontPersonality}
          options={[
            { id: 'modern', label: 'Modern' },
            { id: 'editorial', label: 'Editorial' },
            { id: 'builder', label: 'Builder' },
            { id: 'playful', label: 'Playful' },
          ]}
          onChange={(v) => update('fontPersonality', v as PortalFontPersonality)}
        />
      </Section>

      <Section label="Animations">
        <Segmented
          value={draft.animations}
          options={[
            { id: 'on', label: 'Full' },
            { id: 'subtle', label: 'Subtle' },
            { id: 'off', label: 'Off' },
          ]}
          onChange={(v) => update('animations', v as PortalAnimations)}
        />
      </Section>

      {scope === 'guildDefault' ? (
        <Section label="Presets" hint="Save the current setup as a named preset for quick reuse.">
          <div className="theme-picker-preset-form">
            <input
              type="text"
              className="theme-picker-input"
              placeholder="e.g. Founders Council"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              maxLength={80}
            />
            <button
              type="button"
              className="theme-picker-btn"
              disabled={savingPreset || !presetName.trim()}
              onClick={savePreset}
            >
              <Bookmark size={14} /> Save preset
            </button>
          </div>
          {presets.length ? (
            <ul className="theme-picker-preset-list">
              {presets.map((p) => (
                <li key={p.id} className="theme-picker-preset-row">
                  <button
                    type="button"
                    className="theme-picker-preset-apply"
                    onClick={() => applyPreset(p)}
                  >
                    {p.name}
                  </button>
                  <button
                    type="button"
                    className="theme-picker-preset-del"
                    onClick={() => deletePreset(p.id)}
                    aria-label={`Delete preset ${p.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </Section>
      ) : null}

      <footer className="theme-picker-foot">
        <button type="button" className="theme-picker-btn" onClick={reset}>
          <RotateCcw size={14} /> Reset
        </button>
        {scope === 'memberOverride' && ctx.memberOverride ? (
          <button type="button" className="theme-picker-btn" onClick={clearOverride}>
            Use guild default
          </button>
        ) : null}
        <button
          type="button"
          className="theme-picker-btn theme-picker-btn-primary"
          onClick={save}
          disabled={saving}
        >
          <Save size={14} /> {saving ? 'Saving…' : 'Save'}
        </button>
      </footer>
    </div>
  );
}

function Section({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="theme-picker-section">
      <div className="theme-picker-section-head">
        <h3>{label}</h3>
        {hint ? <p>{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { id: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="theme-picker-segmented">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={value === o.id ? 'is-active' : ''}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default ThemePicker;
