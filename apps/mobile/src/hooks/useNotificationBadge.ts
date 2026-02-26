import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { useUnreadStore } from '../stores/unread.store';

/**
 * Syncs the app icon badge count with the unread store.
 *
 * Prioritizes mention count (more urgent) over total unread count.
 * Call this once near the root of your authenticated component tree.
 */
export function useNotificationBadge() {
  const totalUnread = useUnreadStore((s) => s.getTotalUnread());
  const totalMentions = useUnreadStore((s) => s.getTotalMentions());

  useEffect(() => {
    // Mentions are higher priority — show those if any exist
    const badgeCount = totalMentions > 0 ? totalMentions : totalUnread;
    Notifications.setBadgeCountAsync(badgeCount).catch(() => {});
  }, [totalUnread, totalMentions]);
}
