import { io, type Socket } from 'socket.io-client';
import { getAccessToken } from './api';

type GratoniteSocket = Socket;

/* ── Event payload types ────────────────────────────────────── */

export interface PresenceUpdatePayload {
  userId: string;
  status: 'online' | 'idle' | 'dnd' | 'invisible' | 'offline';
  activity?: { name: string; type: string } | null;
}

export interface TypingStartPayload {
  channelId: string;
  userId: string;
  username: string;
  timestamp: number;
}

export interface NotificationCreatePayload {
  id: string;
  type: string;
  title: string;
  body: string;
  channelId?: string;
  guildId?: string;
  createdAt: string;
}

export interface MessageCreatePayload {
  id: string;
  channelId: string;
  authorId: string;
  content: string | null;
  attachments: any[];
  edited: boolean;
  editedAt: string | null;
  createdAt: string;
  expiresAt?: string | null;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarHash: string | null;
    nameplateStyle?: string | null;
  } | null;
}

export type MessageUpdatePayload = MessageCreatePayload;

export interface MessageDeletePayload {
  id: string;
  channelId: string;
}

export interface MessageDeleteBulkPayload {
  ids: string[];
  channelId: string;
}

export interface ReactionPayload {
  messageId: string;
  channelId: string;
  userId: string;
  emoji: string;
}

export interface VoiceStateUpdatePayload {
  type: 'join' | 'leave';
  userId: string;
  username?: string;
  displayName?: string;
  channelId: string;
  selfMute?: boolean;
  selfDeaf?: boolean;
}

export interface ThreadCreatePayload {
  id: string;
  channelId: string;
  name: string;
  creatorId: string;
  originMessageId: string | null;
  archived: boolean;
  locked: boolean;
  createdAt: string;
}

export interface ChannelPinsUpdatePayload {
  channelId: string;
  messageId: string;
  pinned: boolean;
}

export interface MessageReadPayload {
  channelId: string;
  userId: string;
  lastReadAt: string;
  lastReadMessageId: string | null;
}

export interface StageStartPayload {
  channelId: string;
  topic: string | null;
  sessionId: string;
  hostId: string;
}

export interface StageEndPayload {
  channelId: string;
  sessionId: string;
}

export interface StageSpeakerAddPayload {
  channelId: string;
  sessionId: string;
  userId: string;
  invitedBy: string;
}

export interface StageSpeakerRemovePayload {
  channelId: string;
  sessionId: string;
  userId: string;
}

export interface StageHandRaisePayload {
  channelId: string;
  sessionId: string;
  userId: string;
}

/* ── Callback registries ────────────────────────────────────── */

type PresenceCallback = (payload: PresenceUpdatePayload) => void;
type TypingCallback = (payload: TypingStartPayload) => void;
type NotificationCallback = (payload: NotificationCreatePayload) => void;
type MessageCreateCallback = (payload: MessageCreatePayload) => void;
type MessageUpdateCallback = (payload: MessageUpdatePayload) => void;
type MessageDeleteCallback = (payload: MessageDeletePayload) => void;
type MessageDeleteBulkCallback = (payload: MessageDeleteBulkPayload) => void;
type ReactionCallback = (payload: ReactionPayload) => void;
type VoiceStateUpdateCallback = (payload: VoiceStateUpdatePayload) => void;
type ThreadCreateCallback = (payload: ThreadCreatePayload) => void;
type ChannelPinsUpdateCallback = (payload: ChannelPinsUpdatePayload) => void;
type MessageReadCallback = (payload: MessageReadPayload) => void;
type ConnectionCallback = () => void;
type StageStartCallback = (payload: StageStartPayload) => void;
type StageEndCallback = (payload: StageEndPayload) => void;
type StageSpeakerAddCallback = (payload: StageSpeakerAddPayload) => void;
type StageSpeakerRemoveCallback = (payload: StageSpeakerRemovePayload) => void;
type StageHandRaiseCallback = (payload: StageHandRaisePayload) => void;

