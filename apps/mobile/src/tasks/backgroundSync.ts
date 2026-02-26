import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// ── Constants ────────────────────────────────────────────

export const BACKGROUND_SYNC_TASK = 'BACKGROUND_SYNC_TASK';

const TOKEN_KEY = 'gratonite_access_token';

const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;
const API_URL = extra?.['apiUrl'] ?? 'https://api.gratonite.chat';
const BASE = `${API_URL}/api/v1`;

// ── Task definition ──────────────────────────────────────

TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  try {
    console.log('[BackgroundSync] Running background sync task');

    // Retrieve token directly from SecureStore since Zustand stores
    // may not be hydrated in the background task context.
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!token) {
      console.log('[BackgroundSync] No auth token, skipping');
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    // Fetch unread counts from the API
    const res = await fetch(`${BASE}/users/@me/unread`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      console.log('[BackgroundSync] API request failed:', res.status);
      return BackgroundTask.BackgroundTaskResult.Failed;
    }

    const data = (await res.json()) as Array<{
      channelId: string;
      count: number;
      mentionCount: number;
    }>;

    // Calculate total badge count (prioritize mentions)
    let totalMentions = 0;
    let totalUnread = 0;
    for (const entry of data) {
      totalMentions += entry.mentionCount ?? 0;
      totalUnread += entry.count ?? 0;
    }

    const badgeCount = totalMentions > 0 ? totalMentions : totalUnread;
    await Notifications.setBadgeCountAsync(badgeCount);

    console.log('[BackgroundSync] Badge updated:', badgeCount);
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.log('[BackgroundSync] Task failed:', error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

// ── Registration helpers ─────────────────────────────────

export async function registerBackgroundSync(): Promise<void> {
  try {
    await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      minimumInterval: 15 * 60, // 15 minutes
    });
    console.log('[BackgroundSync] Background sync task registered');
  } catch (error) {
    console.log('[BackgroundSync] Failed to register background sync:', error);
  }
}

export async function unregisterBackgroundSync(): Promise<void> {
  try {
    await BackgroundTask.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
    console.log('[BackgroundSync] Background sync task unregistered');
  } catch (error) {
    console.log('[BackgroundSync] Failed to unregister background sync:', error);
  }
}
