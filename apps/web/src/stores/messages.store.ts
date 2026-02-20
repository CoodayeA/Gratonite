import { create } from 'zustand';
import type { Message } from '@gratonite/types';

interface MessagesState {
  /** channelId → ordered Message[] (oldest first) */
  messagesByChannel: Map<string, Message[]>;
  /** channelId → whether there are older messages to load */
  hasMoreByChannel: Map<string, boolean>;
  /** channelId → Map<userId, lastTypingTimestamp> */
  typingByChannel: Map<string, Map<string, number>>;

  /** Add a new message (from send or gateway). Deduplicates by nonce. */
  addMessage: (message: Message) => void;
  /** Prepend older messages (from pagination). */
  prependMessages: (channelId: string, messages: Message[], hasMore: boolean) => void;
  /** Set initial messages for a channel. */
  setMessages: (channelId: string, messages: Message[], hasMore: boolean) => void;
  /** Update a message in-place. */
  updateMessage: (channelId: string, messageId: string, partial: Partial<Message>) => void;
  /** Remove a message (soft delete from gateway). */
  removeMessage: (channelId: string, messageId: string) => void;
  /** Record a typing indicator. */
  setTyping: (channelId: string, userId: string, timestamp: number) => void;
  /** Clear a typing indicator. */
  clearTyping: (channelId: string, userId: string) => void;
  /** Clear all data (on logout). */
  clear: () => void;
}

export const useMessagesStore = create<MessagesState>((set) => ({
  messagesByChannel: new Map(),
  hasMoreByChannel: new Map(),
  typingByChannel: new Map(),

  addMessage: (message) =>
    set((state) => {
      const channelId = message.channelId;
      const existing = state.messagesByChannel.get(channelId) ?? [];

      // Deduplicate by nonce (replace optimistic message)
      const nonce = (message as Message & { nonce?: string }).nonce;
      let updated: Message[];
      if (nonce) {
        const optimisticIdx = existing.findIndex(
          (m) => (m as Message & { nonce?: string }).nonce === nonce,
        );
        if (optimisticIdx >= 0) {
          updated = [...existing];
          updated[optimisticIdx] = message;
          const map = new Map(state.messagesByChannel);
          map.set(channelId, updated);
          return { messagesByChannel: map };
        }
      }

      // Deduplicate by ID
      if (existing.some((m) => m.id === message.id)) {
        return state;
      }

      updated = [...existing, message];
      const map = new Map(state.messagesByChannel);
      map.set(channelId, updated);
      return { messagesByChannel: map };
    }),

  prependMessages: (channelId, messages, hasMore) =>
    set((state) => {
      const existing = state.messagesByChannel.get(channelId) ?? [];
      const existingIds = new Set(existing.map((m) => m.id));
      const newMessages = messages.filter((m) => !existingIds.has(m.id));

      const map = new Map(state.messagesByChannel);
      map.set(channelId, [...newMessages, ...existing]);

      const hasMoreMap = new Map(state.hasMoreByChannel);
      hasMoreMap.set(channelId, hasMore);

      return { messagesByChannel: map, hasMoreByChannel: hasMoreMap };
    }),

  setMessages: (channelId, messages, hasMore) =>
    set((state) => {
      const map = new Map(state.messagesByChannel);
      map.set(channelId, messages);

      const hasMoreMap = new Map(state.hasMoreByChannel);
      hasMoreMap.set(channelId, hasMore);

      return { messagesByChannel: map, hasMoreByChannel: hasMoreMap };
    }),

  updateMessage: (channelId, messageId, partial) =>
    set((state) => {
      const existing = state.messagesByChannel.get(channelId);
      if (!existing) return state;
      const idx = existing.findIndex((m) => m.id === messageId);
      if (idx < 0) return state;

      const updated = [...existing];
      updated[idx] = { ...updated[idx]!, ...partial };
      const map = new Map(state.messagesByChannel);
      map.set(channelId, updated);
      return { messagesByChannel: map };
    }),

  removeMessage: (channelId, messageId) =>
    set((state) => {
      const existing = state.messagesByChannel.get(channelId);
      if (!existing) return state;
      const map = new Map(state.messagesByChannel);
      map.set(
        channelId,
        existing.filter((m) => m.id !== messageId),
      );
      return { messagesByChannel: map };
    }),

  setTyping: (channelId, userId, timestamp) =>
    set((state) => {
      const map = new Map(state.typingByChannel);
      const channelTyping = new Map(map.get(channelId) ?? new Map());
      channelTyping.set(userId, timestamp);
      map.set(channelId, channelTyping);
      return { typingByChannel: map };
    }),

  clearTyping: (channelId, userId) =>
    set((state) => {
      const map = new Map(state.typingByChannel);
      const channelTyping = map.get(channelId);
      if (!channelTyping) return state;
      const updated = new Map(channelTyping);
      updated.delete(userId);
      map.set(channelId, updated);
      return { typingByChannel: map };
    }),

  clear: () =>
    set({
      messagesByChannel: new Map(),
      hasMoreByChannel: new Map(),
      typingByChannel: new Map(),
    }),
}));