const presenceListeners = new Set<PresenceCallback>();
const typingStartListeners = new Set<TypingCallback>();
const notificationListeners = new Set<NotificationCallback>();
const messageCreateListeners = new Set<MessageCreateCallback>();
const messageUpdateListeners = new Set<MessageUpdateCallback>();
const messageDeleteListeners = new Set<MessageDeleteCallback>();
const messageDeleteBulkListeners = new Set<MessageDeleteBulkCallback>();
const reactionAddListeners = new Set<ReactionCallback>();
const reactionRemoveListeners = new Set<ReactionCallback>();
const voiceStateUpdateListeners = new Set<VoiceStateUpdateCallback>();
const threadCreateListeners = new Set<ThreadCreateCallback>();
const channelPinsUpdateListeners = new Set<ChannelPinsUpdateCallback>();
const messageReadListeners = new Set<MessageReadCallback>();
const socketDisconnectListeners = new Set<ConnectionCallback>();
const socketReconnectListeners = new Set<ConnectionCallback>();
const stageStartListeners = new Set<StageStartCallback>();
const stageEndListeners = new Set<StageEndCallback>();
const stageSpeakerAddListeners = new Set<StageSpeakerAddCallback>();
const stageSpeakerRemoveListeners = new Set<StageSpeakerRemoveCallback>();
const stageHandRaiseListeners = new Set<StageHandRaiseCallback>();

export interface ChannelBackgroundUpdatedPayload {
  channelId: string;
  backgroundUrl: string | null;
  backgroundType: string | null;
}
type ChannelBgCallback = (p: ChannelBackgroundUpdatedPayload) => void;
const channelBgListeners = new Set<ChannelBgCallback>();

export function onPresenceUpdate(cb: PresenceCallback): () => void {
  presenceListeners.add(cb);
  return () => { presenceListeners.delete(cb); };
}

export function onTypingStart(cb: TypingCallback): () => void {
  typingStartListeners.add(cb);
  return () => { typingStartListeners.delete(cb); };
}

export function onNotificationCreate(cb: NotificationCallback): () => void {
  notificationListeners.add(cb);
  return () => { notificationListeners.delete(cb); };
}

export function onMessageCreate(cb: MessageCreateCallback): () => void {
  messageCreateListeners.add(cb);
  return () => { messageCreateListeners.delete(cb); };
}

export function onMessageUpdate(cb: MessageUpdateCallback): () => void {
  messageUpdateListeners.add(cb);
  return () => { messageUpdateListeners.delete(cb); };
}

export function onMessageDelete(cb: MessageDeleteCallback): () => void {
  messageDeleteListeners.add(cb);
  return () => { messageDeleteListeners.delete(cb); };
}

export function onMessageDeleteBulk(cb: MessageDeleteBulkCallback): () => void {
  messageDeleteBulkListeners.add(cb);
  return () => { messageDeleteBulkListeners.delete(cb); };
}

export function onReactionAdd(cb: ReactionCallback): () => void {
  reactionAddListeners.add(cb);
  return () => { reactionAddListeners.delete(cb); };
}

export function onReactionRemove(cb: ReactionCallback): () => void {
  reactionRemoveListeners.add(cb);
  return () => { reactionRemoveListeners.delete(cb); };
}

export function onVoiceStateUpdate(cb: VoiceStateUpdateCallback): () => void {
  voiceStateUpdateListeners.add(cb);
  return () => { voiceStateUpdateListeners.delete(cb); };
}

export function onThreadCreate(cb: ThreadCreateCallback): () => void {
  threadCreateListeners.add(cb);
  return () => { threadCreateListeners.delete(cb); };
}

export function onChannelPinsUpdate(cb: ChannelPinsUpdateCallback): () => void {
  channelPinsUpdateListeners.add(cb);
  return () => { channelPinsUpdateListeners.delete(cb); };
}

export function onMessageRead(cb: MessageReadCallback): () => void {
  messageReadListeners.add(cb);
  return () => { messageReadListeners.delete(cb); };
}

export function onSocketDisconnect(cb: ConnectionCallback): () => void {
  socketDisconnectListeners.add(cb);
  return () => { socketDisconnectListeners.delete(cb); };
}

export function onSocketReconnect(cb: ConnectionCallback): () => void {
  socketReconnectListeners.add(cb);
  return () => { socketReconnectListeners.delete(cb); };
}

export function onStageStart(cb: StageStartCallback): () => void {
  stageStartListeners.add(cb);
  return () => { stageStartListeners.delete(cb); };
}

export function onStageEnd(cb: StageEndCallback): () => void {
  stageEndListeners.add(cb);
  return () => { stageEndListeners.delete(cb); };
}

export function onStageSpeakerAdd(cb: StageSpeakerAddCallback): () => void {
  stageSpeakerAddListeners.add(cb);
  return () => { stageSpeakerAddListeners.delete(cb); };
}

