/**
 * events.ts — Socket.io event payload types for Gratonite.
 *
 * Defines the shape of every real-time event emitted by the server.
 * These types form the contract between the API socket layer and all clients
 * (web, desktop, mobile, bots).
 */

import type {
  Message,
  UserSummary,
  UserStatus,
  UserActivity,
  Role,
  Channel,
  Guild,
  Embed,
} from './api';

// ---------------------------------------------------------------------------
// Connection lifecycle
// ---------------------------------------------------------------------------

/** Sent to the client after successful socket authentication. */
export interface ReadyPayload {
  userId: string;
  sessionId: string;
  status: UserStatus;
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

/** MESSAGE_CREATE — a new message was sent in a channel. */
export interface MessageCreatePayload extends Message {
  /** The author user object (always included on create). */
  author: UserSummary;
}

/** MESSAGE_UPDATE — a message was edited. */
export interface MessageUpdatePayload {
  id: string;
  channelId: string;
  content?: string | null;
  edited: boolean;
  editedAt: string;
  embeds?: Embed[];
  attachments?: unknown[];
}

/** MESSAGE_DELETE — a message was deleted. */
export interface MessageDeletePayload {
  id: string;
  channelId: string;
}

/** MESSAGE_EMBED_UPDATE — embeds were resolved for a message. */
export interface MessageEmbedUpdatePayload {
  id: string;
  channelId: string;
  embeds: Embed[];
}

/** MESSAGE_READ — a user marked messages as read. */
export interface MessageReadPayload {
  channelId: string;
  userId: string;
  lastReadMessageId: string;
  lastReadAt: string;
}

// ---------------------------------------------------------------------------
// Reactions
// ---------------------------------------------------------------------------

/** MESSAGE_REACTION_ADD — a user added a reaction. */
export interface ReactionAddPayload {
  messageId: string;
  channelId: string;
  userId: string;
  emoji: string;
}

/** MESSAGE_REACTION_REMOVE — a user removed a reaction. */
export interface ReactionRemovePayload {
  messageId: string;
  channelId: string;
  userId: string;
  emoji: string;
}

// ---------------------------------------------------------------------------
// Typing
// ---------------------------------------------------------------------------

/** TYPING_START — a user started typing in a channel. */
export interface TypingStartPayload {
  userId: string;
  channelId: string;
  username: string;
}

// ---------------------------------------------------------------------------
// Presence
// ---------------------------------------------------------------------------

/** PRESENCE_UPDATE — a user's status or activity changed. */
export interface PresenceUpdatePayload {
  userId: string;
  status?: UserStatus;
  activity?: UserActivity | null;
}

// ---------------------------------------------------------------------------
// Guild members
// ---------------------------------------------------------------------------

/** GUILD_MEMBER_ADD — a user joined a guild. */
export interface GuildMemberAddPayload {
  guildId: string;
  user: UserSummary;
}

/** GUILD_MEMBER_REMOVE — a user left or was removed from a guild. */
export interface GuildMemberRemovePayload {
  guildId: string;
  userId: string;
}

/** GUILD_MEMBER_ROLE_ADD — a role was assigned to a member. */
export interface GuildMemberRoleAddPayload {
  guildId: string;
  userId: string;
  roleId: string;
}

/** GUILD_MEMBER_ROLE_REMOVE — a role was removed from a member. */
export interface GuildMemberRoleRemovePayload {
  guildId: string;
  userId: string;
  roleId: string;
}

// ---------------------------------------------------------------------------
// Guild lifecycle
// ---------------------------------------------------------------------------

/** GUILD_BAN_ADD — a user was banned from a guild. */
export interface GuildBanAddPayload {
  guildId: string;
  userId: string;
}

/** GUILD_BAN_REMOVE — a user's ban was revoked. */
export interface GuildBanRemovePayload {
  guildId: string;
  userId: string;
}

/** GUILD_LOCKDOWN_START — guild entered anti-raid lockdown. */
export interface GuildLockdownStartPayload {
  guildId: string;
}

/** GUILD_LEFT — the current user was removed from a guild. */
export interface GuildLeftPayload {
  guildId: string;
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

/** GUILD_ROLE_CREATE — a new role was created. */
export interface GuildRoleCreatePayload extends Omit<Role, 'permissions'> {
  permissions: string;
}

/** GUILD_ROLE_UPDATE — a role was modified. */
export interface GuildRoleUpdatePayload extends Partial<Omit<Role, 'permissions'>> {
  id: string;
  guildId: string;
  permissions?: string;
}

/** GUILD_ROLE_DELETE — a role was deleted. */
export interface GuildRoleDeletePayload {
  roleId: string;
  guildId: string;
}

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

/** CHANNEL_CREATE — a new channel was created in a guild. */
export type ChannelCreatePayload = Channel;

/** CHANNEL_UPDATE — a channel was modified. */
export interface ChannelUpdatePayload {
  id: string;
  guildId?: string;
  [key: string]: unknown;
}

/** CHANNEL_DELETE — a channel was deleted. */
export interface ChannelDeletePayload {
  channelId: string;
  guildId: string;
}

/** CHANNEL_PINS_UPDATE — a message was pinned or unpinned. */
export interface ChannelPinsUpdatePayload {
  channelId: string;
  messageId: string;
  pinned: boolean;
}

// ---------------------------------------------------------------------------
// Voice
// ---------------------------------------------------------------------------

/** VOICE_STATE_UPDATE — a user's voice state changed. */
export interface VoiceStateUpdatePayload {
  userId: string;
  channelId: string | null;
  muted?: boolean;
  deafened?: boolean;
}

/** VOICE_MESSAGE_CREATE — a voice message was sent. */
export interface VoiceMessageCreatePayload {
  id: string;
  channelId: string;
  authorId: string;
  url: string;
  duration: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// DM
// ---------------------------------------------------------------------------

/** DM_CHANNEL_CREATE — a new DM channel was opened. */
export interface DmChannelCreatePayload {
  id: string;
  type: 'DM' | 'GROUP_DM';
  members: UserSummary[];
}

/** DM_READ — a DM channel was marked as read. */
export interface DmReadPayload {
  channelId: string;
  userId: string;
  lastReadMessageId?: string;
}

// ---------------------------------------------------------------------------
// Social
// ---------------------------------------------------------------------------

/** FRIEND_REQUEST_RECEIVED — incoming friend request. */
export interface FriendRequestReceivedPayload {
  id: string;
  from: UserSummary;
}

/** FRIEND_ACCEPTED — a friend request was accepted. */
export interface FriendAcceptedPayload {
  id: string;
  user: UserSummary;
}

// ---------------------------------------------------------------------------
// Notifications & Misc
// ---------------------------------------------------------------------------

/** NOTIFICATION_CREATE — a new notification was created. */
export interface NotificationCreatePayload {
  id: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  createdAt: string;
}

/** LEVEL_UP — the current user leveled up. */
export interface LevelUpPayload {
  level: number;
}

/** MENTION_CREATED — the current user was mentioned. */
export interface MentionCreatedPayload {
  messageId: string;
  channelId: string;
  guildId?: string;
  authorId: string;
}

// ---------------------------------------------------------------------------
// Client-to-server events
// ---------------------------------------------------------------------------

/** CHANNEL_JOIN — client joins a channel room. */
export interface ChannelJoinPayload {
  channelId: string;
}

/** CHANNEL_LEAVE — client leaves a channel room. */
export interface ChannelLeavePayload {
  channelId: string;
}

// ---------------------------------------------------------------------------
// Event map (for type-safe socket handlers)
// ---------------------------------------------------------------------------

/**
 * Maps server-to-client event names to their payload types.
 * Use with Socket.IO typed events:
 *   `socket.on<keyof ServerToClientEvents>(...)`
 */
export interface ServerToClientEvents {
  READY: (payload: ReadyPayload) => void;

