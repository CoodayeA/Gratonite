import { create } from 'zustand';

// ── State ────────────────────────────────────────────

interface UnreadState {
  /** Set of channel IDs that have unread messages */
  unreadChannels: Set<string>;
  /** Unread message counts per channel */
  unreadCounts: Map<string, number>;
  /** Mention counts per channel */
  mentionCounts: Map<string, number>;

  // Actions
  markUnread: (channelId: string, count?: number, mentionCount?: number) => void;
  markRead: (channelId: string) => void;
  incrementUnread: (channelId: string) => void;
  incrementMention: (channelId: string) => void;
  isUnread: (channelId: string) => boolean;
  getUnreadCount: (channelId: string) => number;
  getMentionCount: (channelId: string) => number;
  getTotalUnread: () => number;
  getTotalMentions: () => number;
  clearAll: () => void;
}

export const useUnreadStore = create<UnreadState>((set, get) => ({
  unreadChannels: new Set(),
  unreadCounts: new Map(),
  mentionCounts: new Map(),

  markUnread: (channelId, count = 1, mentionCount = 0) => {
    const { unreadChannels, unreadCounts, mentionCounts } = get();

    const nextChannels = new Set(unreadChannels);
    nextChannels.add(channelId);

    const nextCounts = new Map(unreadCounts);
    nextCounts.set(channelId, count);

    const nextMentions = new Map(mentionCounts);
    if (mentionCount > 0) {
      nextMentions.set(channelId, mentionCount);
    }

    set({
      unreadChannels: nextChannels,
      unreadCounts: nextCounts,
      mentionCounts: nextMentions,
    });
  },

  markRead: (channelId) => {
    const { unreadChannels, unreadCounts, mentionCounts } = get();

    const nextChannels = new Set(unreadChannels);
    nextChannels.delete(channelId);

    const nextCounts = new Map(unreadCounts);
    nextCounts.delete(channelId);

    const nextMentions = new Map(mentionCounts);
    nextMentions.delete(channelId);

    set({
      unreadChannels: nextChannels,
      unreadCounts: nextCounts,
      mentionCounts: nextMentions,
    });
  },

  incrementUnread: (channelId) => {
    const { unreadChannels, unreadCounts } = get();

    const nextChannels = new Set(unreadChannels);
    nextChannels.add(channelId);

    const nextCounts = new Map(unreadCounts);
    const current = nextCounts.get(channelId) ?? 0;
    nextCounts.set(channelId, current + 1);

    set({ unreadChannels: nextChannels, unreadCounts: nextCounts });
  },

  incrementMention: (channelId) => {
    const { unreadChannels, mentionCounts } = get();

    const nextChannels = new Set(unreadChannels);
    nextChannels.add(channelId);

    const nextMentions = new Map(mentionCounts);
    const current = nextMentions.get(channelId) ?? 0;
    nextMentions.set(channelId, current + 1);

    set({ unreadChannels: nextChannels, mentionCounts: nextMentions });
  },

  isUnread: (channelId) => {
    return get().unreadChannels.has(channelId);
  },

  getUnreadCount: (channelId) => {
    return get().unreadCounts.get(channelId) ?? 0;
  },

  getMentionCount: (channelId) => {
    return get().mentionCounts.get(channelId) ?? 0;
  },

  getTotalUnread: () => {
    let total = 0;
    for (const count of get().unreadCounts.values()) {
      total += count;
    }
    return total;
  },

  getTotalMentions: () => {
    let total = 0;
    for (const count of get().mentionCounts.values()) {
      total += count;
    }
    return total;
  },

  clearAll: () => {
    set({
      unreadChannels: new Set(),
      unreadCounts: new Map(),
      mentionCounts: new Map(),
    });
  },
}));
