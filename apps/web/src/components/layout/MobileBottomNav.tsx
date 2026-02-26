import { Link, useLocation } from 'react-router-dom';
import { useUnreadStore } from '@/stores/unread.store';
import { useUiStore } from '@/stores/ui.store';

function MobileNavIcon({ kind }: { kind: 'home' | 'portals' | 'discover' | 'inbox' | 'you' }) {
  switch (kind) {
    case 'home':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V21h14V9.5" />
        </svg>
      );
    case 'portals':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case 'discover':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <polygon points="10.5 10.5 15 9 13.5 13.5 9 15 10.5 10.5" />
        </svg>
      );
    case 'inbox':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
    case 'you':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 21a8 8 0 0 0-16 0" />
          <circle cx="12" cy="8" r="4" />
        </svg>
      );
  }
}

export function MobileBottomNav() {
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

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      <Link to="/" className={`mobile-bottom-nav-item ${isHome ? 'active' : ''}`}>
        <MobileNavIcon kind="home" />
        <span>Home</span>
      </Link>

      <button
        type="button"
        className={`mobile-bottom-nav-item ${isPortals ? 'active' : ''}`}
        onClick={toggleMobileGuildRail}
      >
        <MobileNavIcon kind="portals" />
        <span>Portals</span>
      </button>

      <Link to="/discover" className={`mobile-bottom-nav-item ${isDiscover ? 'active' : ''}`}>
        <MobileNavIcon kind="discover" />
        <span>Discover</span>
      </Link>

      <Link to="/notifications" className={`mobile-bottom-nav-item ${isInbox ? 'active' : ''}`}>
        <MobileNavIcon kind="inbox" />
        <span>Inbox</span>
        {totalUnread > 0 && (
          <span className="mobile-bottom-nav-badge" aria-label={`${totalUnread} unread`}>
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </Link>

      <Link to="/settings" className={`mobile-bottom-nav-item ${isYou ? 'active' : ''}`}>
        <MobileNavIcon kind="you" />
        <span>You</span>
      </Link>
    </nav>
  );
}