  // Messages
  MESSAGE_CREATE: (payload: MessageCreatePayload) => void;
  MESSAGE_UPDATE: (payload: MessageUpdatePayload) => void;
  MESSAGE_DELETE: (payload: MessageDeletePayload) => void;
  MESSAGE_EMBED_UPDATE: (payload: MessageEmbedUpdatePayload) => void;
  MESSAGE_READ: (payload: MessageReadPayload) => void;

  // Reactions
  MESSAGE_REACTION_ADD: (payload: ReactionAddPayload) => void;
  MESSAGE_REACTION_REMOVE: (payload: ReactionRemovePayload) => void;

  // Typing
  TYPING_START: (payload: TypingStartPayload) => void;

  // Presence
  PRESENCE_UPDATE: (payload: PresenceUpdatePayload) => void;

  // Guild members
  GUILD_MEMBER_ADD: (payload: GuildMemberAddPayload) => void;
  GUILD_MEMBER_REMOVE: (payload: GuildMemberRemovePayload) => void;
  GUILD_MEMBER_ROLE_ADD: (payload: GuildMemberRoleAddPayload) => void;
  GUILD_MEMBER_ROLE_REMOVE: (payload: GuildMemberRoleRemovePayload) => void;

  // Guild lifecycle
  GUILD_BAN_ADD: (payload: GuildBanAddPayload) => void;
  GUILD_BAN_REMOVE: (payload: GuildBanRemovePayload) => void;
  GUILD_LOCKDOWN_START: (payload: GuildLockdownStartPayload) => void;
  GUILD_LEFT: (payload: GuildLeftPayload) => void;

  // Roles
  GUILD_ROLE_CREATE: (payload: GuildRoleCreatePayload) => void;
  GUILD_ROLE_UPDATE: (payload: GuildRoleUpdatePayload) => void;
  GUILD_ROLE_DELETE: (payload: GuildRoleDeletePayload) => void;

  // Channels
  CHANNEL_CREATE: (payload: ChannelCreatePayload) => void;
  CHANNEL_UPDATE: (payload: ChannelUpdatePayload) => void;
  CHANNEL_DELETE: (payload: ChannelDeletePayload) => void;
  CHANNEL_PINS_UPDATE: (payload: ChannelPinsUpdatePayload) => void;

  // Voice
  VOICE_STATE_UPDATE: (payload: VoiceStateUpdatePayload) => void;
  VOICE_MESSAGE_CREATE: (payload: VoiceMessageCreatePayload) => void;

  // DM
  DM_CHANNEL_CREATE: (payload: DmChannelCreatePayload) => void;
  DM_READ: (payload: DmReadPayload) => void;

  // Social
  FRIEND_REQUEST_RECEIVED: (payload: FriendRequestReceivedPayload) => void;
  FRIEND_ACCEPTED: (payload: FriendAcceptedPayload) => void;

  // Notifications
  NOTIFICATION_CREATE: (payload: NotificationCreatePayload) => void;
  LEVEL_UP: (payload: LevelUpPayload) => void;
  MENTION_CREATED: (payload: MentionCreatedPayload) => void;
}

/**
 * Maps client-to-server event names to their payload types.
 */
export interface ClientToServerEvents {
  CHANNEL_JOIN: (payload: ChannelJoinPayload) => void;
  CHANNEL_LEAVE: (payload: ChannelLeavePayload) => void;
  PRESENCE_UPDATE: (payload: { status: string; auto?: boolean; activity?: UserActivity | null }) => void;
}
