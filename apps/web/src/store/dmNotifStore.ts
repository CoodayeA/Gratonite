import { useSyncExternalStore } from 'react';

export type DmNotif = {
  id: string;
  channelId: string;
  authorId: string;
  authorName: string;
  authorAvatarHash: string | null;
  content: string | null;
  attachmentCount: number;
  channelName?: string;
  isGroup: boolean;
};

let state: DmNotif[] = [];
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

export function pushDmNotif(notif: Omit<DmNotif, 'id'>): void {
  state = [...state, { ...notif, id: Math.random().toString(36).slice(2) }];
  emit();
}

export function dismissDmNotif(id: string): void {
  state = state.filter((n) => n.id !== id);
  emit();
}

export function useDmNotifStore(): DmNotif[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

