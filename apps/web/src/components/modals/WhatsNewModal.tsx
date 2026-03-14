import { useEffect } from 'react';
import { X, Sparkles, Zap, Shield, Bug } from 'lucide-react';
import { ModalWrapper } from '../ui/ModalWrapper';

interface ChangelogEntry {
  version: string;
  date: string;
  entries: Array<{
    type: 'feature' | 'improvement' | 'fix' | 'security';
    text: string;
  }>;
}

const CHANGELOG: ChangelogEntry[] = [
  {
    version: '2.1',
    date: 'March 2026',
    entries: [
      { type: 'feature', text: 'Complete theme system rebuild with live preview, preset themes, and custom theme builder' },
      { type: 'feature', text: 'Per-server theme overrides — set a unique look for each guild' },
      { type: 'feature', text: 'Theme marketplace — publish, browse, and install community themes' },
      { type: 'improvement', text: 'CSS variable-driven theming — all UI elements now respect your theme' },
      { type: 'improvement', text: 'Smooth theme transitions with View Transitions API support' },
      { type: 'improvement', text: 'Theme-aware embeds, toasts, and notification styling' },
      { type: 'improvement', text: 'Keyboard shortcut Ctrl+Shift+T to quickly open the theme picker' },
      { type: 'fix', text: 'Fixed theme persistence across sessions and page refreshes' },
    ],
  },
  {
    version: '2.0',
    date: 'March 2026',
    entries: [
      { type: 'feature', text: 'Real-time guild/channel updates without page refresh' },
      { type: 'feature', text: 'Task boards (Kanban) in channels' },
      { type: 'feature', text: 'Server wiki for persistent knowledge bases' },
      { type: 'feature', text: 'Community wall for shared expression' },
      { type: 'feature', text: 'File cabinet — browse all server files' },
      { type: 'feature', text: 'Message scheduling UI' },
      { type: 'feature', text: 'Advanced search filters (date, author, type)' },
      { type: 'feature', text: 'Server achievements and badges' },
      { type: 'feature', text: 'Form builder for applications and surveys' },
      { type: 'improvement', text: 'Full mobile web support with bottom nav' },
      { type: 'improvement', text: 'Code-split bundle for faster loading' },
      { type: 'improvement', text: 'Collapsible sidebar categories' },
      { type: 'improvement', text: 'Double-click to quick-react with heart' },
      { type: 'improvement', text: 'Smooth scroll-to-bottom in chat' },
      { type: 'improvement', text: 'High contrast and color-blind themes' },
      { type: 'improvement', text: 'Streamer mode for privacy' },
      { type: 'improvement', text: 'Bookmark folders and tags' },
      { type: 'security', text: 'SQL injection fix in analytics' },
      { type: 'security', text: 'File upload whitelist (default-deny)' },
      { type: 'security', text: 'Rate limits on search and auth endpoints' },
      { type: 'security', text: 'MFA backup code salting' },
      { type: 'fix', text: 'Database indexes for faster queries' },
      { type: 'fix', text: 'Leaderboard caching and pagination' },
      { type: 'fix', text: 'Accessibility: focus indicators, skip links, ARIA labels' },
    ],
  },
];

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
  useEffect(() => {
    localStorage.setItem('gratonite:last-seen-changelog', CHANGELOG[0]?.version ?? '');
  }, []);

  return (
    <ModalWrapper isOpen={true}>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }} onClick={onClose}>
        <div style={{ width: 500, maxWidth: '95vw', maxHeight: '80vh', overflow: 'auto', padding: 24, background: 'var(--bg-elevated)', borderRadius: 16, border: '1px solid var(--stroke)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Sparkles size={22} style={{ color: '#6366f1' }} />
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>What's New</h2>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}><X size={20} /></button>
          </div>
          {CHANGELOG.map(release => (
            <div key={release.version} style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>v{release.version}</span>
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
    </ModalWrapper>
  );
}
