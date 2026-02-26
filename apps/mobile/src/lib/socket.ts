import { io, type Socket } from 'socket.io-client';
import Constants from 'expo-constants';
import { useAuthStore } from '../stores/auth.store';
import { useMessagesStore } from '../stores/messages.store';
import { scheduleLocalNotification } from './localNotification';

// ---------------------------------------------------------------------------
// URL derivation
// ---------------------------------------------------------------------------

const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;
const API_URL = extra?.['apiUrl'] ?? 'https://api.gratonite.chat';

/**
 * Derive the WebSocket base URL from the REST API URL.
 * The Socket.IO server lives at the root of the same host
 * (e.g. https://api.gratonite.chat -> wss://api.gratonite.chat).
 */
function deriveWsUrl(): string {
  try {
    // Strip path/query from API URL to get base host
    const match = API_URL.match(/^(https?:\/\/[^/?#]+)/);
    return match?.[1] ?? 'https://api.gratonite.chat';
  } catch {
    return 'https://api.gratonite.chat';
  }
}

const WS_URL = extra?.['wsUrl'] ?? deriveWsUrl();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GratoniteSocket = Socket;

interface ReadyPayload {
  userId: string;
  sessionId: string;
}

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let socket: GratoniteSocket | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let sessionId: string | null = null;
let lastSequence = 0;

/** Monotonically increasing sequence counter for event ordering. */
function nextSequence(): number {
  lastSequence += 1;
  return lastSequence;
}

// ---------------------------------------------------------------------------
// Heartbeat
// ---------------------------------------------------------------------------

const HEARTBEAT_INTERVAL_MS = 20_000; // 20 s -- server pingInterval is 25 s

function startHeartbeat(): void {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    socket?.emit('HEARTBEAT', { timestamp: Date.now() });
  }, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat(): void {
  if (heartbeatTimer !== null) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

// ---------------------------------------------------------------------------
// Typing throttle
// ---------------------------------------------------------------------------

const TYPING_THROTTLE_MS = 3_000;
const lastTypingEmit = new Map<string, number>();

/**
 * Emit a TYPING_START event for the given channel, throttled to at most once
 * every 3 seconds per channel.
 */
export function emitTyping(channelId: string): void {
  if (!socket?.connected) return;
  const now = Date.now();
  const last = lastTypingEmit.get(channelId) ?? 0;
  if (now - last < TYPING_THROTTLE_MS) return;
  lastTypingEmit.set(channelId, now);
  socket.emit('TYPING_START', { channelId });
}

// ---------------------------------------------------------------------------
// Guild subscription helpers
// ---------------------------------------------------------------------------

const subscribedGuilds = new Set<string>();

export function subscribeGuild(guildId: string): void {
  if (!socket?.connected) return;
  if (subscribedGuilds.has(guildId)) return;
  subscribedGuilds.add(guildId);
  socket.emit('GUILD_SUBSCRIBE', { guildId });
}

export function unsubscribeGuild(guildId: string): void {
  if (!socket?.connected) return;
  subscribedGuilds.delete(guildId);
  socket.emit('GUILD_UNSUBSCRIBE', { guildId });
}

// ---------------------------------------------------------------------------
// Store access helpers (lazy, via getState — never call hooks)
// ---------------------------------------------------------------------------

/**
 * Lazily import and return store getState() accessors. We do this to avoid
 * circular-import problems when stores also import from this module and to
 * keep stores that may not exist yet from crashing the socket module.
 */
function getStores() {
  // These are always safe — they're Zustand stores accessed via getState().
  const messages = useMessagesStore.getState();
  const auth = useAuthStore.getState();

  // Stores that may be created later -- we require() them lazily so this
  // module doesn't hard-fail if they haven't been created yet.
  let guilds: any = null;
  let channels: any = null;
  let members: any = null;
  let presence: any = null;
  let unread: any = null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    guilds = require('../stores/guilds.store').useGuildsStore?.getState?.() ?? null;
  } catch { /* store not yet created */ }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    channels = require('../stores/channels.store').useChannelsStore?.getState?.() ?? null;
  } catch { /* store not yet created */ }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    members = require('../stores/members.store').useMembersStore?.getState?.() ?? null;
  } catch { /* store not yet created */ }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    presence = require('../stores/presence.store').usePresenceStore?.getState?.() ?? null;
  } catch { /* store not yet created */ }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    unread = require('../stores/unread.store').useUnreadStore?.getState?.() ?? null;
  } catch { /* store not yet created */ }

  return { messages, auth, guilds, channels, members, presence, unread };
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

