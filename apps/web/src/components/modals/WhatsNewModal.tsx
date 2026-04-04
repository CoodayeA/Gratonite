import { useEffect } from 'react';
import { X, Sparkles, Zap, Shield, Bug } from 'lucide-react';
import { CHANGELOG } from '../../data/changelog';

const TYPE_ICONS = {
  feature: Sparkles,
  improvement: Zap,
  fix: Bug,
  security: Shield,
};

const TYPE_COLORS = {
  feature: '#6366f1',
  improvement: '#22c55e',
  fix: '#f59e0b',
  security: '#ef4444',
};

export default function WhatsNewModal({ onClose }: { onClose: () => void }) {
  // Mark as seen immediately when modal opens — written here so the App.tsx
  // useEffect won't re-trigger on the next render/refresh.
  const latestId = CHANGELOG[0]?.id ?? '';
  useEffect(() => {
    localStorage.setItem('gratonite:last-seen-changelog', latestId);
  }, [latestId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="What's new" style={{ width: 500, maxWidth: '95vw', maxHeight: '80vh', overflow: 'auto', padding: 24, background: 'var(--bg-elevated)', borderRadius: 16, border: '1px solid var(--stroke)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sparkles size={22} style={{ color: '#6366f1' }} />
            <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>What's New</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }} aria-label="Close"><X size={20} /></button>
        </div>
        {CHANGELOG.map(release => (
          <div key={release.id} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{release.title}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{release.date}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {release.entries.map((entry, i) => {
                const Icon = TYPE_ICONS[entry.type];
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'start', gap: 8, padding: '6px 0' }}>
                    <Icon size={14} style={{ color: TYPE_COLORS[entry.type], marginTop: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4 }}>{entry.text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
