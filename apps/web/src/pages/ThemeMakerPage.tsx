// apps/web/src/pages/ThemeMakerPage.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  BUILT_IN_THEMES,
  applyTheme,
  getCurrentThemeId,
  type Theme,
  type ThemeVars,
} from '@/lib/themes';
import { ThemePreview } from '@/components/ui/ThemeCard';
import { ColorVarRow } from '@/components/ui/ColorVarRow';
import { api } from '@/lib/api';

// ─── Color var metadata ────────────────────────────────────────────────────

type VarMeta = { key: keyof ThemeVars; label: string; description: string };

const VAR_GROUPS: { groupLabel: string; vars: VarMeta[] }[] = [
  {
    groupLabel: 'Backgrounds',
    vars: [
      { key: '--bg', label: 'Main background', description: 'Outermost page surface' },
      { key: '--bg-elevated', label: 'Elevated surface', description: 'Cards, panels, sidebars' },
      { key: '--bg-soft', label: 'Soft surface', description: 'Hover states, subtle containers' },
      { key: '--bg-float', label: 'Floating / deep', description: 'Dropdowns, deepest backgrounds' },
      { key: '--bg-input', label: 'Input background', description: 'Text inputs and search fields' },
    ],
  },
  {
    groupLabel: 'Borders',
    vars: [
      { key: '--stroke', label: 'Stroke / border', description: 'All dividers and outlines' },
    ],
  },
  {
    groupLabel: 'Accent',
    vars: [
      { key: '--accent', label: 'Accent', description: 'Primary interactive colour' },
      { key: '--accent-2', label: 'Accent secondary', description: 'Hover / lighter accent variant' },
    ],
  },
  {
    groupLabel: 'Text',
    vars: [
      { key: '--text', label: 'Text', description: 'Primary readable text' },
      { key: '--text-muted', label: 'Text muted', description: 'Secondary labels and metadata' },
      { key: '--text-faint', label: 'Text faint', description: 'Disabled states and placeholders' },
    ],
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

function getBaseTheme(): Theme {
  const currentId = getCurrentThemeId();
  return BUILT_IN_THEMES.find(t => t.id === currentId) ?? BUILT_IN_THEMES[0]!;
}

function tagsStringToArray(tags: string): string[] {
  return tags.split(',').map(t => t.trim()).filter(Boolean);
}

// ─── Main component ────────────────────────────────────────────────────────

export function ThemeMakerPage() {
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id?: string }>();
  const isEditing = Boolean(editId);

  const [vars, setVars] = useState<ThemeVars>(getBaseTheme().vars);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [baseThemeId, setBaseThemeId] = useState(getBaseTheme().id);

  // Save state
  const savedIdRef = useRef<string | null>(editId ?? null);
  const [saving, setSaving] = useState(false);
  const [saveLabel, setSaveLabel] = useState('Save Draft');
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');

  // Try-it-on state
  const [previewing, setPreviewing] = useState(false);
  const prevApplied = useRef<Theme | null>(null);

  // Load existing theme if editing
  useEffect(() => {
    if (!editId) return;
    api.themes.get(editId).then((t: any) => {
      setVars(t.vars);
      setName(t.name ?? '');
      setDescription(t.description ?? '');
      setTags((t.tags ?? []).join(', '));
    }).catch(() => {
      navigate('/themes/create');
    });
  }, [editId, navigate]);

  // "Start from" base theme change
  function handleStartFrom(themeId: string) {
    setBaseThemeId(themeId);
    const base = BUILT_IN_THEMES.find(t => t.id === themeId) ?? BUILT_IN_THEMES[0]!;
    setVars(base.vars);
  }

  const handleVarChange = useCallback((key: keyof ThemeVars, value: string) => {
    setVars(prev => ({ ...prev, [key]: value }));
  }, []);

  const wipTheme: Theme = {
    id: savedIdRef.current ?? 'wip',
    name: name || 'My Theme',
    description,
    author: '',
    version: '1.0.0',
    tags: tagsStringToArray(tags),
    vars,
  };

  async function handleSave(): Promise<boolean> {
    setSaving(true);
    try {
      const payload = {
        name: name || 'Untitled Theme',
        description,
        tags: tagsStringToArray(tags),
        vars,
      };
      if (savedIdRef.current) {
        await api.themes.update(savedIdRef.current, payload);
      } else {
        const created: any = await api.themes.create(payload);
        savedIdRef.current = created.id;
        navigate(`/themes/${created.id}/edit`, { replace: true });
      }
      setSaveLabel('Saved ✓');
      setTimeout(() => setSaveLabel('Save Draft'), 2000);
      return true;
    } catch {
      setSaveLabel('Error — try again');
      setTimeout(() => setSaveLabel('Save Draft'), 3000);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!name.trim()) return;
    const confirmed = window.confirm(
      'This will make your theme visible to everyone on Discover. You can unpublish it at any time.',
    );
    if (!confirmed) return;
    setPublishError('');
    setPublishing(true);
    try {
      if (!savedIdRef.current) {
        const ok = await handleSave();
        if (!ok) {
          setPublishError('Save failed — check your connection and try again.');
          return;
        }
      }
      if (!savedIdRef.current) return;
      await api.themes.publish(savedIdRef.current);
      navigate('/discover?tab=themes');
    } catch {
      setPublishError('Publish failed — try again.');
    } finally {
      setPublishing(false);
    }
  }

  function handleTryOn() {
    const root = document.documentElement;
    const VARS: (keyof ThemeVars)[] = [
      '--bg', '--bg-elevated', '--bg-soft', '--bg-float', '--bg-input',
      '--stroke', '--accent', '--accent-2', '--text', '--text-muted', '--text-faint',
    ];
    const snapshotVars = {} as ThemeVars;
    for (const v of VARS) {
      snapshotVars[v] = getComputedStyle(root).getPropertyValue(v).trim()
        || root.style.getPropertyValue(v).trim();
    }
    prevApplied.current = {
      id: getCurrentThemeId() ?? 'snapshot',
      name: 'Previous Theme',
      description: '',
      author: '',
      version: '1.0.0',
      tags: [],
      vars: snapshotVars,
    };
    applyTheme(wipTheme);
    setPreviewing(true);
  }

  function handleUndoPreview() {
    if (prevApplied.current) applyTheme(prevApplied.current);
    setPreviewing(false);
  }

  // ─── Styles ─────────────────────────────────────────────────────────────

  const s: Record<string, React.CSSProperties> = {
    page: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' },
    topBar: {
      height: 48, display: 'flex', alignItems: 'center', gap: 12,
      padding: '0 24px', borderBottom: '1px solid var(--stroke)',
      background: 'var(--bg-elevated)', flexShrink: 0,
    },
    backBtn: {
      background: 'none', border: 'none', color: 'var(--text-muted)',
      fontSize: 13, cursor: 'pointer', padding: '4px 8px',
      borderRadius: 'var(--radius-sm)',
    },
    pageTitle: { fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 },
    body: { display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' },
    leftCol: {
      width: 420, minWidth: 420, overflowY: 'auto', padding: '24px 24px 40px',
      borderRight: '1px solid var(--stroke)', display: 'flex', flexDirection: 'column', gap: 24,
    },
    rightCol: {
      flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: 16,
      position: 'sticky', top: 0, alignSelf: 'flex-start',
    },
    groupLabel: {
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.06em', color: 'var(--text-faint)', margin: '0 0 4px',
    },
    metaLabel: { fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 },
    metaInput: {
      width: '100%', height: 34, borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--stroke)', background: 'var(--bg-input)',
      color: 'var(--text)', fontSize: 13, padding: '0 10px', boxSizing: 'border-box',
    },
    metaTextarea: {
      width: '100%', height: 60, borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--stroke)', background: 'var(--bg-input)',
      color: 'var(--text)', fontSize: 13, padding: '8px 10px',
      resize: 'vertical', boxSizing: 'border-box',
    },
    footerRow: { display: 'flex', gap: 10, paddingTop: 8 },
    btn: {
      height: 36, borderRadius: 'var(--radius-md)', border: 'none',
      fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '0 18px',
    },
    previewLabel: {
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.06em', color: 'var(--text-faint)', margin: 0,
    },
    swatchRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
    previewBanner: {
      background: 'var(--accent)', color: '#1a1a2e', fontSize: 13, fontWeight: 600,
      padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
    },
    bannerBtn: {
      background: 'rgba(0,0,0,0.15)', border: 'none', borderRadius: 'var(--radius-sm)',
      color: 'inherit', fontSize: 12, fontWeight: 600, padding: '3px 10px', cursor: 'pointer',
    },
  };

  return (
    <div style={s['page']}>
      {previewing && (
        <div style={s['previewBanner']}>
          <span>Previewing unsaved theme</span>
          <button type="button" style={s['bannerBtn']} onClick={handleUndoPreview}>Undo</button>
          <button type="button" style={s['bannerBtn']} onClick={() => setPreviewing(false)}>Keep</button>
        </div>
      )}

      <div style={s['topBar']}>
        <button type="button" style={s['backBtn']} onClick={() => navigate(-1)}>← Back</button>
        <h1 style={s['pageTitle']}>{isEditing ? 'Edit Theme' : 'Theme Maker'}</h1>
      </div>

      <div style={s['body']}>
        {/* Left column */}
        <div style={s['leftCol']}>
          {/* Start from */}
          <div>
            <p style={s['groupLabel']}>Start from</p>
            <select
              value={baseThemeId}
              onChange={e => handleStartFrom(e.target.value)}
              style={{ ...s['metaInput'], cursor: 'pointer' } as React.CSSProperties}
            >
              {BUILT_IN_THEMES.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Metadata */}
          <div>
            <p style={s['groupLabel']}>Details</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <p style={s['metaLabel']}>
                  Name <span style={{ color: 'var(--danger)' }}>*</span>
                </p>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="My Awesome Theme"
                  maxLength={48}
                  style={s['metaInput']}
                />
              </div>
              <div>
                <p style={s['metaLabel']}>Description</p>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="A short description of your theme..."
                  maxLength={200}
                  style={s['metaTextarea']}
                />
              </div>
              <div>
                <p style={s['metaLabel']}>Tags (comma-separated)</p>
                <input
                  type="text"
                  value={tags}
                  onChange={e => setTags(e.target.value)}
                  placeholder="dark, purple, minimal"
                  style={s['metaInput']}
                />
              </div>
            </div>
          </div>

          {/* Color groups */}
          {VAR_GROUPS.map(group => (
            <div key={group.groupLabel}>
              <p style={s['groupLabel']}>{group.groupLabel}</p>
              {group.vars.map(v => (
                <ColorVarRow
                  key={v.key}
                  label={v.label}
                  description={v.description}
                  varKey={v.key}
                  value={vars[v.key]}
                  onChange={handleVarChange}
                />
              ))}
            </div>
          ))}

          {/* Footer actions */}
          <div style={s['footerRow']}>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{
                ...s['btn'],
                background: 'var(--bg-soft)',
                color: 'var(--text)',
                border: '1px solid var(--stroke)',
              } as React.CSSProperties}
            >
              {saveLabel}
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={publishing || !name.trim()}
              title={!name.trim() ? 'Add a name first' : undefined}
              style={{
                ...s['btn'],
                background: name.trim() ? 'var(--accent)' : 'var(--bg-soft)',
                color: name.trim() ? '#1a1a2e' : 'var(--text-faint)',
                border: 'none',
                opacity: (!name.trim() || publishing) ? 0.6 : 1,
              } as React.CSSProperties}
            >
              {publishing ? 'Publishing...' : 'Publish to Discover →'}
            </button>
          </div>
          {publishError && (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--danger)' }}>{publishError}</p>
          )}
        </div>

        {/* Right column — live preview */}
        <div style={s['rightCol']}>
          <p style={s['previewLabel']}>Live Preview</p>
          <ThemePreview theme={wipTheme} />

          <div style={s['swatchRow']}>
            {Object.values(vars).map((color, i) => (
              <div
                key={i}
                style={{ width: 18, height: 18, borderRadius: '50%', background: color, border: '1px solid var(--stroke)' }}
                title={color}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={previewing ? handleUndoPreview : handleTryOn}
            style={{
              ...s['btn'],
              background: previewing ? 'var(--bg-soft)' : 'var(--bg-elevated)',
              color: previewing ? 'var(--danger)' : 'var(--text-muted)',
              border: '1px solid var(--stroke)',
              width: '100%',
            } as React.CSSProperties}
          >
            {previewing ? 'Undo preview' : 'Try it on'}
          </button>
        </div>
      </div>
    </div>
  );
}
