import { useNavigate } from 'react-router-dom';
import { useUiStore } from '@/stores/ui.store';
import { useAuthStore } from '@/stores/auth.store';
import { Avatar } from '@/components/ui/Avatar';

/* ── Tile definitions (from gratonite.pen Home Screen Desktop N12TG) ── */

const tiles = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    label: 'Create a Group\nor Server',
    desc: 'Start your own community',
    action: 'create-guild' as const,
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
      </svg>
    ),
    label: 'Discover\nGratonite',
    desc: 'Explore public portals',
    route: '/discover',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      </svg>
    ),
    label: 'Join Gratonite\nLounge',
    desc: 'Chat with the community',
    route: '/discover',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        <path d="M12 7v2" />
        <path d="M12 13h.01" />
      </svg>
    ),
    label: 'Give Feedback or\nReport a Bug',
    desc: 'Help us improve',
    action: 'bug-report' as const,
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      </svg>
    ),
    label: 'Donate to\nGratonite',
    desc: 'Support development',
    route: '/shop',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
    label: 'Open\nSettings',
    desc: 'Customize your experience',
    action: 'settings' as const,
  },
] as const;

/* ── Styles (matching gratonite.pen Home Screen Desktop exactly) ─────── */

const s = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'auto',
    background: 'var(--bg, #2c2c3e)',
  } as React.CSSProperties,

  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: 56,
    padding: '0 24px',
    flexShrink: 0,
  } as React.CSSProperties,

  mainArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 48,
    padding: '0 40px',
    minHeight: 0,
  } as React.CSSProperties,

  brandWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  } as React.CSSProperties,

  gemFrame: {
    width: 64,
    height: 64,
    borderRadius: 'var(--radius-lg)',
    background: 'rgba(212, 175, 55, 0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,

  brandTitle: {
    fontSize: 36,
    fontWeight: 700,
    color: 'var(--text, #e8e4e0)',
    letterSpacing: -0.5,
    margin: 0,
    lineHeight: 1.2,
  } as React.CSSProperties,

  brandSub: {
    fontSize: 16,
    color: 'var(--text-muted, #a8a4b8)',
    margin: 0,
    textAlign: 'center',
  } as React.CSSProperties,

  tileGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  } as React.CSSProperties,

  tileRow: {
    display: 'flex',
    gap: 20,
    justifyContent: 'center',
  } as React.CSSProperties,

  tile: {
    width: 220,
    height: 180,
    padding: 24,
    borderRadius: 10,
    background: 'var(--bg-elevated, #353348)',
    border: '1px solid var(--stroke, #4a4660)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    cursor: 'pointer',
    transition: 'border-color 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease',
    textDecoration: 'none',
    outline: 'none',
    color: 'inherit',
    fontFamily: 'inherit',
  } as React.CSSProperties,

  tileIconWrap: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    background: 'rgba(212, 175, 55, 0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--accent, #d4af37)',
    flexShrink: 0,
  } as React.CSSProperties,

  tileLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text, #e8e4e0)',
    textAlign: 'center',
    lineHeight: 1.4,
    whiteSpace: 'pre-line',
    margin: 0,
  } as React.CSSProperties,

  tileDesc: {
    fontSize: 12,
    color: 'var(--text-muted, #a8a4b8)',
    textAlign: 'center',
    margin: 0,
  } as React.CSSProperties,
};

/* ── Component ───────────────────────────────────────────────────────── */

export function HomePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const openModal = useUiStore((s) => s.openModal);

  function handleTile(tile: (typeof tiles)[number]) {
    if ('route' in tile && tile.route) {
      navigate(tile.route);
    } else if ('action' in tile && tile.action) {
      openModal(tile.action);
    }
  }

  return (
    <div style={s.page}>
      {/* Top bar with avatar */}
      <div style={s.topBar}>
        {user && (
          <Avatar
            name={user.displayName}
            hash={user.avatarHash}
            userId={user.id}
            size={32}
          />
        )}
      </div>

      {/* Main centered content */}
      <div style={s.mainArea}>
        {/* Brand section */}
        <div style={s.brandWrap}>
          <div style={s.gemFrame}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent, #d4af37)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 22 22 7" fill="rgba(212,175,55,0.18)" stroke="var(--accent, #d4af37)" />
              <polyline points="2 7 12 12 22 7" />
              <line x1="12" y1="12" x2="12" y2="22" />
            </svg>
          </div>
          <h1 style={s.brandTitle}>Gratonite</h1>
          <p style={s.brandSub}>Welcome back. What would you like to do?</p>
        </div>

        {/* Action tile grid — 2 rows × 3 columns */}
        <div style={s.tileGrid}>
          {[tiles.slice(0, 3), tiles.slice(3, 6)].map((row, ri) => (
            <div key={ri} style={s.tileRow}>
              {row.map((tile, ci) => (
                <button
                  key={ri * 3 + ci}
                  type="button"
                  style={s.tile}
                  onClick={() => handleTile(tile)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent, #d4af37)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--stroke, #4a4660)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={s.tileIconWrap}>{tile.icon}</div>
                  <p style={s.tileLabel}>{tile.label}</p>
                  <p style={s.tileDesc}>{tile.desc}</p>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
