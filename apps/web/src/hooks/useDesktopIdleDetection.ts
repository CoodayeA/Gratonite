import { useEffect, useRef } from 'react';
import { api } from '../lib/api';

/**
 * Task #88: Listens for system idle changes from Electron powerMonitor
 * and updates the user's presence status accordingly.
 */
export function useDesktopIdleDetection() {
  const previousStatusRef = useRef<string | null>(null);

  useEffect(() => {
    const desktop = window.gratoniteDesktop;
    if (!desktop?.isDesktop || !desktop.onSystemIdleChanged) return;

    const unsub = desktop.onSystemIdleChanged((data) => {
      // Don't override manual DND or invisible
      const currentStatus = localStorage.getItem('gratonite_manual_status');
      if (currentStatus === 'dnd' || currentStatus === 'invisible') return;

      if (data.idle) {
        // Save current status before going idle
        previousStatusRef.current = currentStatus || 'online';
        api.users.updatePresence('idle').catch(() => {});
      } else {
        // Restore previous status
        const restoreTo = (previousStatusRef.current || 'online') as 'online' | 'idle' | 'dnd' | 'invisible';
        previousStatusRef.current = null;
        api.users.updatePresence(restoreTo).catch(() => {});
      }
    });

    return unsub;
  }, []);
}
