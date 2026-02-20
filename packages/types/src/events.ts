import type { Snowflake } from './snowflake';
import type { Message, MessageReaction } from './message';
import type { GuildMember, Guild, GuildEmoji, GuildSticker, GuildScheduledEvent, AutoModRule } from './guild';
import type { Channel, Thread, WikiPage, QaQuestion } from './channel';
import type { Presence, CustomStatus } from './user';
import type { VoiceState, ScreenShareSession, StageInstance } from './voice';

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

  // Polls
  POLL_VOTE_ADD: (data: { pollId: Snowflake; answerId: Snowflake; userId: Snowflake }) => void;
  POLL_VOTE_REMOVE: (data: { pollId: Snowflake; answerId: Snowflake; userId: Snowflake }) => void;
  POLL_FINALIZE: (data: { pollId: Snowflake }) => void;

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
  THREAD_MEMBER_ADD: (data: { threadId: Snowflake; userId: Snowflake }) => void;
  THREAD_MEMBER_REMOVE: (data: { threadId: Snowflake; userId: Snowflake }) => void;

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

  // Emojis
  GUILD_EMOJI_CREATE: (data: { guildId: Snowflake; emoji: GuildEmoji }) => void;
  GUILD_EMOJI_UPDATE: (data: { guildId: Snowflake; emoji: GuildEmoji }) => void;
  GUILD_EMOJI_DELETE: (data: { guildId: Snowflake; emojiId: Snowflake }) => void;

  // Stickers
  GUILD_STICKER_CREATE: (data: { guildId: Snowflake; sticker: GuildSticker }) => void;
  GUILD_STICKER_UPDATE: (data: { guildId: Snowflake; sticker: GuildSticker }) => void;
  GUILD_STICKER_DELETE: (data: { guildId: Snowflake; stickerId: Snowflake }) => void;

  // Presence
  PRESENCE_UPDATE: (presence: Presence) => void;

  // Voice
  VOICE_STATE_UPDATE: (voiceState: VoiceState) => void;
  VOICE_SERVER_UPDATE: (data: {
    guildId: Snowflake;
    token: string;
    endpoint: string;
  }) => void;

  // Stage
  STAGE_INSTANCE_CREATE: (data: StageInstance) => void;
  STAGE_INSTANCE_UPDATE: (data: Partial<StageInstance> & { id: Snowflake }) => void;
  STAGE_INSTANCE_DELETE: (data: { id: Snowflake; guildId: Snowflake; channelId: Snowflake }) => void;

  // Soundboard
  SOUNDBOARD_PLAY: (data: {
    guildId: Snowflake;
    channelId: Snowflake;
    soundId: Snowflake;
    userId: Snowflake;
    volume: number;
  }) => void;

  // Screen share
  SCREEN_SHARE_START: (data: ScreenShareSession) => void;
  SCREEN_SHARE_STOP: (data: { userId: Snowflake; channelId: Snowflake }) => void;

  // User
  USER_UPDATE: (data: { userId: Snowflake; [key: string]: unknown }) => void;
  CUSTOM_STATUS_UPDATE: (data: { userId: Snowflake; status: CustomStatus }) => void;

  // Wiki
  WIKI_PAGE_CREATE: (data: { guildId: Snowflake; channelId: Snowflake; page: WikiPage }) => void;
  WIKI_PAGE_UPDATE: (data: { guildId: Snowflake; channelId: Snowflake; page: WikiPage }) => void;
  WIKI_PAGE_DELETE: (data: {
    guildId: Snowflake;
    channelId: Snowflake;
    pageId: Snowflake;
  }) => void;

  // Q&A
  QA_QUESTION_UPDATE: (data: {
    guildId: Snowflake;
    threadId: Snowflake;
    question: QaQuestion;
  }) => void;
  QA_VOTE_UPDATE: (data: {
    guildId: Snowflake;
    targetId: Snowflake;
    targetType: 'question' | 'answer';
    voteCount: number;
  }) => void;
  QA_ANSWER_ACCEPTED: (data: {
    guildId: Snowflake;
    threadId: Snowflake;
    messageId: Snowflake;
  }) => void;

  // Scheduled Events
  GUILD_SCHEDULED_EVENT_CREATE: (data: GuildScheduledEvent) => void;
  GUILD_SCHEDULED_EVENT_UPDATE: (
    data: Partial<GuildScheduledEvent> & { id: Snowflake; guildId: Snowflake },
  ) => void;
  GUILD_SCHEDULED_EVENT_DELETE: (data: { id: Snowflake; guildId: Snowflake }) => void;
  GUILD_SCHEDULED_EVENT_USER_ADD: (data: {
    eventId: Snowflake;
    userId: Snowflake;
    guildId: Snowflake;
  }) => void;
  GUILD_SCHEDULED_EVENT_USER_REMOVE: (data: {
    eventId: Snowflake;
    userId: Snowflake;
    guildId: Snowflake;
  }) => void;

  // Auto-Moderation
  AUTO_MODERATION_RULE_CREATE: (data: { guildId: Snowflake; rule: AutoModRule }) => void;
  AUTO_MODERATION_RULE_UPDATE: (data: { guildId: Snowflake; rule: AutoModRule }) => void;
  AUTO_MODERATION_RULE_DELETE: (data: { guildId: Snowflake; ruleId: Snowflake }) => void;
  AUTO_MODERATION_ACTION_EXECUTION: (data: {
    guildId: Snowflake;
    ruleId: Snowflake;
    ruleName: string;
    userId: Snowflake;
    channelId?: Snowflake;
    actionType: string;
    matchedKeyword?: string;
  }) => void;

  // Raid Protection
  RAID_DETECTED: (data: {
    guildId: Snowflake;
    joinCount: number;
    windowSeconds: number;
    action: string;
  }) => void;
  RAID_RESOLVED: (data: { guildId: Snowflake }) => void;

  // Reports
  REPORT_CREATE: (data: { guildId: Snowflake; reportId: Snowflake }) => void;
  REPORT_UPDATE: (data: { guildId: Snowflake; reportId: Snowflake; status: string }) => void;
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

  // Soundboard
  SOUNDBOARD_PLAY: (data: { guildId: Snowflake; soundId: Snowflake }) => void;

  // Subscribe/unsubscribe to guild events
  GUILD_SUBSCRIBE: (data: { guildId: Snowflake }) => void;
  GUILD_UNSUBSCRIBE: (data: { guildId: Snowflake }) => void;
}
