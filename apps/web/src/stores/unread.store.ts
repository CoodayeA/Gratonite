import { create } from 'zustand';

interface UnreadState {
  unreadByChannel: Set<string>;
  unreadCountByChannel: Map<string, number>;
  mentionCountByChannel: Map<string, number>;
  markUnread: (channelId: string, amount?: number) => void;
  markMention: (channelId: string, amount?: number) => void;
  markRead: (channelId: string) => void;
  clear: () => void;
}

export const useUnreadStore = create<UnreadState>((set) => ({
  unreadByChannel: new Set(),
  unreadCountByChannel: new Map(),
  mentionCountByChannel: new Map(),

  markUnread: (channelId, amount = 1) =>
    set((state) => {
      const unreadByChannel = new Set(state.unreadByChannel);
      const unreadCountByChannel = new Map(state.unreadCountByChannel);
      unreadByChannel.add(channelId);
      unreadCountByChannel.set(channelId, (unreadCountByChannel.get(channelId) ?? 0) + Math.max(1, amount));
      return { unreadByChannel, unreadCountByChannel };
    }),

  markMention: (channelId, amount = 1) =>
    set((state) => {
      const unreadByChannel = new Set(state.unreadByChannel);
      const unreadCountByChannel = new Map(state.unreadCountByChannel);
      const mentionCountByChannel = new Map(state.mentionCountByChannel);
      const nextAmount = Math.max(1, amount);
      unreadByChannel.add(channelId);
      unreadCountByChannel.set(channelId, (unreadCountByChannel.get(channelId) ?? 0) + nextAmount);
      mentionCountByChannel.set(channelId, (mentionCountByChannel.get(channelId) ?? 0) + nextAmount);
      return { unreadByChannel, unreadCountByChannel, mentionCountByChannel };
    }),

  markRead: (channelId) =>
    set((state) => {
      const unreadByChannel = new Set(state.unreadByChannel);
      const unreadCountByChannel = new Map(state.unreadCountByChannel);
      const mentionCountByChannel = new Map(state.mentionCountByChannel);
      unreadByChannel.delete(channelId);
      unreadCountByChannel.delete(channelId);
      mentionCountByChannel.delete(channelId);
      return { unreadByChannel, unreadCountByChannel, mentionCountByChannel };
    }),

  clear: () =>
    set({
      unreadByChannel: new Set(),
      unreadCountByChannel: new Map(),
      mentionCountByChannel: new Map(),
    }),
}));
