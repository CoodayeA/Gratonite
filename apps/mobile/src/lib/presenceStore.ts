import { useSyncExternalStore } from 'react';
import type { PresenceStatus } from '../types';

interface PresenceState {
  [userId: string]: PresenceStatus;
}

let state: PresenceState = {};
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
    state = { ...state, [userId]: status };
    emit();
  },
  setBulk(updates: Array<{ userId: string; status: PresenceStatus }>) {
    let changed = false;
    const next = { ...state };
    for (const u of updates) {
      if (next[u.userId] !== u.status) {
        next[u.userId] = u.status;
        changed = true;
      }
    }
    if (changed) {
      state = next;
      emit();
    }
  },
  get(userId: string): PresenceStatus {
    return state[userId] ?? 'offline';
  },
  reset() {
    state = {};
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
