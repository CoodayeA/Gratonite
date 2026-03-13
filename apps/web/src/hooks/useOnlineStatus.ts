import { useSyncExternalStore } from 'react';
import { getQueuedMessages, clearQueue } from '../lib/offlineCache';
import { api } from '../lib/api';
import { invalidateGuilds, invalidateFriends, invalidateDmChannels } from './queries';

function subscribe(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

/**
 * React hook that tracks browser online/offline state.
 * When transitioning from offline to online, flushes the message queue
 * and invalidates stale React Query caches.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}

let flushing = false;

/**
 * Flush any queued offline messages and refresh stale data.
 * Call this when the app comes back online.
 */
export async function flushOfflineQueue(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    const queued = getQueuedMessages();
    for (const msg of queued) {
      try {
        await api.messages.send(msg.channelId, { content: msg.content, nonce: msg.nonce });
      } catch {
        // If sending fails again, leave it — user can retry manually
      }
    }
    clearQueue();

    // Refresh stale caches
    invalidateGuilds();
    invalidateFriends();
    invalidateDmChannels();
  } finally {
    flushing = false;
  }
}

// Auto-flush when coming back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushOfflineQueue();
  });
}
