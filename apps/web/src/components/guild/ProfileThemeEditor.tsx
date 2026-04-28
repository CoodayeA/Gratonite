/**
 * ProfileThemeEditor — Item 102: Custom profile card themes
 * Users can create and preview profile card theme configurations.
 */
import { useState, useEffect, useId } from 'react';
import { Palette, Save, RotateCw } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../ui/ToastManager';

interface ProfileTheme {
  primaryColor: string;
  secondaryColor: string;
  backgroundImage: string;
  cardStyle: 'default' | 'glass' | 'solid' | 'gradient';
}

const PRESETS: { name: string; theme: ProfileTheme }[] = [
  { name: 'Default', theme: { primaryColor: '#526df5', secondaryColor: '#1e1f22', backgroundImage: '', cardStyle: 'default' } },
  { name: 'Sunset', theme: { primaryColor: '#f59e0b', secondaryColor: '#7c3aed', backgroundImage: '', cardStyle: 'gradient' } },
  { name: 'Ocean', theme: { primaryColor: '#06b6d4', secondaryColor: '#0e7490', backgroundImage: '', cardStyle: 'glass' } },
  { name: 'Forest', theme: { primaryColor: '#10b981', secondaryColor: '#064e3b', backgroundImage: '', cardStyle: 'solid' } },
  { name: 'Rose', theme: { primaryColor: '#ec4899', secondaryColor: '#831843', backgroundImage: '', cardStyle: 'gradient' } },
  { name: 'Midnight', theme: { primaryColor: '#6366f1', secondaryColor: '#0f172a', backgroundImage: '', cardStyle: 'glass' } },
];

interface Props {
  username: string;
  displayName: string;
  avatarUrl?: string;
  onSave?: () => void;
}

export const ProfileThemeEditor = ({ username, displayName, avatarUrl, onSave }: Props) => {
  const baseId = useId();
  const primaryId = `${baseId}-primary`;
  const secondaryId = `${baseId}-secondary`;
  const styleId = `${baseId}-style`;
  const [theme, setTheme] = useState<ProfileTheme>(PRESETS[0].theme);
  const [saving, setSaving] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    api.get<any>('/users/@me/settings').then((s: any) => {
      if (s?.profileTheme) {
        setTheme({ ...PRESETS[0].theme, ...s.profileTheme });
      }
    }).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch('/users/@me/settings', { profileTheme: theme });
      onSave?.();
    } catch { addToast({ title: 'Failed to save theme', variant: 'error' }); } finally { setSaving(false); }
  };

  const cardBackground = theme.cardStyle === 'gradient'
    ? `linear-gradient(135deg, ${theme.primaryColor}40, ${theme.secondaryColor})`
    : theme.cardStyle === 'glass'
      ? `${theme.secondaryColor}cc`
      : theme.cardStyle === 'solid'
        ? theme.secondaryColor
        : 'var(--bg-elevated)';

  return (
    <div>
      <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Palette size={18} /> Profile Theme
      </h3>

      {/* Preview */}
      <div style={{
        width: '100%', maxWidth: '360px', borderRadius: '12px', overflow: 'hidden',
        border: '1px solid var(--stroke)', marginBottom: '20px',
        background: cardBackground,
        backdropFilter: theme.cardStyle === 'glass' ? 'blur(12px)' : undefined,
      }}>
        <div style={{ height: '80px', background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.primaryColor}88)` }} />
        <div style={{ padding: '16px', paddingTop: '0', position: 'relative' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%', border: `3px solid ${theme.primaryColor}`,
            background: 'var(--bg-primary)', marginTop: '-32px', marginBottom: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '24px', color: theme.primaryColor, fontWeight: 700,
            overflow: 'hidden',
          }}>
            {avatarUrl ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : displayName[0]?.toUpperCase()}
          </div>
          <div style={{ fontWeight: 700, fontSize: '16px', color: 'white' }}>{displayName}</div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>@{username}</div>
        </div>
      </div>

      {/* Presets */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Presets</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {PRESETS.map(p => (
            <button key={p.name} onClick={() => setTheme(p.theme)} style={{
              padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--stroke)',
              background: `linear-gradient(135deg, ${p.theme.primaryColor}40, ${p.theme.secondaryColor})`,
              color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
            }}>{p.name}</button>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <div>
          <label htmlFor={primaryId} style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Primary</label>
          <input id={primaryId} type="color" value={theme.primaryColor} onChange={e => setTheme({ ...theme, primaryColor: e.target.value })} style={{ width: '50px', height: '32px', border: 'none', borderRadius: '4px', cursor: 'pointer' }} />
        </div>
        <div>
          <label htmlFor={secondaryId} style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Secondary</label>
          <input id={secondaryId} type="color" value={theme.secondaryColor} onChange={e => setTheme({ ...theme, secondaryColor: e.target.value })} style={{ width: '50px', height: '32px', border: 'none', borderRadius: '4px', cursor: 'pointer' }} />
        </div>
        <div>
          <label htmlFor={styleId} style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Style</label>
          <select id={styleId} value={theme.cardStyle} onChange={e => setTheme({ ...theme, cardStyle: e.target.value as any })} style={{ padding: '6px 8px', borderRadius: '6px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '13px' }}>
            <option value="default">Default</option>
            <option value="glass">Glass</option>
            <option value="solid">Solid</option>
            <option value="gradient">Gradient</option>
          </select>
        </div>
      </div>

      <button onClick={save} disabled={saving} style={{
        display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px',
        borderRadius: '8px', background: 'var(--accent-primary)', border: 'none',
        color: '#000', fontWeight: 600, cursor: 'pointer', fontSize: '13px',
      }}>{saving ? <RotateCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />} Save Theme</button>
    </div>
  );
};

export default ProfileThemeEditor;
