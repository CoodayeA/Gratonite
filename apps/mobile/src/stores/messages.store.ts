import { create } from 'zustand';

// ── Types ────────────────────────────────────────────

export interface MessageAttachment {
  id: string;
  messageId: string;
  filename: string;
  description?: string;
  contentType?: string;
  size: number;
  url: string;
  proxyUrl?: string;
  height?: number;
  width?: number;
}

export interface MessageReaction {
  emojiId?: string;
  emojiName: string;
  count: number;
  burstCount?: number;
  me: boolean;
}

export interface MessageAuthor {
  id: string;
  username: string;
  displayName?: string;
  avatarHash?: string;
}

export interface Message {
  id: string;
  channelId: string;
  guildId?: string;
  authorId: string;
  content: string;
  type: string;
  flags?: number;
  messageReference?: { messageId: string; channelId?: string; guildId?: string };
  referencedMessage?: Message;
  embeds?: any[];
  attachments?: MessageAttachment[];
  mentions?: string[];
  reactions?: MessageReaction[];
  pinned?: boolean;
  editedTimestamp?: string;
  createdAt: string;
  deletedAt?: string;
  author?: MessageAuthor;
}

// ── State ────────────────────────────────────────────

interface MessagesState {
  /** Messages keyed by channel ID, ordered oldest-first */
  messagesByChannel: Map<string, Message[]>;
  /** Whether more (older) messages exist for cursor pagination */
  hasMoreByChannel: Map<string, boolean>;
  /** Typing indicators: channelId → Map<userId, timestamp> */
  typingByChannel: Map<string, Map<string, number>>;
  /** ID of the message currently being edited */
  editingMessageId: string | null;
  /** Message being replied to, keyed by channel ID */
  replyingTo: Map<string, Message | null>;

  // Actions
  addMessages: (channelId: string, messages: Message[], prepend?: boolean) => void;
  addMessage: (channelId: string, message: Message) => void;
  updateMessage: (channelId: string, messageId: string, partial: Partial<Message>) => void;
  deleteMessage: (channelId: string, messageId: string) => void;
  setTyping: (channelId: string, userId: string, timestamp: number) => void;
  clearTyping: (channelId: string, userId: string) => void;
  setEditing: (messageId: string | null) => void;
  setReplyingTo: (channelId: string, message: Message | null) => void;
  setHasMore: (channelId: string, hasMore: boolean) => void;
  clearChannel: (channelId: string) => void;
}

export const useMessagesStore = create<MessagesState>((set, get) => ({
  messagesByChannel: new Map(),
  hasMoreByChannel: new Map(),
  typingByChannel: new Map(),
  editingMessageId: null,
  replyingTo: new Map(),

  addMessages: (channelId, messages, prepend = false) => {
    const { messagesByChannel } = get();
    const next = new Map(messagesByChannel);
    const existing = next.get(channelId) ?? [];

    if (prepend) {
      // Prepend older messages, deduplicate by id
      const existingIds = new Set(existing.map((m) => m.id));
      const unique = messages.filter((m) => !existingIds.has(m.id));
      next.set(channelId, [...unique, ...existing]);
    } else {
      // Append newer messages, deduplicate by id
      const existingIds = new Set(existing.map((m) => m.id));
      const unique = messages.filter((m) => !existingIds.has(m.id));
      next.set(channelId, [...existing, ...unique]);
    }

    set({ messagesByChannel: next });
  },

  addMessage: (channelId, message) => {
    const { messagesByChannel } = get();
    const next = new Map(messagesByChannel);
    const existing = next.get(channelId) ?? [];

    // Prevent duplicates
    if (existing.some((m) => m.id === message.id)) {
      return;
    }

    next.set(channelId, [...existing, message]);
    set({ messagesByChannel: next });
  },

  updateMessage: (channelId, messageId, partial) => {
    const { messagesByChannel } = get();
    const existing = messagesByChannel.get(channelId);
    if (!existing) return;

    const next = new Map(messagesByChannel);
    next.set(
      channelId,
      existing.map((m) => (m.id === messageId ? { ...m, ...partial } : m)),
    );
    set({ messagesByChannel: next });
  },

  deleteMessage: (channelId, messageId) => {
    const { messagesByChannel } = get();
    const existing = messagesByChannel.get(channelId);
    if (!existing) return;

    const next = new Map(messagesByChannel);
    next.set(
      channelId,
      existing.filter((m) => m.id !== messageId),
    );
    set({ messagesByChannel: next });
  },

  setTyping: (channelId, userId, timestamp) => {
    const { typingByChannel } = get();
    const next = new Map(typingByChannel);
    const channelTyping = new Map(next.get(channelId) ?? []);
    channelTyping.set(userId, timestamp);
    next.set(channelId, channelTyping);
    set({ typingByChannel: next });
  },

  clearTyping: (channelId, userId) => {
    const { typingByChannel } = get();
    const channelTyping = typingByChannel.get(channelId);
    if (!channelTyping?.has(userId)) return;

    const next = new Map(typingByChannel);
    const updatedTyping = new Map(channelTyping);
    updatedTyping.delete(userId);

    if (updatedTyping.size === 0) {
      next.delete(channelId);
    } else {
      next.set(channelId, updatedTyping);
    }

    set({ typingByChannel: next });
  },

  setEditing: (messageId) => {
    set({ editingMessageId: messageId });
  },

  setReplyingTo: (channelId, message) => {
    const { replyingTo } = get();
    const next = new Map(replyingTo);
    if (message === null) {
      next.delete(channelId);
    } else {
      next.set(channelId, message);
    }
    set({ replyingTo: next });
  },

  setHasMore: (channelId, hasMore) => {
    const { hasMoreByChannel } = get();
    const next = new Map(hasMoreByChannel);
    next.set(channelId, hasMore);
    set({ hasMoreByChannel: next });
  },

  clearChannel: (channelId) => {
    const { messagesByChannel, hasMoreByChannel, typingByChannel, replyingTo } = get();

    const nextMessages = new Map(messagesByChannel);
    nextMessages.delete(channelId);

    const nextHasMore = new Map(hasMoreByChannel);
    nextHasMore.delete(channelId);

    const nextTyping = new Map(typingByChannel);
    nextTyping.delete(channelId);

    const nextReply = new Map(replyingTo);
    nextReply.delete(channelId);

    set({
      messagesByChannel: nextMessages,
      hasMoreByChannel: nextHasMore,
      typingByChannel: nextTyping,
      replyingTo: nextReply,
    });
  },
}));
