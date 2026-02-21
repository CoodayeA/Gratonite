import { useEffect } from 'react';
import { useUnreadStore } from '@/stores/unread.store';
import { setDesktopBadge } from '@/lib/desktop';

export function useUnreadBadge() {
  const unreadCount = useUnreadStore((s) => s.unreadByChannel.size);

  useEffect(() => {
    setDesktopBadge(unreadCount);
  }, [unreadCount]);
}
