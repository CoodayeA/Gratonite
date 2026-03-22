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
  isSystem?: boolean;
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

export interface GuildJoinedPayload {
  guildId: string;
  guild: { id: string; name: string; iconHash: string | null; memberCount: number };
}

export interface GuildLeftPayload {
  guildId: string;
}

export interface GuildUpdatePayload {
  guildId: string;
  [key: string]: any;
}

export interface GuildDeletePayload {
  guildId: string;
}

export interface ChannelUpdatePayload {
  channelId: string;
  guildId: string;
  [key: string]: any;
}

export interface ChannelDeletePayload {
  channelId: string;
  guildId: string;
}

export interface GuildMemberAddPayload {
  guildId: string;
  user: { id: string; username: string; displayName: string; avatarHash: string | null };
}

export interface GuildMemberRemovePayload {
  guildId: string;
  userId: string;
}

export interface FriendAcceptedPayload {
  userId: string;
  friendId: string;
  username: string;
  displayName: string;
  avatarHash: string | null;
}

export interface FriendRemovedPayload {
  userId: string;
  removedById: string;
}

export interface DmChannelCreatePayload {
  channel: any;
  initiator: { id: string; username: string; displayName: string; avatarHash: string | null };
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
type GuildJoinedCallback = (payload: GuildJoinedPayload) => void;
type GuildLeftCallback = (payload: GuildLeftPayload) => void;
type GuildUpdateCallback = (payload: GuildUpdatePayload) => void;
type GuildDeleteCallback = (payload: GuildDeletePayload) => void;
type ChannelUpdateCallback = (payload: ChannelUpdatePayload) => void;
type ChannelDeleteCallback = (payload: ChannelDeletePayload) => void;
type GuildMemberAddCallback = (payload: GuildMemberAddPayload) => void;
type GuildMemberRemoveCallback = (payload: GuildMemberRemovePayload) => void;
type FriendAcceptedCallback = (payload: FriendAcceptedPayload) => void;
type FriendRemovedCallback = (payload: FriendRemovedPayload) => void;
type DmChannelCreateCallback = (payload: DmChannelCreatePayload) => void;

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
const guildJoinedListeners = new Set<GuildJoinedCallback>();
const guildLeftListeners = new Set<GuildLeftCallback>();
const guildUpdateListeners = new Set<GuildUpdateCallback>();
const guildDeleteListeners = new Set<GuildDeleteCallback>();
const channelUpdateListeners = new Set<ChannelUpdateCallback>();
const channelDeleteListeners = new Set<ChannelDeleteCallback>();
const guildMemberAddListeners = new Set<GuildMemberAddCallback>();
const guildMemberRemoveListeners = new Set<GuildMemberRemoveCallback>();
const friendAcceptedListeners = new Set<FriendAcceptedCallback>();
const friendRemovedListeners = new Set<FriendRemovedCallback>();
const dmChannelCreateListeners = new Set<DmChannelCreateCallback>();

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

export function onGuildJoined(cb: GuildJoinedCallback): () => void {
  guildJoinedListeners.add(cb);
  return () => { guildJoinedListeners.delete(cb); };
}

export function onGuildLeft(cb: GuildLeftCallback): () => void {
  guildLeftListeners.add(cb);
  return () => { guildLeftListeners.delete(cb); };
}

export function onGuildUpdate(cb: GuildUpdateCallback): () => void {
  guildUpdateListeners.add(cb);
  return () => { guildUpdateListeners.delete(cb); };
}

export function onGuildDelete(cb: GuildDeleteCallback): () => void {
  guildDeleteListeners.add(cb);
  return () => { guildDeleteListeners.delete(cb); };
}

export function onChannelUpdate(cb: ChannelUpdateCallback): () => void {
  channelUpdateListeners.add(cb);
  return () => { channelUpdateListeners.delete(cb); };
}

export function onChannelDelete(cb: ChannelDeleteCallback): () => void {
  channelDeleteListeners.add(cb);
  return () => { channelDeleteListeners.delete(cb); };
}

export function onGuildMemberAdd(cb: GuildMemberAddCallback): () => void {
  guildMemberAddListeners.add(cb);
  return () => { guildMemberAddListeners.delete(cb); };
}

export function onGuildMemberRemove(cb: GuildMemberRemoveCallback): () => void {
  guildMemberRemoveListeners.add(cb);
  return () => { guildMemberRemoveListeners.delete(cb); };
}

export function onFriendAccepted(cb: FriendAcceptedCallback): () => void {
  friendAcceptedListeners.add(cb);
  return () => { friendAcceptedListeners.delete(cb); };
}

export function onFriendRemoved(cb: FriendRemovedCallback): () => void {
  friendRemovedListeners.add(cb);
  return () => { friendRemovedListeners.delete(cb); };
}

export function onDmChannelCreate(cb: DmChannelCreateCallback): () => void {
  dmChannelCreateListeners.add(cb);
  return () => { dmChannelCreateListeners.delete(cb); };
}

/* ── E2E encryption events ─────────────────────────────────── */

export interface GroupKeyRotationNeededPayload {
  channelId: string;
  reason: 'member_added' | 'member_removed';
}

export interface UserKeyChangedPayload {
  userId: string;
}

type GroupKeyRotationNeededCallback = (payload: GroupKeyRotationNeededPayload) => void;
type UserKeyChangedCallback = (payload: UserKeyChangedPayload) => void;

const groupKeyRotationNeededListeners = new Set<GroupKeyRotationNeededCallback>();
const userKeyChangedListeners = new Set<UserKeyChangedCallback>();

export function onGroupKeyRotationNeeded(cb: GroupKeyRotationNeededCallback): () => void {
  groupKeyRotationNeededListeners.add(cb);
  return () => { groupKeyRotationNeededListeners.delete(cb); };
}

export function onUserKeyChanged(cb: UserKeyChangedCallback): () => void {
  userKeyChangedListeners.add(cb);
  return () => { userKeyChangedListeners.delete(cb); };
}

export interface E2EStateChangedPayload {
  channelId: string;
  enabled: boolean;
  toggledBy: string;
  toggledByName: string;
}

type E2EStateChangedCallback = (payload: E2EStateChangedPayload) => void;
const e2eStateChangedListeners = new Set<E2EStateChangedCallback>();

export function onE2EStateChanged(cb: E2EStateChangedCallback): () => void {
  e2eStateChangedListeners.add(cb);
  return () => { e2eStateChangedListeners.delete(cb); };
}

/* ── Watch Party events ────────────────────────────────────── */

export interface WatchPartySyncPayload {
  channelId: string;
  partyId: string;
  action: 'play' | 'pause' | 'seek';
  currentTime: number;
  userId: string;
}

export interface WatchPartyReactionPayload {
  channelId: string;
  emoji: string;
  userId: string;
}

type WatchPartySyncCallback = (payload: WatchPartySyncPayload) => void;
type WatchPartyReactionCallback = (payload: WatchPartyReactionPayload) => void;

const watchPartySyncListeners = new Set<WatchPartySyncCallback>();
const watchPartyReactionListeners = new Set<WatchPartyReactionCallback>();

export function onWatchPartySync(cb: WatchPartySyncCallback): () => void {
  watchPartySyncListeners.add(cb);
  return () => { watchPartySyncListeners.delete(cb); };
}

export function onWatchPartyReaction(cb: WatchPartyReactionCallback): () => void {
  watchPartyReactionListeners.add(cb);
  return () => { watchPartyReactionListeners.delete(cb); };
}

/* ── Collaborative Playlist events ─────────────────────────── */

export interface PlaylistUpdatePayload {
  channelId: string;
  playlistId: string;
  action: string;
  track: any;
  userId: string;
}

export interface PlaylistVotePayload {
  channelId: string;
  trackId: string;
  vote: 'skip' | 'keep';
  userId: string;
}

type PlaylistUpdateCallback = (payload: PlaylistUpdatePayload) => void;
type PlaylistVoteCallback = (payload: PlaylistVotePayload) => void;

const playlistUpdateListeners = new Set<PlaylistUpdateCallback>();
const playlistVoteListeners = new Set<PlaylistVoteCallback>();

export function onPlaylistUpdate(cb: PlaylistUpdateCallback): () => void {
  playlistUpdateListeners.add(cb);
  return () => { playlistUpdateListeners.delete(cb); };
}

export function onPlaylistVote(cb: PlaylistVoteCallback): () => void {
  playlistVoteListeners.add(cb);
  return () => { playlistVoteListeners.delete(cb); };
}

/* ── Collaborative Document events ─────────────────────────── */

export interface DocumentUpdatePayload {
  channelId: string;
  update: string; // base64-encoded Yjs update
  userId: string;
}

export interface DocumentAwarenessPayload {
  channelId: string;
  state: string; // JSON-encoded awareness state
  userId: string;
}

export interface DocumentPresenceUpdatePayload {
  channelId: string;
  action: 'join' | 'leave';
  user: { userId: string; username?: string; avatarHash?: string | null };
}

export interface DocumentTitleUpdatePayload {
  channelId: string;
  title: string;
  userId: string;
}

export interface DocumentBlockInsertPayload {
  channelId: string;
  block: any;
  afterBlockId?: string;
  userId: string;
}

export interface DocumentBlockUpdatePayload {
  channelId: string;
  blockId: string;
  changes: any;
  userId: string;
}

export interface DocumentBlockDeletePayload {
  channelId: string;
  blockId: string;
  userId: string;
}

export interface DocumentBlockMovePayload {
  channelId: string;
  blockId: string;
  afterBlockId?: string;
  userId: string;
}

export interface DocumentCursorUpdatePayload {
  channelId: string;
  blockId: string;
  offset: number;
  userId: string;
}

type DocumentUpdateCallback = (payload: DocumentUpdatePayload) => void;
type DocumentAwarenessCallback = (payload: DocumentAwarenessPayload) => void;
type DocumentPresenceUpdateCallback = (payload: DocumentPresenceUpdatePayload) => void;
type DocumentTitleUpdateCallback = (payload: DocumentTitleUpdatePayload) => void;
type DocumentBlockInsertCallback = (payload: DocumentBlockInsertPayload) => void;
type DocumentBlockUpdateCallback = (payload: DocumentBlockUpdatePayload) => void;
type DocumentBlockDeleteCallback = (payload: DocumentBlockDeletePayload) => void;
type DocumentBlockMoveCallback = (payload: DocumentBlockMovePayload) => void;
type DocumentCursorUpdateCallback = (payload: DocumentCursorUpdatePayload) => void;

const documentUpdateListeners = new Set<DocumentUpdateCallback>();
const documentAwarenessListeners = new Set<DocumentAwarenessCallback>();
const documentPresenceUpdateListeners = new Set<DocumentPresenceUpdateCallback>();
const documentTitleUpdateListeners = new Set<DocumentTitleUpdateCallback>();
const documentBlockInsertListeners = new Set<DocumentBlockInsertCallback>();
const documentBlockUpdateListeners = new Set<DocumentBlockUpdateCallback>();
const documentBlockDeleteListeners = new Set<DocumentBlockDeleteCallback>();
const documentBlockMoveListeners = new Set<DocumentBlockMoveCallback>();
const documentCursorUpdateListeners = new Set<DocumentCursorUpdateCallback>();

export function onDocumentUpdate(cb: DocumentUpdateCallback): () => void {
  documentUpdateListeners.add(cb);
  return () => { documentUpdateListeners.delete(cb); };
}

export function onDocumentAwareness(cb: DocumentAwarenessCallback): () => void {
  documentAwarenessListeners.add(cb);
  return () => { documentAwarenessListeners.delete(cb); };
}

export function onDocumentPresenceUpdate(cb: DocumentPresenceUpdateCallback): () => void {
  documentPresenceUpdateListeners.add(cb);
  return () => { documentPresenceUpdateListeners.delete(cb); };
}

export function onDocumentTitleUpdate(cb: DocumentTitleUpdateCallback): () => void {
  documentTitleUpdateListeners.add(cb);
  return () => { documentTitleUpdateListeners.delete(cb); };
}

export function onDocumentBlockInsert(cb: DocumentBlockInsertCallback): () => void {
  documentBlockInsertListeners.add(cb);
  return () => { documentBlockInsertListeners.delete(cb); };
}

export function onDocumentBlockUpdate(cb: DocumentBlockUpdateCallback): () => void {
  documentBlockUpdateListeners.add(cb);
  return () => { documentBlockUpdateListeners.delete(cb); };
}

export function onDocumentBlockDelete(cb: DocumentBlockDeleteCallback): () => void {
  documentBlockDeleteListeners.add(cb);
  return () => { documentBlockDeleteListeners.delete(cb); };
}

export function onDocumentBlockMove(cb: DocumentBlockMoveCallback): () => void {
  documentBlockMoveListeners.add(cb);
  return () => { documentBlockMoveListeners.delete(cb); };
}

export function onDocumentCursorUpdate(cb: DocumentCursorUpdateCallback): () => void {
  documentCursorUpdateListeners.add(cb);
  return () => { documentCursorUpdateListeners.delete(cb); };
}

/* ── Screen Annotation events ──────────────────────────────── */

export interface ScreenAnnotationPayload {
  channelId: string;
  tool: string;
  points: number[];
  color: string;
  width: number;
  id: string;
  userId: string;
}

export interface ScreenAnnotationClearPayload {
  channelId: string;
  userId: string;
}

type ScreenAnnotationCallback = (payload: ScreenAnnotationPayload) => void;
type ScreenAnnotationClearCallback = (payload: ScreenAnnotationClearPayload) => void;

const screenAnnotationListeners = new Set<ScreenAnnotationCallback>();
const screenAnnotationClearListeners = new Set<ScreenAnnotationClearCallback>();

export function onScreenAnnotation(cb: ScreenAnnotationCallback): () => void {
  screenAnnotationListeners.add(cb);
  return () => { screenAnnotationListeners.delete(cb); };
}

export function onScreenAnnotationClear(cb: ScreenAnnotationClearCallback): () => void {
  screenAnnotationClearListeners.add(cb);
  return () => { screenAnnotationClearListeners.delete(cb); };
}

/* ── Call signaling events ─────────────────────────────────── */

export interface CallInvitePayload {
  channelId: string;
  callerId: string;
  callerName: string;
  callerAvatar: string | null;
  withVideo: boolean;
}

export interface CallAnswerPayload {
  channelId: string;
  userId: string;
}

export interface CallRejectPayload {
  channelId: string;
  userId: string;
}

export interface CallCancelPayload {
  channelId: string;
  userId: string;
}

type CallInviteCallback = (payload: CallInvitePayload) => void;
type CallAnswerCallback = (payload: CallAnswerPayload) => void;
type CallRejectCallback = (payload: CallRejectPayload) => void;
type CallCancelCallback = (payload: CallCancelPayload) => void;

const callInviteListeners = new Set<CallInviteCallback>();
const callAnswerListeners = new Set<CallAnswerCallback>();
const callRejectListeners = new Set<CallRejectCallback>();
const callCancelListeners = new Set<CallCancelCallback>();

export function onCallInvite(cb: CallInviteCallback): () => void {
  callInviteListeners.add(cb);
  return () => { callInviteListeners.delete(cb); };
}

export function onCallAnswer(cb: CallAnswerCallback): () => void {
  callAnswerListeners.add(cb);
  return () => { callAnswerListeners.delete(cb); };
}

export function onCallReject(cb: CallRejectCallback): () => void {
  callRejectListeners.add(cb);
  return () => { callRejectListeners.delete(cb); };
}

export function onCallCancel(cb: CallCancelCallback): () => void {
  callCancelListeners.add(cb);
  return () => { callCancelListeners.delete(cb); };
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
let livenessInterval: ReturnType<typeof setInterval> | null = null;
let lastEventReceivedAt: number = Date.now();
let isIdle = false;
let userChosenStatus: string = 'online'; // tracks the user's explicit status choice

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const LIVENESS_CHECK_MS = 15_000; // check every 15s
const LIVENESS_STALE_MS = 60_000; // force reconnect if no event in 60s

/* ── Connection state tracking ─────────────────────────────── */

export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';

type ConnectionStateListener = (state: ConnectionState) => void;

let connectionState: ConnectionState = 'disconnected';
const connectionStateListeners = new Set<ConnectionStateListener>();

function setConnectionState(state: ConnectionState) {
  if (connectionState === state) return;
  connectionState = state;
  connectionStateListeners.forEach(cb => cb(state));
}

export function getConnectionState(): ConnectionState {
  return connectionState;
}

export function onConnectionStateChange(cb: ConnectionStateListener): () => void {
  connectionStateListeners.add(cb);
  return () => { connectionStateListeners.delete(cb); };
}

/* ── Outgoing event queue (buffered while disconnected) ──── */

interface QueuedEvent {
  event: string;
  data: unknown;
}

const eventQueue: QueuedEvent[] = [];

function enqueueEvent(event: string, data: unknown) {
  eventQueue.push({ event, data });
}

function flushEventQueue() {
  if (!socket?.connected) return;
  while (eventQueue.length > 0) {
    const { event, data } = eventQueue.shift()!;
    socket.emit(event, data);
  }
}

/**
 * Emit a socket event, or queue it if currently disconnected.
 * Use this for outgoing events that should survive brief disconnections.
 */
export function emitOrQueue(event: string, data: unknown): void {
  if (socket?.connected) {
    socket.emit(event, data);
  } else {
    enqueueEvent(event, data);
  }
}

/* ── Track joined guild rooms for re-join on reconnect ────── */

const joinedGuildRooms = new Set<string>();
const joinedChannels = new Set<string>();

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
  // Don't override dnd/invisible with auto idle transitions
  if (userChosenStatus === 'dnd' || userChosenStatus === 'invisible') return;
  if (isIdle && socket?.connected) {
    isIdle = false;
    socket.emit('PRESENCE_UPDATE', { status: 'online', auto: true });
  }
  idleTimeout = setTimeout(() => {
    if (socket?.connected && userChosenStatus !== 'dnd' && userChosenStatus !== 'invisible') {
      isIdle = true;
      socket.emit('PRESENCE_UPDATE', { status: 'idle', auto: true });
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

function startLivenessCheck() {
  stopLivenessCheck();
  lastEventReceivedAt = Date.now();
  livenessInterval = setInterval(() => {
    if (!socket?.connected) return;
    const elapsed = Date.now() - lastEventReceivedAt;
    if (elapsed >= LIVENESS_STALE_MS) {
      console.warn(`[socket] No events received in ${Math.round(elapsed / 1000)}s — forcing reconnect`);
      (window as any).Sentry?.addBreadcrumb({
        category: 'socket',
        message: `Liveness check forcing reconnect after ${Math.round(elapsed / 1000)}s stale`,
        level: 'warning',
      });
      socket!.disconnect();
      socket!.connect();
    }
  }, LIVENESS_CHECK_MS);
}

function stopLivenessCheck() {
  if (livenessInterval) {
    clearInterval(livenessInterval);
    livenessInterval = null;
  }
}

/** Called by every incoming event handler to track liveness */
function touchLiveness() {
  lastEventReceivedAt = Date.now();
}

export function connectSocket(): GratoniteSocket {
  if (socket && (socket.connected || socket.active)) return socket;

  setConnectionState('connecting');

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
    randomizationFactor: 0.25,
    auth: token ? { token } : undefined,
    query: token ? { token } : undefined,
  });

  socket.on('connect', () => {
    setConnectionState('connected');

    // Re-authenticate with fresh token (may have refreshed during disconnection)
    const t = getAccessToken();
    if (t) {
      socket!.emit('IDENTIFY', { token: t });
    }

    // Re-join all tracked guild rooms
    for (const guildId of joinedGuildRooms) {
      socket!.emit('JOIN_GUILD_ROOM', { guildId });
    }

    // Re-join all tracked channels
    for (const channelId of joinedChannels) {
      socket!.emit('CHANNEL_JOIN', { channelId });
    }

    // Flush any events queued while disconnected
    flushEventQueue();

    // Notify reconnect listeners (fires on initial connect too, banner handles state)
    socketReconnectListeners.forEach(cb => cb());
  });

  socket.io.on('reconnect_attempt', () => {
    setConnectionState('reconnecting');
  });

  socket.on('READY', (data: { userId?: string; sessionId?: string; status?: string }) => {
    startHeartbeat();
    startIdleDetection();
    startLivenessCheck();
    if (data?.status && ['online', 'idle', 'dnd', 'invisible'].includes(data.status)) {
      userChosenStatus = data.status;
    }
  });

  /* ── Track liveness on every incoming event ──── */
  socket.onAny(() => { touchLiveness(); });

  // Engine-level pong also proves the connection is alive
  // (onAny only catches application events, not ping/pong)
  socket.io.engine?.on('pong', () => { touchLiveness(); });
  socket.io.on('open', () => {
    socket!.io.engine?.on('pong', () => { touchLiveness(); });
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

  socket.on('GUILD_JOINED', (data: GuildJoinedPayload) => {
    guildJoinedListeners.forEach(cb => cb(data));
  });

  socket.on('GUILD_LEFT', (data: GuildLeftPayload) => {
    guildLeftListeners.forEach(cb => cb(data));
  });

  socket.on('GUILD_UPDATE', (data: GuildUpdatePayload) => {
    guildUpdateListeners.forEach(cb => cb(data));
  });

  socket.on('GUILD_DELETE', (data: GuildDeletePayload) => {
    guildDeleteListeners.forEach(cb => cb(data));
  });

  socket.on('CHANNEL_UPDATE', (data: ChannelUpdatePayload) => {
    channelUpdateListeners.forEach(cb => cb(data));
  });

  socket.on('CHANNEL_DELETE', (data: ChannelDeletePayload) => {
    channelDeleteListeners.forEach(cb => cb(data));
  });

  socket.on('GUILD_MEMBER_ADD', (data: GuildMemberAddPayload) => {
    guildMemberAddListeners.forEach(cb => cb(data));
  });

  socket.on('GUILD_MEMBER_REMOVE', (data: GuildMemberRemovePayload) => {
    guildMemberRemoveListeners.forEach(cb => cb(data));
  });

  socket.on('FRIEND_ACCEPTED', (data: FriendAcceptedPayload) => {
    friendAcceptedListeners.forEach(cb => cb(data));
  });

  socket.on('FRIEND_REMOVED', (data: FriendRemovedPayload) => {
    friendRemovedListeners.forEach(cb => cb(data));
  });

  socket.on('DM_CHANNEL_CREATE', (data: DmChannelCreatePayload) => {
    dmChannelCreateListeners.forEach(cb => cb(data));
  });

  socket.on('CALL_INVITE', (data: CallInvitePayload) => {
    callInviteListeners.forEach(cb => cb(data));
  });

  socket.on('CALL_ANSWER', (data: CallAnswerPayload) => {
    callAnswerListeners.forEach(cb => cb(data));
  });

  socket.on('CALL_REJECT', (data: CallRejectPayload) => {
    callRejectListeners.forEach(cb => cb(data));
  });

  socket.on('CALL_CANCEL', (data: CallCancelPayload) => {
    callCancelListeners.forEach(cb => cb(data));
  });

  socket.on('SPATIAL_POSITION_UPDATE', (data: SpatialPositionUpdatePayload) => {
    spatialPositionUpdateListeners.forEach(cb => cb(data));
  });

  socket.on('SPATIAL_POSITIONS_SYNC', (data: SpatialPositionsSyncPayload) => {
    spatialPositionsSyncListeners.forEach(cb => cb(data));
  });

  socket.on('GROUP_KEY_ROTATION_NEEDED', (data: GroupKeyRotationNeededPayload) => {
    groupKeyRotationNeededListeners.forEach(cb => cb(data));
  });

  socket.on('USER_KEY_CHANGED', (data: UserKeyChangedPayload) => {
    userKeyChangedListeners.forEach(cb => cb(data));
  });

  socket.on('E2E_STATE_CHANGED', (data: E2EStateChangedPayload) => {
    e2eStateChangedListeners.forEach(cb => cb(data));
  });

  socket.on('WATCH_PARTY_SYNC', (data: WatchPartySyncPayload) => {
    watchPartySyncListeners.forEach(cb => cb(data));
  });

  socket.on('WATCH_PARTY_REACTION', (data: WatchPartyReactionPayload) => {
    watchPartyReactionListeners.forEach(cb => cb(data));
  });

  socket.on('PLAYLIST_UPDATE', (data: PlaylistUpdatePayload) => {
    playlistUpdateListeners.forEach(cb => cb(data));
  });

  socket.on('PLAYLIST_VOTE', (data: PlaylistVotePayload) => {
    playlistVoteListeners.forEach(cb => cb(data));
  });

  socket.on('SCREEN_ANNOTATION', (data: ScreenAnnotationPayload) => {
    screenAnnotationListeners.forEach(cb => cb(data));
  });

  socket.on('SCREEN_ANNOTATION_CLEAR', (data: ScreenAnnotationClearPayload) => {
    screenAnnotationClearListeners.forEach(cb => cb(data));
  });

  socket.on('DOCUMENT_UPDATE', (data: DocumentUpdatePayload) => {
    documentUpdateListeners.forEach(cb => cb(data));
  });

  socket.on('DOCUMENT_AWARENESS', (data: DocumentAwarenessPayload) => {
    documentAwarenessListeners.forEach(cb => cb(data));
  });

  socket.on('DOCUMENT_PRESENCE_UPDATE', (data: DocumentPresenceUpdatePayload) => {
    documentPresenceUpdateListeners.forEach(cb => cb(data));
  });

  socket.on('DOCUMENT_TITLE_UPDATE', (data: DocumentTitleUpdatePayload) => {
    documentTitleUpdateListeners.forEach(cb => cb(data));
  });

  socket.on('DOCUMENT_BLOCK_INSERT', (data: DocumentBlockInsertPayload) => {
    documentBlockInsertListeners.forEach(cb => cb(data));
  });

  socket.on('DOCUMENT_BLOCK_UPDATE', (data: DocumentBlockUpdatePayload) => {
    documentBlockUpdateListeners.forEach(cb => cb(data));
  });

  socket.on('DOCUMENT_BLOCK_DELETE', (data: DocumentBlockDeletePayload) => {
    documentBlockDeleteListeners.forEach(cb => cb(data));
  });

  socket.on('DOCUMENT_BLOCK_MOVE', (data: DocumentBlockMovePayload) => {
    documentBlockMoveListeners.forEach(cb => cb(data));
  });

  socket.on('DOCUMENT_CURSOR_UPDATE', (data: DocumentCursorUpdatePayload) => {
    documentCursorUpdateListeners.forEach(cb => cb(data));
  });

  socket.on('disconnect', (reason) => {
    setConnectionState('disconnected');
    stopHeartbeat();
    stopIdleDetection();
    stopLivenessCheck();
    (window as any).Sentry?.addBreadcrumb({
      category: 'socket',
      message: `Socket disconnected: ${reason}`,
      level: 'warning',
    });
    socketDisconnectListeners.forEach(cb => cb());
  });

  socket.on('connect_error', (err) => {
    setConnectionState('reconnecting');
    (window as any).Sentry?.addBreadcrumb({
      category: 'socket',
      message: `Socket connect_error: ${err?.message || 'unknown'}`,
      level: 'error',
      data: { type: err?.message },
    });
  });

  socket.connect();
  return socket;
}

export function disconnectSocket(): void {
  setConnectionState('disconnected');
  stopHeartbeat();
  stopIdleDetection();
  stopLivenessCheck();
  joinedGuildRooms.clear();
  joinedChannels.clear();
  eventQueue.length = 0;
  socket?.disconnect();
  socket = null;
}

export function getSocket(): GratoniteSocket | null {
  return socket;
}

/** Join a channel room to receive real-time messages */
export function joinChannel(channelId: string): void {
  joinedChannels.add(channelId);
  socket?.emit('CHANNEL_JOIN', { channelId });
}

/** Leave a channel room */
export function leaveChannel(channelId: string): void {
  joinedChannels.delete(channelId);
  socket?.emit('CHANNEL_LEAVE', { channelId });
}

/** Join a guild room to receive guild-level real-time events */
export function joinGuildRoom(guildId: string): void {
  joinedGuildRooms.add(guildId);
  socket?.emit('JOIN_GUILD_ROOM', { guildId });
}

/** Set presence status */
export function setPresence(status: 'online' | 'idle' | 'dnd' | 'invisible'): void {
  userChosenStatus = status;
  socket?.emit('PRESENCE_UPDATE', { status });
}
