import { Link, useLocation } from 'react-router-dom';
import { useUnreadStore } from '@/stores/unread.store';

function MobileNavIcon({ kind }: { kind: 'home' | 'notifications' | 'you' }) {
  switch (kind) {
    case 'home':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V21h14V9.5" />
        </svg>
      );
    case 'notifications':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      );
    case 'you':
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
  const path = location.pathname;
  const isHome = path === '/' || path.startsWith('/dm/') || path.startsWith('/guild/');
  const isNotifications = path === '/notifications';
  const isYou = path === '/settings' || path === '/shop';

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      <Link to="/" className={`mobile-bottom-nav-item ${isHome ? 'active' : ''}`}>
        <MobileNavIcon kind="home" />
        <span>Home</span>
      </Link>
      <Link to="/notifications" className={`mobile-bottom-nav-item ${isNotifications ? 'active' : ''}`}>
        <MobileNavIcon kind="notifications" />
        <span>Notifications</span>
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
