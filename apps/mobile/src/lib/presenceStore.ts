import { useSyncExternalStore } from 'react';
import type { PresenceStatus } from '../types';

interface PresenceState {
  [userId: string]: PresenceStatus;
}

let state: PresenceState = {};
let timestamps: Record<string, number> = {};
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export const presenceStore = {
  getSnapshot(): PresenceState {
    return state;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  set(userId: string, status: PresenceStatus) {
    if (state[userId] === status) return;
    const now = Date.now();
    state = { ...state, [userId]: status };
    timestamps = { ...timestamps, [userId]: now };
    emit();
  },
  setBulk(updates: Array<{ userId: string; status: PresenceStatus }>, ts?: number) {
    const now = ts ?? Date.now();
    let changed = false;
    const next = { ...state };
    const nextTs = { ...timestamps };
    for (const u of updates) {
      const existing = nextTs[u.userId] ?? 0;
      if (now >= existing && next[u.userId] !== u.status) {
        next[u.userId] = u.status;
        nextTs[u.userId] = now;
        changed = true;
      }
    }
    if (changed) {
      state = next;
      timestamps = nextTs;
      emit();
    }
  },
  get(userId: string): PresenceStatus {
    return state[userId] ?? 'offline';
  },
  reset() {
    state = {};
    timestamps = {};
    emit();
  },
};

export function usePresenceStore(): PresenceState {
  return useSyncExternalStore(presenceStore.subscribe, presenceStore.getSnapshot);
}

export function useUserPresence(userId: string): PresenceStatus {
  const all = usePresenceStore();
  return all[userId] ?? 'offline';
}
