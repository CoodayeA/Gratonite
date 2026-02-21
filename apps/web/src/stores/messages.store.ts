import { create } from 'zustand';
import type { Message } from '@gratonite/types';

interface MessagesState {
  /** channelId → ordered Message[] (oldest first) */
  messagesByChannel: Map<string, Message[]>;
  /** channelId → whether there are older messages to load */
  hasMoreByChannel: Map<string, boolean>;
  /** channelId → Map<userId, lastTypingTimestamp> */
  typingByChannel: Map<string, Map<string, number>>;
  /** Currently-editing message ID (or null) */
  editingMessageId: string | null;
  /** channelId → message being replied to */
  replyingTo: Map<string, Message | null>;

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
  /** Set the message being edited. */
  setEditingMessage: (id: string | null) => void;
  /** Set the message being replied to for a channel. */
  setReplyingTo: (channelId: string, message: Message | null) => void;
  /** Add a reaction to a message locally. */
  addReaction: (channelId: string, messageId: string, emoji: string, userId: string) => void;
  /** Remove a reaction from a message locally. */
  removeReaction: (channelId: string, messageId: string, emoji: string, userId: string) => void;
  /** Clear all data (on logout). */
  clear: () => void;
}

export const useMessagesStore = create<MessagesState>((set) => ({
  messagesByChannel: new Map(),
  hasMoreByChannel: new Map(),
  typingByChannel: new Map(),
  editingMessageId: null,
  replyingTo: new Map(),

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

  setEditingMessage: (id) =>
    set({ editingMessageId: id }),

  setReplyingTo: (channelId, message) =>
    set((state) => {
      const map = new Map(state.replyingTo);
      if (message) {
        map.set(channelId, message);
      } else {
        map.delete(channelId);
      }
      return { replyingTo: map };
    }),

  addReaction: (channelId, messageId, emoji, userId) =>
    set((state) => {
      const existing = state.messagesByChannel.get(channelId);
      if (!existing) return state;
      const idx = existing.findIndex((m) => m.id === messageId);
      if (idx < 0) return state;

      const msg = existing[idx]!;
      const reactions = [...((msg as any).reactions ?? [])];
      const reactionIdx = reactions.findIndex((r: any) => r.emoji === emoji);
      if (reactionIdx >= 0) {
        const r = { ...reactions[reactionIdx]! };
        r.count = (r.count ?? 0) + 1;
        r.userIds = [...(r.userIds ?? []), userId];
        reactions[reactionIdx] = r;
      } else {
        reactions.push({ emoji, count: 1, userIds: [userId] });
      }

      const updated = [...existing];
      updated[idx] = { ...msg, reactions } as any;
      const map = new Map(state.messagesByChannel);
      map.set(channelId, updated);
      return { messagesByChannel: map };
    }),

  removeReaction: (channelId, messageId, emoji, userId) =>
    set((state) => {
      const existing = state.messagesByChannel.get(channelId);
      if (!existing) return state;
      const idx = existing.findIndex((m) => m.id === messageId);
      if (idx < 0) return state;

      const msg = existing[idx]!;
      let reactions = [...((msg as any).reactions ?? [])];
      const reactionIdx = reactions.findIndex((r: any) => r.emoji === emoji);
      if (reactionIdx < 0) return state;

      const r = { ...reactions[reactionIdx]! };
      r.count = Math.max(0, (r.count ?? 1) - 1);
      r.userIds = (r.userIds ?? []).filter((id: string) => id !== userId);
      if (r.count <= 0) {
        reactions.splice(reactionIdx, 1);
      } else {
        reactions[reactionIdx] = r;
      }

      const updated = [...existing];
      updated[idx] = { ...msg, reactions } as any;
      const map = new Map(state.messagesByChannel);
      map.set(channelId, updated);
      return { messagesByChannel: map };
    }),

  clear: () =>
    set({
      messagesByChannel: new Map(),
      hasMoreByChannel: new Map(),
      typingByChannel: new Map(),
      editingMessageId: null,
      replyingTo: new Map(),
    }),
}));
