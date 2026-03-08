import { useSyncExternalStore } from 'react';

interface UnreadState {
  [channelId: string]: { count: number; mentionCount: number; lastReadMessageId: string | null };
}

let state: UnreadState = {};
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export const unreadStore = {
  getSnapshot(): UnreadState {
    return state;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  setReadState(channelId: string, lastReadMessageId: string | null, mentionCount: number) {
    state = {
      ...state,
      [channelId]: { count: 0, mentionCount, lastReadMessageId },
    };
    emit();
  },
  incrementUnread(channelId: string, isMention: boolean) {
    const prev = state[channelId] ?? { count: 0, mentionCount: 0, lastReadMessageId: null };
    state = {
      ...state,
      [channelId]: {
        ...prev,
        count: prev.count + 1,
        mentionCount: prev.mentionCount + (isMention ? 1 : 0),
      },
    };
    emit();
  },
  markRead(channelId: string, lastReadMessageId: string) {
    state = {
      ...state,
      [channelId]: { count: 0, mentionCount: 0, lastReadMessageId },
    };
    emit();
  },
  getChannelUnread(channelId: string) {
    return state[channelId] ?? { count: 0, mentionCount: 0, lastReadMessageId: null };
  },
  getTotalUnread(): number {
    return Object.values(state).reduce((sum, s) => sum + s.count, 0);
  },
  getTotalMentions(): number {
    return Object.values(state).reduce((sum, s) => sum + s.mentionCount, 0);
  },
  reset() {
    state = {};
    emit();
  },
};

export function useUnreadStore(): UnreadState {
  return useSyncExternalStore(unreadStore.subscribe, unreadStore.getSnapshot);
}

export function useChannelUnread(channelId: string) {
  const all = useUnreadStore();
  return all[channelId] ?? { count: 0, mentionCount: 0, lastReadMessageId: null };
}
