/**
 * ThemeEditorModal — Visual theme creator/editor (Items 26-29).
 * Split view: left side = grouped color pickers, right side = live preview.
 * Supports starting from an existing theme (Item 27).
 * Shows color harmony suggestions (Item 28) and WCAG contrast checking (Item 29).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Save, ChevronDown, Check, AlertTriangle, Info } from 'lucide-react';
import { useTheme } from '../ui/ThemeProvider';
import { useToast } from '../ui/ToastManager';
import { saveCustomTheme, getAllThemesIncludingCustom, resolveTheme } from '../../themes/registry';
import type { ThemeDefinition, ThemeVariables, ThemeCategory } from '../../themes/types';
import { applyThemeSync } from '../../themes/injector';
import { getColorHarmonies, contrastRatio, wcagLevel, isValidHexColor, hexToHsl, hslToHex } from '../../themes/colorUtils';
import { api } from '../../lib/api';

interface ThemeEditorModalProps {
  onClose: () => void;
  /** If editing an existing custom theme, pass its ID */
  editingThemeId?: string;
}

// Groups for the variable editor
const VARIABLE_GROUPS: { label: string; keys: (keyof ThemeVariables)[]; description: string }[] = [
  {
    label: 'Backgrounds',
    description: 'Surface colors for different UI layers',
    keys: ['bgApp', 'bgSidebar', 'bgChannel', 'bgRail', 'bgPrimary', 'bgElevated', 'bgTertiary'],
  },
  {
    label: 'Text',
    description: 'Text color hierarchy',
    keys: ['textPrimary', 'textSecondary', 'textMuted'],
  },
  {
    label: 'Accents',
    description: 'Brand and highlight colors',
    keys: ['accentPrimary', 'accentHover', 'accentBlue', 'accentBluelight', 'accentPurple', 'accentPink', 'accentPrimaryAlpha'],
  },
  {
    label: 'Borders & Overlays',
    description: 'Dividers, strokes, and hover states',
    keys: ['stroke', 'strokeLight', 'strokeSubtle', 'hoverOverlay', 'activeOverlay'],
  },
  {
    label: 'Effects',
    description: 'Shadows, blur, and structural borders',
    keys: ['borderStructural', 'borderFocused', 'shadowPanel', 'shadowHover', 'panelBlur'],
  },
  {
    label: 'Semantic',
    description: 'Success, error, and warning colors',
    keys: ['success', 'error', 'warning'],
  },
  {
    label: 'Radii',
    description: 'Border radius values',
    keys: ['radiusSm', 'radiusMd', 'radiusLg', 'radiusXl'],
  },
];

// Keys that use color pickers (hex colors)
const COLOR_KEYS = new Set<string>([
  'bgApp', 'bgSidebar', 'bgChannel', 'bgRail', 'bgPrimary', 'bgElevated', 'bgTertiary',
  'textPrimary', 'textSecondary', 'textMuted',
  'accentPrimary', 'accentHover', 'accentBlue', 'accentBluelight', 'accentPurple', 'accentPink',
  'success', 'error', 'warning',
]);

// Friendly labels for variable keys
const KEY_LABELS: Record<string, string> = {
  bgApp: 'App Background',
  bgSidebar: 'Sidebar',
  bgChannel: 'Channel Area',
  bgRail: 'Server Rail',
  bgPrimary: 'Primary Surface',
  bgElevated: 'Elevated Surface',
  bgTertiary: 'Tertiary Surface',
  textPrimary: 'Primary Text',
  textSecondary: 'Secondary Text',
  textMuted: 'Muted Text',
  accentPrimary: 'Primary Accent',
  accentHover: 'Accent Hover',
  accentBlue: 'Blue',
  accentBluelight: 'Light Blue',
  accentPurple: 'Purple',
  accentPink: 'Pink',
  accentPrimaryAlpha: 'Accent Alpha',
  stroke: 'Stroke',
  strokeLight: 'Light Stroke',
  strokeSubtle: 'Subtle Stroke',
  hoverOverlay: 'Hover Overlay',
  activeOverlay: 'Active Overlay',
  borderStructural: 'Structural Border',
  borderFocused: 'Focused Border',
  shadowPanel: 'Panel Shadow',
  shadowHover: 'Hover Shadow',
  panelBlur: 'Panel Blur',
  success: 'Success',
  error: 'Error',
  warning: 'Warning',
  radiusSm: 'Small',
  radiusMd: 'Medium',
  radiusLg: 'Large',
  radiusXl: 'Extra Large',
};

