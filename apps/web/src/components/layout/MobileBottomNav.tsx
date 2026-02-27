import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useUnreadStore } from '@/stores/unread.store';
import { useUiStore } from '@/stores/ui.store';
import { useWindowSize } from '@/hooks/useWindowSize';

/* ── CSS variable design tokens ─────────────────────────────────────── */
const V = {
  stroke: 'var(--stroke, #4a4660)',
  text: 'var(--text, #e8e4e0)',
  textMuted: 'var(--text-muted, #a8a4b8)',
} as const;

/* ── Inline style objects ───────────────────────────────────────────── */

const navStyle = {
  position: 'fixed',
  left: 8,
  right: 8,
  bottom: 'max(8px, env(safe-area-inset-bottom, 0px))',
  zIndex: 85,
  display: 'grid',
  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
  gap: 4,
  padding: 6,
  borderRadius: 'var(--radius-xl)',
  border: '1px solid rgba(74, 70, 96, 0.85)',
  background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.01)), rgba(15, 22, 36, 0.82)',
  backdropFilter: 'blur(18px) saturate(120%)',
  boxShadow: '0 12px 40px rgba(2, 6, 18, 0.35)',
} as React.CSSProperties;

const navItemBase = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
  minHeight: 44,
  borderRadius: 10,
  color: V.textMuted,
  textDecoration: 'none',
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.01em',
  transition: 'background 0.16s ease, color 0.16s ease',
  position: 'relative',
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  padding: 0,
} as React.CSSProperties;

const navItemActive = {
  ...navItemBase,
  color: V.text,
  background: 'linear-gradient(135deg, rgba(121, 223, 255, 0.13), rgba(138, 123, 255, 0.11))',
  border: '1px solid rgba(121, 223, 255, 0.12)',
} as React.CSSProperties;

const badgeStyle = {
  position: 'absolute',
  top: 4,
  right: 10,
  minWidth: 18,
  height: 18,
  borderRadius: 'var(--radius-pill)',
  padding: '0 4px',
  display: 'grid',
  placeItems: 'center',
  background: 'rgba(121, 223, 255, 0.18)',
  border: '1px solid rgba(121, 223, 255, 0.32)',
  color: V.text,
  fontSize: 10,
  fontWeight: 700,
  lineHeight: 1,
  pointerEvents: 'none',
} as React.CSSProperties;

const svgStyle = {
  opacity: 0.92,
} as React.CSSProperties;

function MobileNavIcon({ kind }: { kind: 'home' | 'portals' | 'discover' | 'inbox' | 'you' }) {
  switch (kind) {
    case 'home':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={svgStyle}>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V21h14V9.5" />
        </svg>
      );
    case 'portals':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={svgStyle}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case 'discover':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={svgStyle}>
          <circle cx="12" cy="12" r="9" />
          <polygon points="10.5 10.5 15 9 13.5 13.5 9 15 10.5 10.5" />
        </svg>
      );
    case 'inbox':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={svgStyle}>
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
    case 'you':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={svgStyle}>
          <path d="M20 21a8 8 0 0 0-16 0" />
          <circle cx="12" cy="8" r="4" />
        </svg>
      );
  }
}

export function MobileBottomNav() {
  const { width } = useWindowSize();
  const location = useLocation();
  const totalUnread = useUnreadStore((s) =>
    Array.from(s.unreadCountByChannel.values()).reduce((sum, count) => sum + Math.max(0, count), 0),
  );
  const toggleMobileGuildRail = useUiStore((s) => s.toggleMobileGuildRail);
  const path = location.pathname;

  const isHome = path === '/' || path.startsWith('/dm/') || path === '/friends';
  const isPortals = path.startsWith('/guild/');
  const isDiscover = path === '/discover';
  const isInbox = path === '/notifications';
  const isYou = path === '/settings' || path === '/shop' || path === '/leaderboard' || path === '/gratonite';

  if (width >= 768) return null;

  return (
    <nav style={navStyle} aria-label="Mobile navigation">
      <Link to="/" style={isHome ? navItemActive : navItemBase}>
        <MobileNavIcon kind="home" />
        <span>Home</span>
      </Link>

      <button
        type="button"
        style={isPortals ? navItemActive : navItemBase}
        onClick={toggleMobileGuildRail}
      >
        <MobileNavIcon kind="portals" />
        <span>Portals</span>
      </button>

      <Link to="/discover" style={isDiscover ? navItemActive : navItemBase}>
        <MobileNavIcon kind="discover" />
        <span>Discover</span>
      </Link>

      <Link to="/notifications" style={isInbox ? navItemActive : navItemBase}>
        <MobileNavIcon kind="inbox" />
        <span>Inbox</span>
        {totalUnread > 0 && (
          <span style={badgeStyle} aria-label={`${totalUnread} unread`}>
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </Link>

      <Link to="/settings" style={isYou ? navItemActive : navItemBase}>
        <MobileNavIcon kind="you" />
        <span>You</span>
      </Link>
    </nav>
  );
}
