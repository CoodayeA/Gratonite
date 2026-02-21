import { create } from 'zustand';

interface UnreadState {
  unreadByChannel: Set<string>;
  markUnread: (channelId: string) => void;
  markRead: (channelId: string) => void;
  clear: () => void;
}

export const useUnreadStore = create<UnreadState>((set) => ({
  unreadByChannel: new Set(),

  markUnread: (channelId) =>
    set((state) => {
      const unreadByChannel = new Set(state.unreadByChannel);
      unreadByChannel.add(channelId);
      return { unreadByChannel };
    }),

  markRead: (channelId) =>
    set((state) => {
      const unreadByChannel = new Set(state.unreadByChannel);
      unreadByChannel.delete(channelId);
      return { unreadByChannel };
    }),

  clear: () => set({ unreadByChannel: new Set() }),
}));
