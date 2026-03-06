import { useSyncExternalStore } from 'react';

type UnreadEntry = { mentionCount: number; hasUnread: boolean };

let state = new Map<string, UnreadEntry>();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function getSnapshot() {
  return state;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function markRead(channelId: string) {
  const next = new Map(state);
  next.delete(channelId);
  state = next;
  emit();
}

export function setUnread(channelId: string, mentionCount: number) {
  const next = new Map(state);
  next.set(channelId, { mentionCount, hasUnread: true });
  state = next;
  emit();
}

export function incrementUnread(channelId: string, mentionCount: number) {
  const next = new Map(state);
  const existing = next.get(channelId);
  next.set(channelId, {
    mentionCount: (existing?.mentionCount ?? 0) + mentionCount,
    hasUnread: true,
  });
  state = next;
  emit();
}

export function setChannelHasUnread(channelId: string) {
  const next = new Map(state);
  const existing = next.get(channelId);
  if (!existing?.hasUnread) {
    next.set(channelId, { mentionCount: existing?.mentionCount ?? 0, hasUnread: true });
    state = next;
    emit();
  }
}

export function clearAllUnread() {
  state = new Map();
  emit();
}

export function useUnreadStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function getUnreadState() {
  return state;
}

// Guild-level unread: track which guild each channel belongs to
const channelGuildMap = new Map<string, string>();

export function registerChannelGuild(channelId: string, guildId: string) {
  channelGuildMap.set(channelId, guildId);
}

export function hasGuildUnread(guildId: string): boolean {
  for (const [channelId, entry] of state) {
    if (entry.hasUnread && channelGuildMap.get(channelId) === guildId) return true;
  }
  return false;
}