export function onStageSpeakerRemove(cb: StageSpeakerRemoveCallback): () => void {
  stageSpeakerRemoveListeners.add(cb);
  return () => { stageSpeakerRemoveListeners.delete(cb); };
}

export function onStageHandRaise(cb: StageHandRaiseCallback): () => void {
  stageHandRaiseListeners.add(cb);
  return () => { stageHandRaiseListeners.delete(cb); };
}

export function onChannelBackgroundUpdated(cb: ChannelBgCallback): () => void {
  channelBgListeners.add(cb);
  return () => { channelBgListeners.delete(cb); };
}

/* ── Spatial audio position events ─────────────────────────── */

export interface SpatialPositionUpdatePayload {
  channelId: string;
  userId: string;
  x: number;
  y: number;
}

export interface SpatialPositionsSyncPayload {
  channelId: string;
  positions: Record<string, { x: number; y: number }>;
}

type SpatialPositionUpdateCallback = (payload: SpatialPositionUpdatePayload) => void;
type SpatialPositionsSyncCallback = (payload: SpatialPositionsSyncPayload) => void;

const spatialPositionUpdateListeners = new Set<SpatialPositionUpdateCallback>();
const spatialPositionsSyncListeners = new Set<SpatialPositionsSyncCallback>();

export function onSpatialPositionUpdate(cb: SpatialPositionUpdateCallback): () => void {
  spatialPositionUpdateListeners.add(cb);
  return () => { spatialPositionUpdateListeners.delete(cb); };
}

export function onSpatialPositionsSync(cb: SpatialPositionsSyncCallback): () => void {
  spatialPositionsSyncListeners.add(cb);
  return () => { spatialPositionsSyncListeners.delete(cb); };
}

let socket: GratoniteSocket | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let idleTimeout: ReturnType<typeof setTimeout> | null = null;
let isIdle = false;

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