/** Extract a simple hex color from a CSS value if possible */
function extractHex(val: string): string {
  const match = val.match(/#([0-9a-fA-F]{3,6})/);
  return match ? `#${match[1]}` : '#000000';
}

function getDefaultDarkVars(): ThemeVariables {
  const def = resolveTheme('default');
  return def ? { ...def.dark } : {} as ThemeVariables;
}

export default function ThemeEditorModal({ onClose, editingThemeId }: ThemeEditorModalProps) {
  const { setTheme, colorMode } = useTheme();
  const toast = useToast();

  // Theme metadata
  const [themeName, setThemeName] = useState('My Custom Theme');
  const [themeDescription, setThemeDescription] = useState('');
  const [themeCategory, setThemeCategory] = useState<ThemeCategory>('dark');
  const [themeIsDark, setThemeIsDark] = useState(true);

  // The variables being edited (dark mode)
  const [darkVars, setDarkVars] = useState<ThemeVariables>(getDefaultDarkVars);
  const [lightVars, setLightVars] = useState<ThemeVariables>(() => {
    const def = resolveTheme('default');
    return def ? { ...def.light } : {} as ThemeVariables;
  });

  // Which mode we're editing
  const [editingMode, setEditingMode] = useState<'dark' | 'light'>('dark');
  const activeVars = editingMode === 'dark' ? darkVars : lightVars;
  const setActiveVars = editingMode === 'dark' ? setDarkVars : setLightVars;

  // Start from existing theme dropdown
  const [baseThemeId, setBaseThemeId] = useState<string>('default');
  const allThemes = getAllThemesIncludingCustom();

  // Expanded groups
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Backgrounds', 'Text', 'Accents']));

  // Harmony suggestions
  const [showHarmony, setShowHarmony] = useState(false);
  const harmonies = getColorHarmonies(activeVars.accentPrimary || '#5865f2');

  // Existing theme ID for edits
  const existingId = useRef(editingThemeId || `custom-${Date.now()}`);

  // Load existing theme if editing
  useEffect(() => {
    if (editingThemeId) {
      const existing = resolveTheme(editingThemeId);
      if (existing) {
        setThemeName(existing.name);
        setThemeDescription(existing.description);
        setThemeCategory(existing.category);
        setThemeIsDark(existing.isDark);
        setDarkVars({ ...existing.dark });
        setLightVars({ ...existing.light });
        setBaseThemeId(editingThemeId);
      }
    }
  }, [editingThemeId]);

  // Live preview: apply current vars to document
  useEffect(() => {
    const vars = editingMode === 'dark' ? darkVars : lightVars;
    if (vars.bgApp) {
      applyThemeSync(vars);
    }
    return () => {
      // On unmount, revert to current theme (handled by ThemeProvider)
    };
  }, [darkVars, lightVars, editingMode]);

  const handleBaseThemeChange = useCallback((id: string) => {
    setBaseThemeId(id);
    const t = resolveTheme(id);
    if (t) {
      setDarkVars({ ...t.dark });
      setLightVars({ ...t.light });
      setThemeIsDark(t.isDark);
      setThemeCategory(t.category);
    }
  }, []);

  const handleVarChange = useCallback((key: keyof ThemeVariables, value: string) => {
    setActiveVars((prev: ThemeVariables) => ({ ...prev, [key]: value }));
  }, [setActiveVars]);

  const toggleGroup = useCallback((label: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!themeName.trim()) {
      toast.addToast('Please enter a theme name', 'error');
      return;
    }

    const themeId = existingId.current;
    const themeDef: ThemeDefinition = {
      id: themeId,
      name: themeName.trim(),
      description: themeDescription.trim() || `Custom theme by you`,
      category: themeCategory,
      author: 'You',
      isDark: themeIsDark,
      preview: {
        bg: darkVars.bgApp || '#111214',
        sidebar: darkVars.bgSidebar || '#1a1b1e',
        accent: darkVars.accentPrimary || '#5865f2',
        text: darkVars.textSecondary || '#b5bac1',
      },
      dark: { ...darkVars, colorScheme: 'dark' },
      light: { ...lightVars, colorScheme: 'light' },
    };

    // Save locally
    saveCustomTheme(themeDef);

    // Also save to server (best effort)
    try {
      const varsForApi: Record<string, string> = {};
      for (const [k, v] of Object.entries(darkVars)) {
        varsForApi[`dark.${k}`] = String(v);
      }
      for (const [k, v] of Object.entries(lightVars)) {
        varsForApi[`light.${k}`] = String(v);
      }
      await api.themes.create({
        name: themeDef.name,
        description: themeDef.description,
        tags: [themeCategory],
        vars: varsForApi,
      });
    } catch {
      // Server save failed — local save is still valid
    }

    // Apply the theme
    setTheme(themeId);
    toast.addToast(`Theme "${themeName}" saved!`, 'success');
    onClose();
  }, [themeName, themeDescription, themeCategory, themeIsDark, darkVars, lightVars, setTheme, toast, onClose]);

  // Contrast pairs to check
  const contrastPairs = [
    { label: 'Primary text on App BG', fg: 'textPrimary', bg: 'bgApp' },
    { label: 'Secondary text on App BG', fg: 'textSecondary', bg: 'bgApp' },
    { label: 'Muted text on Sidebar', fg: 'textMuted', bg: 'bgSidebar' },
    { label: 'Primary text on Elevated', fg: 'textPrimary', bg: 'bgElevated' },
  ] as const;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)',
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: 'var(--bg-primary)',
        borderRadius: '16px',
        width: '90vw',
        maxWidth: '1100px',
        height: '85vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid var(--stroke)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--stroke)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {editingThemeId ? 'Edit Theme' : 'Create Theme'}
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleSave}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'var(--accent-primary)', color: '#fff',
                border: 'none', borderRadius: '8px', padding: '8px 16px',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Save size={14} /> Save Theme
            </button>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', padding: '6px', display: 'flex',
            }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body: split view */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Left panel: controls */}
          <div style={{
            width: '55%',
            overflowY: 'auto',
            padding: '20px',
            borderRight: '1px solid var(--stroke)',
          }}>
            {/* Theme metadata */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Name</label>
                  <input
                    value={themeName}
                    onChange={e => setThemeName(e.target.value)}
                    className="auth-input"
                    style={{ width: '100%', padding: '8px 12px', margin: 0, fontSize: '13px' }}
                    placeholder="My Theme"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Category</label>
                  <select
                    value={themeCategory}
                    onChange={e => setThemeCategory(e.target.value as ThemeCategory)}
                    className="auth-input"
                    style={{ width: '100%', padding: '8px 12px', margin: 0, fontSize: '13px' }}
                  >
                    {(['dark', 'light', 'colorful', 'minimal', 'retro', 'nature', 'developer', 'accessibility'] as const).map(c => (
                      <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Description</label>
                <input
                  value={themeDescription}
                  onChange={e => setThemeDescription(e.target.value)}
                  className="auth-input"
                  style={{ width: '100%', padding: '8px 12px', margin: 0, fontSize: '13px' }}
                  placeholder="A beautiful custom theme..."
                />
              </div>
            </div>

            {/* Start from existing (Item 27) */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Start from existing theme</label>
              <select
                value={baseThemeId}
                onChange={e => handleBaseThemeChange(e.target.value)}
                className="auth-input"
                style={{ width: '100%', padding: '8px 12px', margin: 0, fontSize: '13px' }}
              >
                {allThemes.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Mode toggle */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              {(['dark', 'light'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setEditingMode(mode)}
                  style={{
                    flex: 1, padding: '8px',
                    border: `2px solid ${editingMode === mode ? 'var(--accent-primary)' : 'var(--stroke)'}`,
                    borderRadius: '8px', background: editingMode === mode ? 'var(--bg-tertiary)' : 'transparent',
                    color: editingMode === mode ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontSize: '13px', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
                  }}
                >
                  {mode} Mode
                </button>
              ))}
            </div>

            {/* Color Harmony Suggestions (Item 28) */}
            <div style={{ marginBottom: '16px' }}>
              <button
                onClick={() => setShowHarmony(!showHarmony)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
                  borderRadius: '8px', padding: '10px 12px', cursor: 'pointer',
                  color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600,
                }}
              >
                <span>Color Harmony Suggestions</span>
                <ChevronDown size={14} style={{ transform: showHarmony ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
              </button>
              {showHarmony && (
                <div style={{ background: 'var(--bg-elevated)', borderRadius: '0 0 8px 8px', padding: '12px', border: '1px solid var(--stroke)', borderTop: 'none' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                    Based on your accent color ({activeVars.accentPrimary})
                  </div>
                  {harmonies.map(h => (
                    <div key={h.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', width: '120px', flexShrink: 0 }}>{h.label}</span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {h.colors.map((c, i) => (
                          <button
                            key={i}
                            onClick={() => handleVarChange('accentPrimary', c)}
                            title={`Apply ${c}`}
                            style={{
                              width: '28px', height: '28px', borderRadius: '6px',
                              background: c, border: '2px solid var(--stroke)',
                              cursor: 'pointer', position: 'relative',
                            }}
                          >
                            <span style={{ position: 'absolute', bottom: '-14px', left: '50%', transform: 'translateX(-50%)', fontSize: '9px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{c}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Variable groups */}
            {VARIABLE_GROUPS.map(group => (
              <div key={group.label} style={{ marginBottom: '8px' }}>
                <button
                  onClick={() => toggleGroup(group.label)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
                    borderRadius: expandedGroups.has(group.label) ? '8px 8px 0 0' : '8px',
                    padding: '10px 12px', cursor: 'pointer',
                    color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600,
                  }}
                >
                  <div>
                    <span>{group.label}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>({group.keys.length})</span>
                  </div>
                  <ChevronDown size={14} style={{ transform: expandedGroups.has(group.label) ? 'rotate(180deg)' : 'none', transition: '0.2s', color: 'var(--text-muted)' }} />
                </button>
                {expandedGroups.has(group.label) && (
                  <div style={{
                    background: 'var(--bg-elevated)', padding: '12px',
                    border: '1px solid var(--stroke)', borderTop: 'none',
                    borderRadius: '0 0 8px 8px',
                    display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px',
                  }}>
                    {group.keys.map(key => {
                      const val = String(activeVars[key] || '');
                      const isColor = COLOR_KEYS.has(key);
                      const hexVal = isColor ? extractHex(val) : '';
                      return (
                        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {isColor && (
                            <input
                              type="color"
                              value={hexVal}
                              onChange={e => handleVarChange(key, e.target.value)}
                              style={{ width: '32px', height: '32px', border: '2px solid var(--stroke)', borderRadius: '6px', cursor: 'pointer', padding: 0, background: 'none' }}
                            />
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <label style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                              {KEY_LABELS[key] || key}
                            </label>
                            <input
                              type="text"
                              value={val}
                              onChange={e => handleVarChange(key, e.target.value)}
                              className="auth-input"
                              style={{ width: '100%', padding: '4px 8px', margin: 0, fontSize: '11px', fontFamily: 'monospace' }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Right panel: live preview */}
          <div style={{ width: '45%', overflowY: 'auto', padding: '20px' }}>
            {/* Mini app preview */}
            <h4 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px' }}>Live Preview</h4>
            <div style={{
              borderRadius: '12px',
              overflow: 'hidden',
              border: '1px solid var(--stroke)',
              height: '240px',
              display: 'flex',
              background: activeVars.bgApp,
            }}>
              {/* Server rail */}
              <div style={{ width: '48px', background: activeVars.bgRail, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '8px 0' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: activeVars.accentPrimary }} />
                <div style={{ width: '20px', height: '1px', background: activeVars.stroke }} />
                <div style={{ width: '32px', height: '32px', borderRadius: '12px', background: activeVars.bgElevated }} />
                <div style={{ width: '32px', height: '32px', borderRadius: '12px', background: activeVars.bgElevated }} />
              </div>
              {/* Sidebar */}
              <div style={{ width: '140px', background: activeVars.bgSidebar, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: activeVars.textPrimary, marginBottom: '6px', padding: '0 4px' }}>Server Name</div>
                <div style={{ padding: '4px 8px', borderRadius: '4px', background: activeVars.hoverOverlay }}>
                  <div style={{ fontSize: '10px', color: activeVars.textSecondary }}># general</div>
                </div>
                <div style={{ padding: '4px 8px', borderRadius: '4px', background: activeVars.accentPrimaryAlpha || 'transparent' }}>
                  <div style={{ fontSize: '10px', color: activeVars.textPrimary, fontWeight: 600 }}># chat</div>
                </div>
                <div style={{ padding: '4px 8px' }}>
                  <div style={{ fontSize: '10px', color: activeVars.textMuted }}># voice</div>
                </div>
              </div>
              {/* Main channel area */}
              <div style={{ flex: 1, background: activeVars.bgChannel, display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '8px 12px', borderBottom: `1px solid ${activeVars.stroke}`, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: activeVars.textPrimary }}># chat</span>
                </div>
                <div style={{ flex: 1, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'flex-end' }}>
                  {/* Mock messages */}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: activeVars.accentPurple, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 600, color: activeVars.accentPrimary }}>User</div>
                      <div style={{ fontSize: '10px', color: activeVars.textPrimary }}>Hello, this is a preview message!</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: activeVars.accentPink, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 600, color: activeVars.accentPrimary }}>Another User</div>
                      <div style={{ fontSize: '10px', color: activeVars.textSecondary }}>Looking good with these colors!</div>
                    </div>
                  </div>
                </div>
                {/* Chat input */}
                <div style={{ padding: '8px 12px' }}>
                  <div style={{
                    background: activeVars.bgElevated,
                    borderRadius: activeVars.radiusMd || '8px',
                    padding: '8px 12px',
                    fontSize: '10px',
                    color: activeVars.textMuted,
                    border: `1px solid ${activeVars.stroke}`,
                  }}>
                    Message #chat
                  </div>
                </div>
              </div>
            </div>

            {/* WCAG Contrast Checker (Item 29) */}
            <div style={{ marginTop: '20px' }}>
              <h4 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Info size={12} /> Contrast Checker (WCAG)
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {contrastPairs.map(pair => {
                  const fgHex = extractHex(String(activeVars[pair.fg] || '#ffffff'));
                  const bgHex = extractHex(String(activeVars[pair.bg] || '#000000'));
                  const ratio = contrastRatio(fgHex, bgHex);
                  const level = wcagLevel(ratio);
                  const levelColor = level === 'AAA' ? 'var(--success)' : level === 'AA' ? '#f0ad4e' : 'var(--error)';

                  return (
                    <div key={pair.label} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: '8px',
                      border: '1px solid var(--stroke)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '4px', background: bgHex, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: '10px', fontWeight: 700, color: fgHex }}>A</span>
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{pair.label}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{ratio.toFixed(1)}:1</span>
                        <span style={{
                          fontSize: '10px', fontWeight: 700,
                          padding: '2px 6px', borderRadius: '4px',
                          background: levelColor, color: level === 'Fail' ? '#fff' : '#000',
                        }}>
                          {level}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px' }}>
                AA requires 4.5:1 for normal text. AAA requires 7:1.
              </div>
            </div>

            {/* Color swatches preview */}
            <div style={{ marginTop: '20px' }}>
              <h4 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px' }}>Color Palette</h4>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {['bgApp', 'bgSidebar', 'bgChannel', 'bgElevated', 'textPrimary', 'textSecondary', 'accentPrimary', 'accentPurple', 'accentPink', 'success', 'error', 'warning'].map(key => {
                  const hex = extractHex(String((activeVars as any)[key] || '#000'));
                  return (
                    <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '6px',
                        background: hex, border: '2px solid var(--stroke)',
                      }} title={`${KEY_LABELS[key] || key}: ${hex}`} />
                      <span style={{ fontSize: '8px', color: 'var(--text-muted)' }}>{(KEY_LABELS[key] || key).slice(0, 6)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Button preview */}
            <div style={{ marginTop: '20px' }}>
              <h4 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px' }}>UI Elements</h4>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button style={{ padding: '6px 14px', borderRadius: activeVars.radiusMd || '8px', background: activeVars.accentPrimary, color: '#fff', border: 'none', fontSize: '12px', fontWeight: 600 }}>Primary</button>
                <button style={{ padding: '6px 14px', borderRadius: activeVars.radiusMd || '8px', background: activeVars.bgElevated, color: activeVars.textPrimary, border: `1px solid ${activeVars.stroke}`, fontSize: '12px', fontWeight: 600 }}>Secondary</button>
                <button style={{ padding: '6px 14px', borderRadius: activeVars.radiusMd || '8px', background: activeVars.success, color: '#000', border: 'none', fontSize: '12px', fontWeight: 600 }}>Success</button>
                <button style={{ padding: '6px 14px', borderRadius: activeVars.radiusMd || '8px', background: activeVars.error, color: '#fff', border: 'none', fontSize: '12px', fontWeight: 600 }}>Error</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
