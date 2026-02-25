import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGuildsStore } from '@/stores/guilds.store';
import { shouldEnableUiV2Tokens } from '@/theme/initTheme';
import { ServerGallery } from '@/components/home/ServerGallery';
import { useUiStore } from '@/stores/ui.store';
import { useAuthStore } from '@/stores/auth.store';
import { Avatar } from '@/components/ui/Avatar';

/* ── CSS variable tokens ─────────────────────────────────────────── */
const vars = {
  bg:          '#2c2c3e',
  bgElevated:  '#353348',
  bgSoft:      '#413d58',
  stroke:      '#4a4660',
  accent:      '#d4af37',
  text:        '#e8e4e0',
  textMuted:   '#a8a4b8',
  textFaint:   '#6e6a80',
  textOnGold:  '#1a1a2e',
  goldSubtle:  '#d4af3730',
} as const;

/* ── SVG icon paths per tile ─────────────────────────────────────── */
const tileIcons = {
  create: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={vars.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  ),
  compass: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={vars.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill={vars.accent} stroke="none" />
    </svg>
  ),
  chat: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={vars.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  message: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={vars.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  ),
  heart: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={vars.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),
  gear: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={vars.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1.08z" />
    </svg>
  ),
};

/* ── Gem brand icon (top of brand section) ───────────────────────── */
function GemIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={vars.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 22 22 7" fill={vars.goldSubtle} stroke={vars.accent} />
      <polyline points="2 7 12 12 22 7" />
      <line x1="12" y1="12" x2="12" y2="22" />
    </svg>
  );
}

/* ── Shared styles ───────────────────────────────────────────────── */
const styles = {
  page: {
    background: vars.bg,
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  topBar: {
    height: 56,
    background: vars.bgElevated,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: '0 24px',
    flexShrink: 0,
  },
  mainArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 40px',
    gap: 48,
  },
  brandSection: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 12,
  },
  gemFrame: {
    width: 64,
    height: 64,
    background: vars.goldSubtle,
    borderRadius: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    color: vars.text,
    fontSize: 36,
    fontWeight: 700,
    letterSpacing: -0.5,
    margin: 0,
    lineHeight: 1.2,
  },
  brandSubtitle: {
    color: vars.textMuted,
    fontSize: 16,
    margin: 0,
    textAlign: 'center' as const,
  },
  tileGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 20,
    width: '100%',
    maxWidth: 820,
  },
  tile: {
    background: vars.bgSoft,
    border: `1px solid ${vars.stroke}`,
    borderRadius: 16,
    padding: '24px 20px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 10,
    cursor: 'pointer',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
    textAlign: 'left' as const,
    color: 'inherit',
    textDecoration: 'none',
    outline: 'none',
  },
  tileIconFrame: {
    width: 44,
    height: 44,
    background: vars.goldSubtle,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  tileEyebrow: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    color: vars.accent,
  },
  tileMeta: {
    fontSize: 12,
    color: vars.textFaint,
  },
  tileTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: vars.text,
  },
  tileDesc: {
    fontSize: 13,
    color: vars.textMuted,
    lineHeight: 1.5,
  },
} as const;

/* ── Tile hover helpers ──────────────────────────────────────────── */
function tileHoverProps() {
  return {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.boxShadow = `0 8px 24px rgba(0,0,0,0.35)`;
    },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
      e.currentTarget.style.transform = '';
      e.currentTarget.style.boxShadow = '';
    },
  };
}

