import { useEffect } from 'react';
import { useUnreadStore } from '@/stores/unread.store';
import { setDesktopBadge } from '@/lib/desktop';

export function useUnreadBadge() {
  const unreadCount = useUnreadStore((s) =>
    Array.from(s.unreadCountByChannel.values()).reduce((sum, count) => sum + Math.max(0, count), 0),
  );

  useEffect(() => {
    setDesktopBadge(unreadCount);
    if (typeof document !== 'undefined') {
      const baseTitle = 'Gratonite';
      document.title = unreadCount > 0 ? `(${unreadCount}) ${baseTitle}` : baseTitle;
    }
  }, [unreadCount]);
}
