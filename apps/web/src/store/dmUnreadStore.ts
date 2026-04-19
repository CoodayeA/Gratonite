import { useSyncExternalStore } from 'react';

export type DmUnreadEntry = {
  channelId: string;
  authorId: string;
  authorName: string;
  authorAvatarHash: string | null;
  isGroup: boolean;
  groupName?: string;
  /** ISO timestamp of last unread message */
  lastAt: string;
};

let state: DmUnreadEntry[] = [];
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

export function addDmUnread(entry: Omit<DmUnreadEntry, 'lastAt'>): void {
  const existing = state.find((e) => e.channelId === entry.channelId);
  if (existing) {
    // Update sender info (latest message wins) and bump timestamp
    state = state.map((e) =>
      e.channelId === entry.channelId
        ? { ...e, ...entry, lastAt: new Date().toISOString() }
        : e
    );
  } else {
    state = [...state, { ...entry, lastAt: new Date().toISOString() }];
  }
  emit();
}

export function clearDmUnread(channelId: string): void {
  if (!state.some((e) => e.channelId === channelId)) return;
  state = state.filter((e) => e.channelId !== channelId);
  emit();
}

export function clearAllDmUnread(): void {
  if (state.length === 0) return;
  state = [];
  emit();
}

export function useDmUnreadStore(): DmUnreadEntry[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