/* ── Component ───────────────────────────────────────────────────── */
export function HomePage() {
  const uiV2TokensEnabled = shouldEnableUiV2Tokens();
  const guildCount = useGuildsStore((s) => s.guildOrder.length);
  const navigate = useNavigate();
  const location = useLocation();
  const openModal = useUiStore((s) => s.openModal);
  const portalsAnchorRef = useRef<HTMLDivElement | null>(null);
  const user = useAuthStore((s) => s.user);

  function handleOpenDirectMessagesHub() {
    navigate('/notifications');
  }

  useEffect(() => {
    if (!location.hash) return;
    const target = location.hash === '#portals' ? portalsAnchorRef.current : null;
    if (!target) return;
    window.setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 40);
  }, [location.hash]);

  const displayName = user?.displayName ?? 'there';

  return (
    <div className="home-page" style={styles.page}>
      {/* ── Top bar ──────────────────────────────────────────────── */}
      <div style={styles.topBar}>
        {user && (
          <Avatar
            name={user.displayName}
            hash={user.avatarHash}
            userId={user.id}
            size={32}
          />
        )}
      </div>

      <div
        className={`home-content ${uiV2TokensEnabled ? 'home-content-v2' : ''}`}
        style={styles.mainArea}
      >
        <div id="portals" ref={portalsAnchorRef} className="home-anchor-target" />
        {uiV2TokensEnabled && <ServerGallery onOpenDirectMessages={handleOpenDirectMessagesHub} />}

        {/* ── Brand section ────────────────────────────────────── */}
        <div style={styles.brandSection}>
          <div style={styles.gemFrame}>
            <GemIcon />
          </div>
          <h1 style={styles.brandTitle}>Gratonite</h1>
          <p style={styles.brandSubtitle}>
            Welcome back, {displayName}. What would you like to do?
          </p>
        </div>

        {/* ── Tile grid (6 tiles, 3 columns x 2 rows) ─────────── */}
        <section style={styles.tileGrid} aria-label="Quick actions">
          {/* Tile 1 — Create a Portal */}
          <button
            type="button"
            className="home-dashboard-tile"
            style={styles.tile}
            onClick={() => openModal('create-guild')}
            {...tileHoverProps()}
          >
            <div style={styles.tileIconFrame}>{tileIcons.create}</div>
            <span style={styles.tileEyebrow}>Create</span>
            <span style={styles.tileMeta}>{guildCount} portals active</span>
            <span style={styles.tileTitle}>Create a Portal</span>
            <span style={styles.tileDesc}>
              Start a new community with starter channels and an invite link.
            </span>
          </button>

          {/* Tile 2 — Discover */}
          <button
            type="button"
            className="home-dashboard-tile"
            style={styles.tile}
            onClick={() => navigate('/discover')}
            {...tileHoverProps()}
          >
            <div style={styles.tileIconFrame}>{tileIcons.compass}</div>
            <span style={styles.tileEyebrow}>Discover</span>
            <span style={styles.tileMeta}>Portals &bull; Bots &bull; Themes</span>
            <span style={styles.tileTitle}>Find Portals</span>
            <span style={styles.tileDesc}>
              Browse communities, bots, and themes in a streaming-style grid.
            </span>
          </button>

          {/* Tile 3 — Gratonite Lounge */}
          <button
            type="button"
            className="home-dashboard-tile"
            style={styles.tile}
            onClick={() => navigate('/blog')}
            {...tileHoverProps()}
          >
            <div style={styles.tileIconFrame}>{tileIcons.chat}</div>
            <span style={styles.tileEyebrow}>Guide</span>
            <span style={styles.tileMeta}>Navigation + feature guides</span>
            <span style={styles.tileTitle}>Gratonite Lounge</span>
            <span style={styles.tileDesc}>
              Use the blog/guides hub for onboarding and product help while the official lounge is prepared.
            </span>
          </button>

          {/* Tile 4 — Give Feedback */}
          <button
            type="button"
            className="home-dashboard-tile"
            style={styles.tile}
            onClick={() => openModal('bug-report', { route: '/', channelLabel: 'Home' })}
            {...tileHoverProps()}
          >
            <div style={styles.tileIconFrame}>{tileIcons.message}</div>
            <span style={styles.tileEyebrow}>Feedback</span>
            <span style={styles.tileMeta}>Internal bug inbox connected</span>
            <span style={styles.tileTitle}>Give Feedback</span>
            <span style={styles.tileDesc}>
              Send a bug report or product note directly to the internal bug inbox.
            </span>
          </button>

          {/* Tile 5 — Donate */}
          <a
            className="home-dashboard-tile"
            style={styles.tile}
            href="https://gratonite.chat/blog"
            target="_blank"
            rel="noreferrer"
            {...tileHoverProps()}
          >
            <div style={styles.tileIconFrame}>{tileIcons.heart}</div>
            <span style={styles.tileEyebrow}>Support</span>
            <span style={styles.tileMeta}>Payments not live yet</span>
            <span style={styles.tileTitle}>Donate</span>
            <span style={styles.tileDesc}>
              Donation flow placeholder. Link currently routes to project info until payment setup is added.
            </span>
          </a>

          {/* Tile 6 — Open Settings */}
          <button
            type="button"
            className="home-dashboard-tile"
            style={styles.tile}
            onClick={() => navigate('/settings')}
            {...tileHoverProps()}
          >
            <div style={styles.tileIconFrame}>{tileIcons.gear}</div>
            <span style={styles.tileEyebrow}>Settings</span>
            <span style={styles.tileMeta}>Appearance &bull; Security &bull; Notifications</span>
            <span style={styles.tileTitle}>Open Settings</span>
            <span style={styles.tileDesc}>
              Manage profile, notifications, appearance, status, and accessibility controls.
            </span>
          </button>
        </section>
      </div>
    </div>
  );
}
