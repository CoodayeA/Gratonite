/**
 * Socket.io client for real-time events.
 * Matches the web prototype's socket protocol (IDENTIFY, HEARTBEAT, READY, etc.)
 */

import { io, Socket } from 'socket.io-client';
import { API_BASE, getAccessToken } from './api';

let socket: Socket | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

// Derive the socket URL from API_BASE (strip /api/v1)
const SOCKET_URL = API_BASE.replace(/\/api\/v1$/, '');

export function connectSocket(): Socket {
  if (socket?.connected) return socket;

  socket = io(SOCKET_URL, {
    autoConnect: false,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    reconnectionAttempts: Infinity,
  });

  socket.on('connect', () => {
    const token = getAccessToken();
    if (token) {
      socket!.emit('IDENTIFY', { token });
    }
  });

  socket.on('READY', () => {
    // Start heartbeat
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
      socket?.emit('HEARTBEAT', { timestamp: Date.now() });
    }, 20000);
  });

  socket.on('disconnect', () => {
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
}

export function getSocket(): Socket | null {
  return socket;
}

// Typed listener helpers
export function onPresenceUpdate(
  cb: (data: { userId: string; status: string }) => void,
): () => void {
  socket?.on('PRESENCE_UPDATE', cb);
  return () => { socket?.off('PRESENCE_UPDATE', cb); };
}

export function onTypingStart(
  cb: (data: { channelId: string; userId: string; username: string; timestamp: number }) => void,
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
