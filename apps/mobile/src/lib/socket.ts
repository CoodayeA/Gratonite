/**
 * Socket.io client for real-time events.
 * Matches the web prototype's socket protocol (IDENTIFY, HEARTBEAT, READY, etc.)
 */

import { io, Socket } from 'socket.io-client';
import { getApiBase, getAccessToken } from './api';

let socket: Socket | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
const socketSubscribers = new Set<(nextSocket: Socket | null) => void>();

function notifySocketSubscribers(): void {
  for (const subscriber of socketSubscribers) {
    subscriber(socket);
  }
}

// Derive the socket URL from API_BASE (strip /api/v1)
function getSocketUrl(): string {
  // Remove /api/v1 from the end to get base server URL
  return getApiBase().replace(/\/api\/v1\/?$/, '') || 'https://api.gratonite.chat';
}

export function connectSocket(): Socket {
  if (socket?.connected) return socket;

  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }

  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  const token = getAccessToken();
  socket = io(getSocketUrl(), {
    autoConnect: false,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    reconnectionAttempts: Infinity,
    auth: token ? { token } : undefined,
  });
  notifySocketSubscribers();

  socket.on('connect', () => {
    const token = getAccessToken();
    if (token) {
      socket!.emit('IDENTIFY', { token });
    }
  });

  socket.on('READY', () => {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
      socket?.emit('HEARTBEAT', { timestamp: Date.now() });
    }, 20000);
  });

  socket.on('IDENTIFY_FAILED', () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    socket?.disconnect();
  });

  socket.on('disconnect', () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  });

  socket.on('connect_error', () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  });

  socket.connect();
  return socket;
}

export function disconnectSocket(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  socket?.disconnect();
  socket = null;
  notifySocketSubscribers();
}

export function getSocket(): Socket | null {
  return socket;
}

export function subscribeToSocket(
  cb: (nextSocket: Socket | null) => void,
): () => void {
  socketSubscribers.add(cb);
  cb(socket);
  return () => {
    socketSubscribers.delete(cb);
  };
}

// Typed listener helpers
export function onPresenceUpdate(
  cb: (data: { userId: string; status: string }) => void,
): () => void {
  socket?.on('PRESENCE_UPDATE', cb);
  return () => { socket?.off('PRESENCE_UPDATE', cb); };
}

export function onTypingStart(
  cb: (data: { channelId: string; userId: string; username: string; displayName?: string | null; timestamp: number }) => void,
): () => void {
  socket?.on('TYPING_START', cb);
  return () => { socket?.off('TYPING_START', cb); };
}

export function onMessageCreate(
  cb: (data: any) => void,
): () => void {
  socket?.on('MESSAGE_CREATE', cb);
  return () => { socket?.off('MESSAGE_CREATE', cb); };
}

export function onMessageUpdate(
  cb: (data: any) => void,
): () => void {
  socket?.on('MESSAGE_UPDATE', cb);
  return () => { socket?.off('MESSAGE_UPDATE', cb); };
}

export function onMessageDelete(
  cb: (data: { id: string; channelId: string }) => void,
): () => void {
  socket?.on('MESSAGE_DELETE', cb);
  return () => { socket?.off('MESSAGE_DELETE', cb); };
}

export function onNotificationCreate(
  cb: (data: { id: string; type: string; title: string; body: string }) => void,
): () => void {
  socket?.on('NOTIFICATION_CREATE', cb);
  return () => { socket?.off('NOTIFICATION_CREATE', cb); };
}

export function onVoiceStateUpdate(
  cb: (data: { channelId: string; userId: string; selfMute: boolean; selfDeaf: boolean; sessionId: string }) => void,
): () => void {
  socket?.on('VOICE_STATE_UPDATE', cb);
  return () => { socket?.off('VOICE_STATE_UPDATE', cb); };
}

export function onMessageReactionAdd(
  cb: (data: { messageId: string; channelId: string; userId: string; emoji: string }) => void,
): () => void {
  socket?.on('MESSAGE_REACTION_ADD', cb);
  return () => { socket?.off('MESSAGE_REACTION_ADD', cb); };
}

export function onMessageReactionRemove(
  cb: (data: { messageId: string; channelId: string; userId: string; emoji: string }) => void,
): () => void {
  socket?.on('MESSAGE_REACTION_REMOVE', cb);
  return () => { socket?.off('MESSAGE_REACTION_REMOVE', cb); };
}

export function onChannelUpdate(
  cb: (data: { id: string; guildId: string; name?: string; topic?: string; position?: number }) => void,
): () => void {
  socket?.on('CHANNEL_UPDATE', cb);
  return () => { socket?.off('CHANNEL_UPDATE', cb); };
}

export function onGuildUpdate(
  cb: (data: { id: string; name?: string; iconHash?: string | null }) => void,
): () => void {
  socket?.on('GUILD_UPDATE', cb);
  return () => { socket?.off('GUILD_UPDATE', cb); };
}

export function onMemberJoin(
  cb: (data: { guildId: string; userId: string; username: string }) => void,
): () => void {
  socket?.on('GUILD_MEMBER_ADD', cb);
  return () => { socket?.off('GUILD_MEMBER_ADD', cb); };
}

export function onMemberLeave(
  cb: (data: { guildId: string; userId: string }) => void,
): () => void {
  socket?.on('GUILD_MEMBER_REMOVE', cb);
  return () => { socket?.off('GUILD_MEMBER_REMOVE', cb); };
}

export function onReadStateUpdate(
  cb: (data: { channelId: string; lastReadMessageId: string; mentionCount: number }) => void,
): () => void {
  socket?.on('READ_STATE_UPDATE', cb);
  return () => { socket?.off('READ_STATE_UPDATE', cb); };
}

export function onScreenshotTaken(
  cb: (data: { channelId: string; userId: string; timestamp: number }) => void,
): () => void {
  socket?.on('SCREENSHOT_TAKEN', cb);
  return () => { socket?.off('SCREENSHOT_TAKEN', cb); };
}
