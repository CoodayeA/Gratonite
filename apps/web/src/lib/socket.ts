import { io, type Socket } from 'socket.io-client';
import { getAccessToken } from './api';

// Use 'any' for now — the typed events from @gratonite/types will be
// applied at the call-site via casting when needed.
type GratoniteSocket = Socket;

let socket: GratoniteSocket | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

function startHeartbeat() {
  stopHeartbeat();
  heartbeatInterval = setInterval(() => {
    socket?.emit('HEARTBEAT', { timestamp: Date.now() });
  }, 20_000); // 20s — server pingInterval is 25s
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

export function connectSocket(): GratoniteSocket {
  if (socket?.connected) return socket;

  const wsUrl = import.meta.env.VITE_WS_URL ?? 'http://localhost:4000';

  socket = io(wsUrl, {
    transports: ['websocket', 'polling'],
    autoConnect: false,
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
    startHeartbeat();
    console.log('[Gateway] Connected and ready');
  });

  socket.on('disconnect', (reason) => {
    stopHeartbeat();
    console.log('[Gateway] Disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.error('[Gateway] Connection error:', err.message);
  });

  socket.connect();
  return socket;
}

export function disconnectSocket(): void {
  stopHeartbeat();
  socket?.disconnect();
  socket = null;
}

export function getSocket(): GratoniteSocket | null {
  return socket;
}