function registerEventHandlers(sock: GratoniteSocket): void {
  // ---- Connection lifecycle ------------------------------------------------

  sock.on('connect', () => {
    const token = useAuthStore.getState().token;
    if (!token) return;

    if (sessionId) {
      // We have an existing session — attempt to resume.
      sock.emit('RESUME', { sessionId, lastSequence });
      console.log('[Gateway] Resuming session', sessionId);
    } else {
      sock.emit('IDENTIFY', { token });
      console.log('[Gateway] Identifying');
    }
  });

  sock.on('READY', (data: ReadyPayload) => {
    sessionId = data.sessionId ?? null;
    lastSequence = 0;
    startHeartbeat();
    console.log('[Gateway] Connected and ready — session', sessionId);

    // Re-subscribe to any guilds that were subscribed before reconnect
    for (const guildId of subscribedGuilds) {
      sock.emit('GUILD_SUBSCRIBE', { guildId });
    }
  });

  sock.on('disconnect', (reason: string) => {
    stopHeartbeat();
    console.log('[Gateway] Disconnected:', reason);
  });

  sock.on('connect_error', (err: Error) => {
    console.error('[Gateway] Connection error:', err.message);
  });

  // ---- Sequence tracking (if server sends sequence numbers) ---------------

  sock.onAny((_event: string, data: any) => {
    if (data && typeof data === 'object' && typeof data.seq === 'number') {
      lastSequence = data.seq;
    }
  });

  // ---- Message events ------------------------------------------------------

  sock.on('MESSAGE_CREATE', (data: any) => {
    const { messages, auth, unread } = getStores();
    if (data?.channelId && data?.id) {
      nextSequence();
      messages.addMessage(data.channelId, data);

      // Skip unread/notification updates for the current user's own messages
      const currentUserId = auth.user?.id;
      const authorId = data.authorId ?? data.author?.id;
      if (currentUserId && authorId === currentUserId) return;

      // Update unread counts
      if (unread) {
        unread.incrementUnread(data.channelId);

        // Check if the current user is mentioned
        if (
          currentUserId &&
          Array.isArray(data.mentions) &&
          data.mentions.some(
            (m: any) => (typeof m === 'string' ? m : m?.id) === currentUserId,
          )
        ) {
          unread.incrementMention(data.channelId);
        }
      }

      // Fire a local notification when the app is in background/inactive
      const authorName =
        data.author?.displayName ?? data.author?.username ?? 'Someone';
      const body =
        data.content?.length > 100
          ? data.content.slice(0, 100) + '\u2026'
          : data.content || 'Sent an attachment';

      scheduleLocalNotification({
        title: authorName,
        body,
        channelId: data.channelId,
        guildId: data.guildId,
      });
    }
  });

  sock.on('MESSAGE_UPDATE', (data: any) => {
    const { messages } = getStores();
    if (data?.channelId && data?.id) {
      nextSequence();
      messages.updateMessage(data.channelId, data.id, data);
    }
  });

  sock.on('MESSAGE_DELETE', (data: { id: string; channelId: string }) => {
    const { messages } = getStores();
    if (data?.channelId && data?.id) {
      nextSequence();
      messages.deleteMessage(data.channelId, data.id);
    }
  });

  // ---- Read-receipt / acknowledgement events --------------------------------

  sock.on('MESSAGE_ACK', (data: { channelId: string }) => {
    if (data?.channelId) {
      const { unread } = getStores();
      unread?.markRead(data.channelId);
    }
  });

  sock.on('CHANNEL_ACK', (data: { channelId: string }) => {
    if (data?.channelId) {
      const { unread } = getStores();
      unread?.markRead(data.channelId);
    }
  });

  sock.on(
    'MESSAGE_REACTION_ADD',
    (data: { channelId: string; messageId: string; emoji: { name: string } | string; userId: string }) => {
      nextSequence();
      const { messages } = getStores();
      const emojiName = typeof data.emoji === 'string' ? data.emoji : data.emoji?.name;
      if (!emojiName || !data.channelId || !data.messageId) return;

      // Update the reaction on the message in the store.
      const channelMessages =
        messages.messagesByChannel.get(data.channelId) ?? [];
      const msg = channelMessages.find((m) => m.id === data.messageId);
      if (!msg) return;

      const currentUserId = useAuthStore.getState().user?.id;
      const reactions = [...(msg.reactions ?? [])];
      const idx = reactions.findIndex((r) => r.emojiName === emojiName);
      if (idx >= 0) {
        const existing = reactions[idx]!;
        reactions[idx] = {
          ...existing,
          emojiName: existing.emojiName,
          count: existing.count + 1,
          me: existing.me || data.userId === currentUserId,
        };
      } else {
        reactions.push({
          emojiName,
          count: 1,
          me: data.userId === currentUserId,
        });
      }
      messages.updateMessage(data.channelId, data.messageId, { reactions });
    },
  );

  sock.on(
    'MESSAGE_REACTION_REMOVE',
    (data: { channelId: string; messageId: string; emoji: { name: string } | string; userId: string }) => {
      nextSequence();
      const { messages } = getStores();
      const emojiName = typeof data.emoji === 'string' ? data.emoji : data.emoji?.name;
      if (!emojiName || !data.channelId || !data.messageId) return;

      const channelMessages =
        messages.messagesByChannel.get(data.channelId) ?? [];
      const msg = channelMessages.find((m) => m.id === data.messageId);
      if (!msg) return;

      const currentUserId = useAuthStore.getState().user?.id;
      let reactions = [...(msg.reactions ?? [])];
      const idx = reactions.findIndex((r) => r.emojiName === emojiName);
      if (idx >= 0) {
        const existing = reactions[idx]!;
        const updated = {
          ...existing,
          emojiName: existing.emojiName,
          count: existing.count - 1,
          me: data.userId === currentUserId ? false : existing.me,
        };
        if (updated.count <= 0) {
          reactions = reactions.filter((_, i) => i !== idx);
        } else {
          reactions[idx] = updated;
        }
      }
      messages.updateMessage(data.channelId, data.messageId, { reactions });
    },
  );

  // ---- Typing events -------------------------------------------------------

  sock.on('TYPING_START', (data: { channelId: string; userId: string }) => {
    if (!data?.channelId || !data?.userId) return;
    const { messages } = getStores();
    messages.setTyping(data.channelId, data.userId, Date.now());

    // Automatically clear typing after 8 seconds (server typing TTL)
    setTimeout(() => {
      useMessagesStore.getState().clearTyping(data.channelId, data.userId);
    }, 8_000);
  });

  // ---- Presence events -----------------------------------------------------

  sock.on(
    'PRESENCE_UPDATE',
    (data: { userId: string; status: 'online' | 'idle' | 'dnd' | 'offline' }) => {
      if (!data?.userId) return;
      const { presence } = getStores();
      presence?.upsert?.({ userId: data.userId, status: data.status });
    },
  );

  // ---- Guild events --------------------------------------------------------

  sock.on('GUILD_CREATE', (data: any) => {
    if (!data?.id) return;
    nextSequence();
    const { guilds } = getStores();
    guilds?.addGuild?.(data);
    // Auto-subscribe to new guilds
    subscribeGuild(data.id);
  });

  sock.on('GUILD_UPDATE', (data: any) => {
    if (!data?.id) return;
    nextSequence();
    const { guilds } = getStores();
    guilds?.updateGuild?.(data.id, data);
  });

  sock.on('GUILD_DELETE', (data: { id: string }) => {
    if (!data?.id) return;
    nextSequence();
    const { guilds } = getStores();
    guilds?.removeGuild?.(data.id);
    subscribedGuilds.delete(data.id);
  });

  // ---- Guild member events -------------------------------------------------

  sock.on('GUILD_MEMBER_ADD', (data: { guildId: string; [key: string]: any }) => {
    if (!data?.guildId) return;
    nextSequence();
    const { members } = getStores();
    members?.updateMember?.(data.guildId, data);
  });

  sock.on('GUILD_MEMBER_UPDATE', (data: { guildId: string; [key: string]: any }) => {
    if (!data?.guildId) return;
    nextSequence();
    const { members } = getStores();
    members?.updateMember?.(data.guildId, data);
  });

  sock.on('GUILD_MEMBER_REMOVE', (data: { guildId: string; userId: string }) => {
    if (!data?.guildId || !data?.userId) return;
    nextSequence();
    const { members } = getStores();
    // Remove the member entry if the store has a removeMember action
    if (typeof members?.removeMember === 'function') {
      members.removeMember(data.guildId, data.userId);
    }
  });

  // ---- Channel events ------------------------------------------------------

  sock.on('CHANNEL_CREATE', (data: any) => {
    if (!data?.id) return;
    nextSequence();
    const { channels } = getStores();
    channels?.addChannel?.(data);
  });

  sock.on('CHANNEL_UPDATE', (data: any) => {
    if (!data?.id) return;
    nextSequence();
    const { channels } = getStores();
    channels?.updateChannel?.(data.id, data);
  });

  sock.on('CHANNEL_DELETE', (data: { id: string }) => {
    if (!data?.id) return;
    nextSequence();
    const { channels } = getStores();
    channels?.removeChannel?.(data.id);
  });

  // ---- User events ---------------------------------------------------------

  sock.on('USER_UPDATE', (data: any) => {
    if (!data?.id) return;
    const { auth } = getStores();
    // If it's the current user, update the auth store
    if (auth.user?.id === data.id) {
      auth.updateUser(data);
    }
  });

  // ---- Relationship events -------------------------------------------------

  sock.on('RELATIONSHIP_ADD', (data: any) => {
    // Relationship events can be handled by invalidating the relationships
    // query or by a dedicated relationships store when it exists.
    // For now, log so that future stores can wire in easily.
    console.log('[Gateway] RELATIONSHIP_ADD', data?.id ?? data?.userId);
  });

  sock.on('RELATIONSHIP_REMOVE', (data: any) => {
    console.log('[Gateway] RELATIONSHIP_REMOVE', data?.id ?? data?.userId);
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Connect to the Gratonite gateway and identify with the given auth token.
 * If a socket already exists and is connected, this is a no-op.
 */
export function connectSocket(token: string): GratoniteSocket {
  if (socket?.connected) return socket;

  // If there is a stale, disconnected socket, clean it up first.
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }

  // Reset session on fresh connect (a RESUME may be attempted in the
  // connect handler if sessionId is already populated from a previous
  // connection).
  // We intentionally do NOT reset sessionId here so that reconnect can
  // attempt RESUME.

  socket = io(WS_URL, {
    // Start with polling (reliable in RN), then upgrade to websocket
    transports: ['polling', 'websocket'],
    autoConnect: false,
    reconnection: true,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 30_000,
    reconnectionAttempts: Infinity,
  });

  registerEventHandlers(socket);
  socket.connect();

  return socket;
}

/**
 * Disconnect the socket and clean up all state.
 */
export function disconnectSocket(): void {
  stopHeartbeat();
  lastTypingEmit.clear();

  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  sessionId = null;
  lastSequence = 0;
  subscribedGuilds.clear();
}

/**
 * Get the current socket instance (may be null if not connected).
 */
export function getSocket(): GratoniteSocket | null {
  return socket;
}
