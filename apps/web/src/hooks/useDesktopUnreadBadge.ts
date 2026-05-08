import { useEffect, useRef } from 'react';
import { useUnreadStore } from '../store/unreadStore';

/**
 * Mirrors the in-app unread total to the desktop app icon (dock badge on
 * macOS / Linux, taskbar overlay on Windows). The badge shows total
 * mentions across all channels — Discord-style — so the count is meaningful
 * at a glance and not just a generic dot.
 *
 * No-op outside the Electron desktop shell.
 */
export function useDesktopUnreadBadge() {
  const state = useUnreadStore();
  const lastSentRef = useRef<number | null>(null);

  useEffect(() => {
    const desktop = (typeof window !== 'undefined' ? window.gratoniteDesktop : undefined);
    if (!desktop?.isDesktop || !desktop.setBadgeCount) return;

    let mentions = 0;
    let anyUnread = false;
    for (const entry of state.values()) {
      mentions += entry.mentionCount || 0;
      if (entry.hasUnread) anyUnread = true;
    }
    // If there are unread channels but zero @mentions, still surface a "1" so
    // the dock/taskbar shows *something* — matches what most chat clients do.
    const display = mentions > 0 ? mentions : (anyUnread ? 1 : 0);

    if (lastSentRef.current === display) return;
    lastSentRef.current = display;

    try {
      desktop.setBadgeCount(display);
    } catch {
      // Best-effort; never let badge updates crash the renderer.
    }

    // Mirror to tray tooltip / overlay refresh path too, when available.
    try {
      desktop.updateTrayBadge?.(display);
    } catch { /* ignore */ }
  }, [state]);
}
