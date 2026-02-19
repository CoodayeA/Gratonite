import type { Snowflake } from './snowflake';
import type { Message, MessageReaction } from './message';
import type { GuildMember, Guild } from './guild';
import type { Channel, Thread } from './channel';
import type { Presence, CustomStatus } from './user';
import type { VoiceState } from './voice';

// ============================================================================
// Socket.IO event types — Server → Client and Client → Server
// ============================================================================

/**
 * Events the server sends to clients.
 * Used with Socket.IO: socket.emit('EVENT_NAME', payload)
 */
export interface ServerToClientEvents {
  // Connection
  READY: (data: { userId: Snowflake; sessionId: string }) => void;
  RESUMED: (data: { replayedEvents: number }) => void;

  // Messages
  MESSAGE_CREATE: (message: Message) => void;
  MESSAGE_UPDATE: (message: Partial<Message> & { id: Snowflake; channelId: Snowflake }) => void;
  MESSAGE_DELETE: (data: { id: Snowflake; channelId: Snowflake; guildId?: Snowflake }) => void;
  MESSAGE_REACTION_ADD: (data: {
    messageId: Snowflake;
    channelId: Snowflake;
    userId: Snowflake;
    emoji: { id: Snowflake | null; name: string };
    burst: boolean;
  }) => void;
  MESSAGE_REACTION_REMOVE: (data: {
    messageId: Snowflake;
    channelId: Snowflake;
    userId: Snowflake;
    emoji: { id: Snowflake | null; name: string };
  }) => void;

  // Typing
  TYPING_START: (data: {
    channelId: Snowflake;
    userId: Snowflake;
    guildId?: Snowflake;
    timestamp: number;
  }) => void;

  // Channels
  CHANNEL_CREATE: (channel: Channel) => void;
  CHANNEL_UPDATE: (channel: Channel) => void;
  CHANNEL_DELETE: (data: { id: Snowflake; guildId?: Snowflake }) => void;
  CHANNEL_PINS_UPDATE: (data: { channelId: Snowflake; lastPinTimestamp: string }) => void;

  // Threads
  THREAD_CREATE: (thread: Thread) => void;
  THREAD_UPDATE: (thread: Thread) => void;
  THREAD_DELETE: (data: { id: Snowflake; parentId: Snowflake; guildId: Snowflake }) => void;

  // Guilds
  GUILD_CREATE: (guild: Guild) => void;
  GUILD_UPDATE: (guild: Partial<Guild> & { id: Snowflake }) => void;
  GUILD_DELETE: (data: { id: Snowflake }) => void;
  GUILD_MEMBER_ADD: (member: GuildMember & { guildId: Snowflake }) => void;
  GUILD_MEMBER_UPDATE: (member: Partial<GuildMember> & { userId: Snowflake; guildId: Snowflake }) => void;
  GUILD_MEMBER_REMOVE: (data: { userId: Snowflake; guildId: Snowflake }) => void;
  GUILD_ROLE_CREATE: (data: { guildId: Snowflake; role: unknown }) => void;
  GUILD_ROLE_UPDATE: (data: { guildId: Snowflake; role: unknown }) => void;
  GUILD_ROLE_DELETE: (data: { guildId: Snowflake; roleId: Snowflake }) => void;
  GUILD_BAN_ADD: (data: { guildId: Snowflake; userId: Snowflake }) => void;
  GUILD_BAN_REMOVE: (data: { guildId: Snowflake; userId: Snowflake }) => void;

  // Presence
  PRESENCE_UPDATE: (presence: Presence) => void;

  // Voice
  VOICE_STATE_UPDATE: (voiceState: VoiceState) => void;
  VOICE_SERVER_UPDATE: (data: {
    guildId: Snowflake;
    token: string;
    endpoint: string;
  }) => void;

  // User
  USER_UPDATE: (data: { userId: Snowflake; [key: string]: unknown }) => void;
  CUSTOM_STATUS_UPDATE: (data: { userId: Snowflake; status: CustomStatus }) => void;
}

/**
 * Events the client sends to the server.
 */
export interface ClientToServerEvents {
  // Connection
  IDENTIFY: (data: { token: string; intents?: number }) => void;
  RESUME: (data: { sessionId: string; lastSequence: number }) => void;
  HEARTBEAT: (data: { timestamp: number }) => void;

  // Messages
  MESSAGE_CREATE: (data: {
    channelId: Snowflake;
    content: string;
    nonce?: string;
    messageReference?: { messageId: Snowflake };
    stickerIds?: Snowflake[];
  }) => void;

  // Typing
  TYPING_START: (data: { channelId: Snowflake }) => void;

  // Voice
  VOICE_STATE_UPDATE: (data: {
    guildId: Snowflake;
    channelId: Snowflake | null; // null = disconnect
    selfMute: boolean;
    selfDeaf: boolean;
  }) => void;

  // Presence
  PRESENCE_UPDATE: (data: { status: string; activities?: unknown[] }) => void;

  // Subscribe/unsubscribe to guild events
  GUILD_SUBSCRIBE: (data: { guildId: Snowflake }) => void;
  GUILD_UNSUBSCRIBE: (data: { guildId: Snowflake }) => void;
}
