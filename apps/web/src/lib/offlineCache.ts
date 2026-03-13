/**
 * offlineCache.ts — Simple offline caching layer using localStorage.
 * Caches recent messages, channels, and members for offline access.
 * Queues outgoing messages when offline and flushes on reconnect.
 */

const CACHE_PREFIX = 'gratonite-offline:';
const MAX_MESSAGES_PER_CHANNEL = 50;

interface QueuedMessage {
  channelId: string;
  content: string;
  nonce: string;
  queuedAt: number;
}

export function cacheMessages(channelId: string, messages: any[]): void {
  try {
    const key = `${CACHE_PREFIX}messages:${channelId}`;
    const sliced = messages.slice(0, MAX_MESSAGES_PER_CHANNEL);
    localStorage.setItem(key, JSON.stringify(sliced));
  } catch { /* quota exceeded — ignore */ }
}

export function getCachedMessages(channelId: string): any[] {
  try {
    const key = `${CACHE_PREFIX}messages:${channelId}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function cacheChannels(guildId: string, channels: any[]): void {
  try {
    localStorage.setItem(`${CACHE_PREFIX}channels:${guildId}`, JSON.stringify(channels));
  } catch { /* ignore */ }
}

export function getCachedChannels(guildId: string): any[] {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}channels:${guildId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function cacheMembers(guildId: string, members: any[]): void {
  try {
    localStorage.setItem(`${CACHE_PREFIX}members:${guildId}`, JSON.stringify(members));
  } catch { /* ignore */ }
}

export function getCachedMembers(guildId: string): any[] {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}members:${guildId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function queueMessage(channelId: string, content: string): string {
  const nonce = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    const key = `${CACHE_PREFIX}queue`;
    const queue: QueuedMessage[] = JSON.parse(localStorage.getItem(key) || '[]');
    queue.push({ channelId, content, nonce, queuedAt: Date.now() });
    localStorage.setItem(key, JSON.stringify(queue));
  } catch { /* ignore */ }
  return nonce;
}

export function getQueuedMessages(): QueuedMessage[] {
  try {
    return JSON.parse(localStorage.getItem(`${CACHE_PREFIX}queue`) || '[]');
  } catch { return []; }
}

export function clearQueue(): void {
  try { localStorage.removeItem(`${CACHE_PREFIX}queue`); } catch { /* ignore */ }
}

export function isOnline(): boolean {
  return navigator.onLine;
}
