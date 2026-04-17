import { useState, useRef, useCallback, useEffect } from 'react';
import { Check, Search, Download, Upload, Palette, ShoppingBag, Edit3, Trash2, Share2, Sparkles, Dices, Star, Eye } from 'lucide-react';
import { useTheme, type AppTheme, type ColorMode, type MessageDensity } from '../../ui/ThemeProvider';
import { playSound } from '../../../utils/SoundManager';
import { api } from '../../../lib/api';
import {
  getAllThemesIncludingCustom, searchThemes, getThemesByCategory, getCategories,
  toggleFavoriteTheme, isFavoriteTheme, getFavoriteThemeIds, getRecentThemeIds,
  resolveTheme, getCustomThemes, deleteCustomTheme, saveCustomTheme,
} from '../../../themes/registry';
import type { ThemeDefinition, ThemeCategory } from '../../../themes/types';
import ThemePreview from '../../ui/ThemePreview';
import ThemeEditorModal from '../ThemeEditorModal';
import ThemeStoreModal from '../ThemeStoreModal';
import { CODE_THEMES, getCodeTheme, setCodeTheme as setCodeThemePersist, type CodeThemeId } from '../../../utils/codeTheme';
import type { SettingsTabProps } from './types';

type Props = SettingsTabProps;

const SettingsThemeTab = ({ addToast }: Props) => {
  const {
    theme, setTheme, colorMode, setColorMode, accentColor, setAccentColor,
    fontFamily, setFontFamily, fontSize, setFontSize,
    showChannelBackgrounds, setShowChannelBackgrounds,
    playMovingBackgrounds, setPlayMovingBackgrounds,
    glassMode, setGlassMode, compactMode, setCompactMode,
    buttonShape, setButtonShape, highContrast, setHighContrast,
    lowPower, setLowPower, previewTheme,
    messageDensity, setMessageDensity,
  } = useTheme();

  const [themeSearchQuery, setThemeSearchQuery] = useState('');
  const [themeCategory, setThemeCategory] = useState<ThemeCategory | 'all'>('all');
  const [favIds, setFavIds] = useState<string[]>(() => getFavoriteThemeIds());
  const [showThemeEditor, setShowThemeEditor] = useState(false);
  const [editingCustomThemeId, setEditingCustomThemeId] = useState<string | undefined>();
  const [showThemeStore, setShowThemeStore] = useState(false);
  const [customThemesList, setCustomThemesList] = useState<ThemeDefinition[]>(() => getCustomThemes());
  const themeImportRef = useRef<HTMLInputElement>(null);
  const [codeThemeId, setCodeThemeId] = useState<string>(getCodeTheme());
  const [codeSuggestion, setCodeSuggestion] = useState<{ themeName: string; codeTheme: string } | null>(null);
  const [fullPreviewId, setFullPreviewId] = useState<string | undefined>(() => (window as any).__gratoniteFullPreview);
  const [customHex, setCustomHex] = useState('');
  const [hexError, setHexError] = useState(false);

  useEffect(() => {
    const handler = () => setFullPreviewId((window as any).__gratoniteFullPreview);
    window.addEventListener('gratonite:full-preview-changed', handler);
    return () => window.removeEventListener('gratonite:full-preview-changed', handler);
  }, []);

  useEffect(() => {
    const def = resolveTheme(theme);
    if (def?.suggestedCodeTheme && def.suggestedCodeTheme !== codeThemeId) {
      setCodeSuggestion({ themeName: def.name, codeTheme: def.suggestedCodeTheme });
    } else {
      setCodeSuggestion(null);
    }
  }, [theme]);

  const getSeasonalSuggestion = useCallback(() => {
    const month = new Date().getMonth();
    if (month === 9) return { message: "It's spooky season! Try the Cyberpunk theme", themeId: 'cyberpunk', emoji: '🎃' };
    if (month === 11) return { message: "Happy holidays! Try the Arctic theme", themeId: 'arctic', emoji: '🎄' };
    if (month === 5) return { message: "Happy Pride Month! Try the Bubblegum theme", themeId: 'bubblegum', emoji: '🌈' };
    return null;
  }, []);

  const accentColors = [
    { color: '#526df5', name: 'Gratonite Blue' },
    { color: '#8b5cf6', name: 'Purple' },
    { color: '#ec4899', name: 'Pink' },
    { color: '#10b981', name: 'Green' },
    { color: '#f59e0b', name: 'Amber' },
    { color: '#ef4444', name: 'Red' },
    { color: '#06b6d4', name: 'Cyan' },
    { color: '#84cc16', name: 'Lime' },
  ];

  // Build filtered theme list
  const allThemes = themeSearchQuery
    ? searchThemes(themeSearchQuery)
    : themeCategory === 'all'
      ? getAllThemesIncludingCustom()
      : getThemesByCategory(themeCategory);

  // Separate favorites and recent
  const recentIds = getRecentThemeIds();
  const favoriteThemes = allThemes.filter(t => favIds.includes(t.id));
  const recentThemes = allThemes.filter(t => recentIds.includes(t.id) && !favIds.includes(t.id));
  const otherThemes = allThemes.filter(t => !favIds.includes(t.id) && !recentIds.includes(t.id));

  const renderThemeCard = (t: ThemeDefinition, section?: string) => {
    const isSelected = theme === t.id;
    const isFav = favIds.includes(t.id);
    const p = t.preview;
    return (
      <div
        key={`${section || 'theme'}-${t.id}`}
        role="button"
        tabIndex={0}
        onClick={() => { setTheme(t.id as any); playSound('click'); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTheme(t.id as any); playSound('click'); } }}
        onMouseEnter={() => previewTheme(t.id)}
        onMouseLeave={() => previewTheme(null)}
        style={{
          background: 'var(--bg-elevated)',
          border: `2px solid ${isSelected ? 'var(--accent-primary)' : 'var(--stroke)'}`,
          borderRadius: '12px', overflow: 'hidden', cursor: 'pointer',
          transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.15s',
          boxShadow: isSelected ? '0 0 0 1px var(--accent-primary)' : 'none',
          position: 'relative',
        }}
      >
        <div style={{ height: '72px', background: p.bg, display: 'flex', gap: '4px', padding: '6px' }}>
          <div style={{ width: '22px', background: p.sidebar, borderRadius: '4px', flexShrink: 0 }}></div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div style={{ height: '8px', width: '50%', background: p.accent, borderRadius: '3px' }}></div>
            <div style={{ height: '6px', width: '80%', background: p.text, borderRadius: '3px', opacity: 0.5 }}></div>
            <div style={{ height: '6px', width: '60%', background: p.text, borderRadius: '3px', opacity: 0.3 }}></div>
            <div style={{ height: '4px', width: '30%', background: p.accent, borderRadius: '3px', opacity: 0.6 }}></div>
          </div>
        </div>
        <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t.name}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{t.category}</div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); toggleFavoriteTheme(t.id); setFavIds(getFavoriteThemeIds()); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', color: isFav ? '#faa61a' : 'var(--text-muted)' }}
            title={isFav ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star size={12} fill={isFav ? '#faa61a' : 'none'} />
          </button>
        </div>
        {isSelected && (
          <div style={{ position: 'absolute', top: 6, right: 6, background: 'var(--accent-primary)', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Check size={11} color="#000" />
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Theme & Appearance</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '13px' }}>Customize the global look and feel of your Gratonite experience.</p>

      <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Color Mode</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '32px' }}>
        <div onClick={() => setColorMode('dark')} style={{ background: colorMode === 'dark' ? 'var(--bg-tertiary)' : 'var(--bg-elevated)', padding: '16px', borderRadius: '12px', border: `1px solid ${colorMode === 'dark' ? 'var(--accent-primary)' : 'var(--stroke)'}`, cursor: 'pointer', position: 'relative' }}>
          {colorMode === 'dark' && <div style={{ position: 'absolute', top: 12, right: 12 }}><Check size={18} color="var(--accent-primary)" /></div>}
          <div style={{ width: '100%', height: '80px', background: '#0f172a', borderRadius: '8px', marginBottom: '12px', border: '1px solid #1e293b', padding: '8px', display: 'flex', gap: '8px' }}>
            <div style={{ width: '20%', height: '100%', background: '#1e293b', borderRadius: '4px' }}></div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ height: '8px', width: '40%', background: '#3b82f6', borderRadius: '4px' }}></div>
              <div style={{ height: '8px', width: '80%', background: '#334155', borderRadius: '4px' }}></div>
            </div>
          </div>
          <h4 style={{ fontSize: '15px', fontWeight: 600 }}>Dark Mode</h4>
        </div>
        <div onClick={() => setColorMode('light')} style={{ background: colorMode === 'light' ? 'var(--bg-tertiary)' : 'var(--bg-elevated)', padding: '16px', borderRadius: '12px', border: `1px solid ${colorMode === 'light' ? 'var(--accent-primary)' : 'var(--stroke)'}`, cursor: 'pointer' }}>
          {colorMode === 'light' && <div style={{ position: 'absolute', top: 12, right: 12 }}><Check size={18} color="var(--accent-primary)" /></div>}
          <div style={{ width: '100%', height: '80px', background: '#f8fafc', borderRadius: '8px', marginBottom: '12px', border: '1px solid #e2e8f0', padding: '8px', display: 'flex', gap: '8px' }}>
            <div style={{ width: '20%', height: '100%', background: '#e2e8f0', borderRadius: '4px' }}></div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ height: '8px', width: '40%', background: '#3b82f6', borderRadius: '4px' }}></div>
              <div style={{ height: '8px', width: '80%', background: '#cbd5e1', borderRadius: '4px' }}></div>
            </div>
          </div>
          <h4 style={{ fontSize: '15px', fontWeight: 600 }}>Light Mode</h4>
        </div>
      </div>

      <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Theme</h3>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button onClick={() => { setEditingCustomThemeId(undefined); setShowThemeEditor(true); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', background: 'var(--accent-primary)', color: '#fff', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
          <Palette size={14} /> Create Theme
        </button>
        <button onClick={() => setShowThemeStore(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--stroke)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
          <ShoppingBag size={14} /> Theme Store
        </button>
        <button onClick={() => themeImportRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--stroke)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
          <Upload size={14} /> Import
        </button>
        <button onClick={() => {
          const currentTheme = resolveTheme(theme);
          if (currentTheme) {
            const blob = new Blob([JSON.stringify(currentTheme, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `${currentTheme.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`; a.click();
            URL.revokeObjectURL(url);
            addToast({ title: 'Theme exported!', variant: 'success' });
          }
        }} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--stroke)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
          <Download size={14} /> Export Current
        </button>
        <input ref={themeImportRef} type="file" accept=".json" style={{ display: 'none' }} onChange={(e) => {
          const file = e.target.files?.[0]; if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const parsed = JSON.parse(reader.result as string);
              if (!parsed.id || !parsed.name || !parsed.dark || !parsed.light) { addToast({ title: 'Invalid theme file: missing required fields (id, name, dark, light)', variant: 'error' }); return; }
              parsed.id = `imported-${Date.now()}`;
              saveCustomTheme(parsed); setCustomThemesList(getCustomThemes()); setTheme(parsed.id);
              addToast({ title: `Imported theme "${parsed.name}"!`, variant: 'success' });
            } catch { addToast({ title: 'Failed to parse theme file', variant: 'error' }); }
          };
          reader.readAsText(file); e.target.value = '';
        }} />
      </div>

      {/* My Themes */}
      {customThemesList.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '10px', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Palette size={12} color="var(--accent-primary)" /> My Themes ({customThemesList.length})
          </h4>
          <div className="grid-mobile-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            {customThemesList.map(t => {
              const isSelected = theme === t.id;
              const p = t.preview;
              return (
                <div key={`custom-${t.id}`} role="button" tabIndex={0} onClick={() => setTheme(t.id as any)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTheme(t.id as any); } }} onMouseEnter={() => previewTheme(t.id)} onMouseLeave={() => previewTheme(null)} style={{ background: 'var(--bg-elevated)', border: `2px solid ${isSelected ? 'var(--accent-primary)' : 'var(--stroke)'}`, borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.15s', boxShadow: isSelected ? '0 0 0 1px var(--accent-primary)' : 'none', position: 'relative' }}>
                  <div style={{ height: '72px', background: p.bg, display: 'flex', gap: '4px', padding: '6px' }}>
                    <div style={{ width: '22px', background: p.sidebar, borderRadius: '4px', flexShrink: 0 }}></div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div style={{ height: '8px', width: '50%', background: p.accent, borderRadius: '3px' }}></div>
                      <div style={{ height: '6px', width: '80%', background: p.text, borderRadius: '3px', opacity: 0.5 }}></div>
                    </div>
                  </div>
                  <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>Custom</div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                      <button onClick={(e) => { e.stopPropagation(); setEditingCustomThemeId(t.id); setShowThemeEditor(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex' }} title="Edit theme"><Edit3 size={12} color="var(--text-muted)" /></button>
                      <button onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Publish "${t.name}" to the Theme Store?`)) {
                          const varsForApi: Record<string, string> = {};
                          for (const [k, v] of Object.entries(t.dark)) { varsForApi[`dark.${k}`] = String(v); }
                          for (const [k, v] of Object.entries(t.light)) { varsForApi[`light.${k}`] = String(v); }
                          api.themes.create({ name: t.name, description: t.description, tags: [t.category], vars: varsForApi })
                            .then((created: any) => api.themes.publish(created.id))
                            .then(() => addToast({ title: `"${t.name}" published to the Theme Store!`, variant: 'success' }))
                            .catch(() => addToast({ title: 'Failed to publish theme', variant: 'error' }));
                        }
                      }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex' }} title="Publish to Theme Store"><Share2 size={12} color="var(--text-muted)" /></button>
                      <button onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${t.name}"?`)) { deleteCustomTheme(t.id); setCustomThemesList(getCustomThemes()); if (theme === t.id) setTheme('default'); addToast({ title: 'Theme deleted', variant: 'success' }); } }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex' }} title="Delete theme"><Trash2 size={12} color="var(--error)" /></button>
                    </div>
                  </div>
                  {isSelected && <div style={{ position: 'absolute', top: 6, right: 6, background: 'var(--accent-primary)', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={11} color="#000" /></div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: '12px' }}>
        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input type="text" placeholder="Search themes..." value={themeSearchQuery} onChange={(e) => setThemeSearchQuery(e.target.value)} className="auth-input" style={{ width: '100%', padding: '10px 12px 10px 36px', margin: 0, fontSize: '13px' }} />
      </div>

      {/* Category pills */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '16px', scrollbarWidth: 'none' }}>
        {(['all', 'dark', 'light', 'colorful', 'minimal', 'retro', 'nature', 'developer', 'accessibility'] as const).map(cat => (
          <button key={cat} onClick={() => setThemeCategory(cat)} style={{ padding: '5px 12px', borderRadius: '16px', border: 'none', background: themeCategory === cat ? 'var(--accent-primary)' : 'var(--bg-tertiary)', color: themeCategory === cat ? '#fff' : 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background 0.15s, color 0.15s', textTransform: 'capitalize' }}>
            {cat === 'all' ? 'All' : cat}
          </button>
        ))}
      </div>

      {/* Seasonal suggestion */}
      {(() => { const s = getSeasonalSuggestion(); if (!s || theme === s.themeId) return null; return (<div onClick={() => { setTheme(s.themeId as any); playSound('click'); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', marginBottom: '16px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--accent-primary)', cursor: 'pointer' }}><Sparkles size={16} color="var(--accent-primary)" /><span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{s.emoji} {s.message}</span><span style={{ fontSize: '11px', color: 'var(--accent-primary)', fontWeight: 700 }}>Try it</span></div>); })()}

      {/* Random Theme */}
      <button onClick={() => {
        const allT = getAllThemesIncludingCustom().filter(t => t.id !== theme);
        if (allT.length) { const r = allT[Math.floor(Math.random() * allT.length)]; setTheme(r.id as any); playSound('notification'); addToast({ title: `Random pick: ${r.name}`, variant: 'success' }); }
      }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, marginBottom: '16px' }}>
        <Dices size={14} /> Random Theme
      </button>

      {/* Code theme suggestion */}
      {codeSuggestion && (
        <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', flex: 1 }}>
            {codeSuggestion.themeName} suggests <strong>{codeSuggestion.codeTheme}</strong> code theme.
          </span>
          <button onClick={() => { setCodeThemePersist(codeSuggestion.codeTheme as any); setCodeThemeId(codeSuggestion.codeTheme); setCodeSuggestion(null); addToast({ title: 'Code theme updated', variant: 'success' }); }} style={{ padding: '4px 10px', borderRadius: '6px', background: 'var(--accent-primary)', color: '#fff', border: 'none', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>Apply</button>
          <button onClick={() => setCodeSuggestion(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px' }}>Dismiss</button>
        </div>
      )}

      {/* Favorites */}
      {favoriteThemes.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '10px', letterSpacing: '0.05em' }}>Favorites ({favoriteThemes.length})</h4>
          <div className="grid-mobile-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            {favoriteThemes.map(t => renderThemeCard(t, 'fav'))}
          </div>
        </div>
      )}

      {/* Recently Used */}
      {recentThemes.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '10px', letterSpacing: '0.05em' }}>Recent</h4>
          <div className="grid-mobile-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            {recentThemes.slice(0, 6).map(t => renderThemeCard(t, 'recent'))}
          </div>
        </div>
      )}

      {/* All themes */}
      <div className="grid-mobile-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '32px' }}>
        {otherThemes.map(t => renderThemeCard(t))}
      </div>

      {/* Accent Color */}
      <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Accent Color</h3>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {accentColors.map(c => (
          <button key={c.color} onClick={() => setAccentColor(c.color)} title={c.name} style={{ width: '32px', height: '32px', borderRadius: '50%', border: accentColor === c.color ? '3px solid var(--text-primary)' : '2px solid var(--stroke)', background: c.color, cursor: 'pointer', padding: 0, transition: 'all 0.15s' }} />
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px' }}>
          <input type="text" value={customHex} onChange={(e) => { setCustomHex(e.target.value); setHexError(false); }} placeholder="#hex" style={{ width: '80px', padding: '6px 8px', borderRadius: 'var(--radius-md)', background: 'var(--bg-tertiary)', border: `1px solid ${hexError ? 'var(--error)' : 'var(--stroke)'}`, color: 'var(--text-primary)', fontSize: '12px' }} />
          <button onClick={() => { if (/^#[0-9a-fA-F]{6}$/.test(customHex)) { setAccentColor(customHex); setHexError(false); } else { setHexError(true); } }} style={{ padding: '6px 10px', borderRadius: 'var(--radius-md)', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600 }}>Apply</button>
        </div>
      </div>

      {/* Font Family */}
      <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Font</h3>
      <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value as any)} className="auth-input" style={{ width: 'auto', padding: '8px 12px', margin: 0, marginBottom: '32px', height: '36px' }}>
        <option value="inter">Inter (Default)</option>
        <option value="outfit">Outfit</option>
        <option value="space-grotesk">Space Grotesk</option>
        <option value="fira-code">Fira Code</option>
      </select>

      {/* Message Density */}
      <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Message Density</h3>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '32px' }}>
        {([
          { value: 'compact',     label: 'Compact',     desc: 'Dense layout, no avatar on grouped messages' },
          { value: 'comfortable', label: 'Comfortable', desc: 'Balanced spacing (default)' },
          { value: 'cozy',        label: 'Cozy',        desc: 'Relaxed spacing with extra breathing room' },
        ] as { value: MessageDensity; label: string; desc: string }[]).map(opt => (
          <div
            key={opt.value}
            onClick={() => setMessageDensity(opt.value)}
            style={{
              flex: 1, padding: '12px', borderRadius: 'var(--radius-lg)', cursor: 'pointer', userSelect: 'none',
              border: `2px solid ${messageDensity === opt.value ? 'var(--accent-primary)' : 'var(--stroke)'}`,
              background: messageDensity === opt.value ? 'color-mix(in srgb, var(--accent-primary) 10%, var(--bg-tertiary))' : 'var(--bg-tertiary)',
              transition: 'border-color 0.15s, background 0.15s',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '13px', color: messageDensity === opt.value ? 'var(--accent-primary)' : 'var(--text-primary)', marginBottom: '4px' }}>{opt.label}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>{opt.desc}</div>
          </div>
        ))}
      </div>

      {/* Glass & Layout */}
      <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Layout & Effects</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-tertiary)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--stroke)' }}>
          <span style={{ fontWeight: 600 }}>Glass Mode</span>
          <select value={glassMode} onChange={(e) => setGlassMode(e.target.value as any)} className="auth-input" style={{ width: 'auto', padding: '6px 10px', margin: 0, height: '32px', fontSize: '13px' }}>
            <option value="off">Off</option>
            <option value="subtle">Subtle</option>
            <option value="full">Full</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-tertiary)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--stroke)' }}>
          <span style={{ fontWeight: 600 }}>Button Shape</span>
          <select value={buttonShape} onChange={(e) => setButtonShape(e.target.value as any)} className="auth-input" style={{ width: 'auto', padding: '6px 10px', margin: 0, height: '32px', fontSize: '13px' }}>
            <option value="rounded">Rounded</option>
            <option value="pill">Pill</option>
            <option value="square">Square</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-tertiary)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--stroke)' }}>
          <div><div style={{ fontWeight: 600 }}>Channel Backgrounds</div><div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Show custom images/videos in channels.</div></div>
          <div role="switch" aria-checked={showChannelBackgrounds} tabIndex={0} onClick={() => setShowChannelBackgrounds(!showChannelBackgrounds)} style={{ width: '40px', height: '24px', background: showChannelBackgrounds ? 'var(--accent-primary)' : 'var(--stroke)', borderRadius: '12px', position: 'relative', cursor: 'pointer', transition: '0.2s', flexShrink: 0 }}>
            <div style={{ position: 'absolute', height: '16px', width: '16px', left: showChannelBackgrounds ? '20px' : '4px', bottom: '4px', backgroundColor: showChannelBackgrounds ? '#000' : 'white', transition: '.4s', borderRadius: '50%' }}></div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-tertiary)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--stroke)' }}>
          <div><div style={{ fontWeight: 600 }}>Animated Backgrounds</div><div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Play video backgrounds in channels.</div></div>
          <div role="switch" aria-checked={playMovingBackgrounds} tabIndex={0} onClick={() => setPlayMovingBackgrounds(!playMovingBackgrounds)} style={{ width: '40px', height: '24px', background: playMovingBackgrounds ? 'var(--accent-primary)' : 'var(--stroke)', borderRadius: '12px', position: 'relative', cursor: 'pointer', transition: '0.2s', flexShrink: 0 }}>
            <div style={{ position: 'absolute', height: '16px', width: '16px', left: playMovingBackgrounds ? '20px' : '4px', bottom: '4px', backgroundColor: playMovingBackgrounds ? '#000' : 'white', transition: '.4s', borderRadius: '50%' }}></div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-tertiary)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--stroke)' }}>
          <div><div style={{ fontWeight: 600 }}>Low Power Mode</div><div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Disables animations and effects to save battery.</div></div>
          <div role="switch" aria-checked={lowPower} tabIndex={0} onClick={() => setLowPower(!lowPower)} style={{ width: '40px', height: '24px', background: lowPower ? 'var(--accent-primary)' : 'var(--stroke)', borderRadius: '12px', position: 'relative', cursor: 'pointer', transition: '0.2s', flexShrink: 0 }}>
            <div style={{ position: 'absolute', height: '16px', width: '16px', left: lowPower ? '20px' : '4px', bottom: '4px', backgroundColor: lowPower ? '#000' : 'white', transition: '.4s', borderRadius: '50%' }}></div>
          </div>
        </div>
      </div>

      {/* Code Theme */}
      <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px' }}>Code Blocks</h3>
      <select value={codeThemeId} onChange={(e) => { setCodeThemeId(e.target.value); setCodeThemePersist(e.target.value as any); }} className="auth-input" style={{ width: 'auto', padding: '8px 12px', margin: 0, marginBottom: '32px', height: '36px' }}>
        {CODE_THEMES.map(ct => <option key={ct.id} value={ct.id}>{ct.label}</option>)}
      </select>

      {/* Full Preview */}
      {fullPreviewId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)' }}>
          <div style={{ width: '90vw', maxWidth: '900px', maxHeight: '80vh' }}>
            {(() => { const t = resolveTheme(fullPreviewId); return t ? <ThemePreview theme={t} colorMode={colorMode} /> : null; })()}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '16px' }}>
              <button onClick={() => { setTheme(fullPreviewId as any); (window as any).__gratoniteFullPreview = undefined; setFullPreviewId(undefined); window.dispatchEvent(new Event('gratonite:full-preview-changed')); playSound('click'); }} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', background: 'var(--accent-primary)', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}>Apply Theme</button>
              <button onClick={() => { (window as any).__gratoniteFullPreview = undefined; setFullPreviewId(undefined); window.dispatchEvent(new Event('gratonite:full-preview-changed')); }} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--stroke)', fontWeight: 600, cursor: 'pointer' }}>Close Preview</button>
            </div>
          </div>
        </div>
      )}

      {/* Theme Editor Modal */}
      {showThemeEditor && (
        <ThemeEditorModal onClose={() => { setShowThemeEditor(false); setEditingCustomThemeId(undefined); setCustomThemesList(getCustomThemes()); }} editingThemeId={editingCustomThemeId} />
      )}

      {/* Theme Store Modal */}
      {showThemeStore && (
        <ThemeStoreModal onClose={() => { setShowThemeStore(false); setCustomThemesList(getCustomThemes()); }} />
      )}
    </>
  );
};

export default SettingsThemeTab;