function startHeartbeat() {
  stopHeartbeat();
  heartbeatInterval = setInterval(() => {
    socket?.emit('HEARTBEAT', { timestamp: Date.now() });
  }, 20_000);
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

function resetIdleTimer() {
  if (idleTimeout) clearTimeout(idleTimeout);
  if (isIdle && socket?.connected) {
    isIdle = false;
    socket.emit('PRESENCE_UPDATE', { status: 'online' });
  }
  idleTimeout = setTimeout(() => {
    if (socket?.connected) {
      isIdle = true;
      socket.emit('PRESENCE_UPDATE', { status: 'idle' });
    }
  }, IDLE_TIMEOUT_MS);
}

function startIdleDetection() {
  const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
  events.forEach(evt => window.addEventListener(evt, resetIdleTimer, { passive: true }));
  resetIdleTimer();
}

function stopIdleDetection() {
  if (idleTimeout) {
    clearTimeout(idleTimeout);
    idleTimeout = null;
  }
  isIdle = false;
}

export function connectSocket(): GratoniteSocket {
  if (socket && (socket.connected || socket.active)) return socket;

  const explicitWsUrl = import.meta.env.VITE_WS_URL;
  const apiBase = import.meta.env.VITE_API_URL as string | undefined;
  let derivedWsUrl: string | null = null;
  if (!explicitWsUrl && apiBase) {
    try {
      const apiUrl = new URL(apiBase, window.location.origin);
      apiUrl.pathname = '';
      apiUrl.search = '';
      apiUrl.hash = '';
      derivedWsUrl = apiUrl.toString().replace(/\/$/, '');
    } catch {
      derivedWsUrl = null;
    }
  }

  const wsUrl =
    explicitWsUrl ??
    derivedWsUrl ??
    window.location.origin;

  const token = getAccessToken();

  socket = io(wsUrl, {
    transports: ['websocket', 'polling'],
    autoConnect: false,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    reconnectionAttempts: Infinity,
    auth: token ? { token } : undefined,
    query: token ? { token } : undefined,
  });

  socket.on('connect', () => {
    // Also send IDENTIFY for compatibility — server already authed via handshake
    const t = getAccessToken();
    if (t) {
      socket!.emit('IDENTIFY', { token: t });
    }
    // Notify reconnect listeners (fires on initial connect too, banner handles state)
    socketReconnectListeners.forEach(cb => cb());
  });

  socket.on('READY', () => {
    startHeartbeat();
    startIdleDetection();
  });

  /* ── Dispatch gateway events to registered listeners ──── */

  socket.on('PRESENCE_UPDATE', (data: PresenceUpdatePayload) => {
    presenceListeners.forEach(cb => cb(data));
  });

  socket.on('TYPING_START', (data: TypingStartPayload) => {
    typingStartListeners.forEach(cb => cb(data));
  });

  socket.on('NOTIFICATION_CREATE', (data: NotificationCreatePayload) => {
    notificationListeners.forEach(cb => cb(data));
  });

  socket.on('MESSAGE_CREATE', (data: MessageCreatePayload) => {
    messageCreateListeners.forEach(cb => cb(data));
  });

  socket.on('MESSAGE_UPDATE', (data: MessageUpdatePayload) => {
    messageUpdateListeners.forEach(cb => cb(data));
  });

  socket.on('MESSAGE_DELETE', (data: MessageDeletePayload) => {
    messageDeleteListeners.forEach(cb => cb(data));
  });

  socket.on('MESSAGE_DELETE_BULK', (data: MessageDeleteBulkPayload) => {
    messageDeleteBulkListeners.forEach(cb => cb(data));
  });

  socket.on('VOICE_STATE_UPDATE', (data: VoiceStateUpdatePayload) => {
    voiceStateUpdateListeners.forEach(cb => cb(data));
  });

  socket.on('MESSAGE_REACTION_ADD', (data: ReactionPayload) => {
    reactionAddListeners.forEach(cb => cb(data));
  });

  socket.on('MESSAGE_REACTION_REMOVE', (data: ReactionPayload) => {
    reactionRemoveListeners.forEach(cb => cb(data));
  });

  socket.on('THREAD_CREATE', (data: ThreadCreatePayload) => {
    threadCreateListeners.forEach(cb => cb(data));
  });

  socket.on('CHANNEL_PINS_UPDATE', (data: ChannelPinsUpdatePayload) => {
    channelPinsUpdateListeners.forEach(cb => cb(data));
  });

  socket.on('MESSAGE_READ', (data: MessageReadPayload) => {
    messageReadListeners.forEach(cb => cb(data));
  });

  socket.on('STAGE_START', (data: StageStartPayload) => {
    stageStartListeners.forEach(cb => cb(data));
  });

  socket.on('STAGE_END', (data: StageEndPayload) => {
    stageEndListeners.forEach(cb => cb(data));
  });

  socket.on('STAGE_SPEAKER_ADD', (data: StageSpeakerAddPayload) => {
    stageSpeakerAddListeners.forEach(cb => cb(data));
  });

  socket.on('STAGE_SPEAKER_REMOVE', (data: StageSpeakerRemovePayload) => {
    stageSpeakerRemoveListeners.forEach(cb => cb(data));
  });

  socket.on('STAGE_HAND_RAISE', (data: StageHandRaisePayload) => {
    stageHandRaiseListeners.forEach(cb => cb(data));
  });

  socket.on('CHANNEL_BACKGROUND_UPDATED', (data: ChannelBackgroundUpdatedPayload) => {
    channelBgListeners.forEach(cb => cb(data));
  });

  socket.on('SPATIAL_POSITION_UPDATE', (data: SpatialPositionUpdatePayload) => {
    spatialPositionUpdateListeners.forEach(cb => cb(data));
  });

  socket.on('SPATIAL_POSITIONS_SYNC', (data: SpatialPositionsSyncPayload) => {
    spatialPositionsSyncListeners.forEach(cb => cb(data));
  });

  socket.on('disconnect', () => {
    stopHeartbeat();
    stopIdleDetection();
    socketDisconnectListeners.forEach(cb => cb());
  });

  socket.on('connect_error', () => {
    // Reconnection is handled automatically by socket.io
  });

  socket.connect();
  return socket;
}

export function disconnectSocket(): void {
  stopHeartbeat();
  stopIdleDetection();
  socket?.disconnect();
  socket = null;
}

export function getSocket(): GratoniteSocket | null {
  return socket;
}

/** Join a channel room to receive real-time messages */
export function joinChannel(channelId: string): void {
  socket?.emit('CHANNEL_JOIN', { channelId });
}

/** Leave a channel room */
export function leaveChannel(channelId: string): void {
  socket?.emit('CHANNEL_LEAVE', { channelId });
}

/** Set presence status */
export function setPresence(status: 'online' | 'idle' | 'dnd' | 'invisible'): void {
  socket?.emit('PRESENCE_UPDATE', { status });
}
