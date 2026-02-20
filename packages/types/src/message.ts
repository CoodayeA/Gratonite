import type { Snowflake } from './snowflake';

// ============================================================================
// Message types
// ============================================================================

/** Message */
export interface Message {
  id: Snowflake;
  channelId: Snowflake;
  guildId: Snowflake | null;
  authorId: Snowflake;
  content: string; // max 4000 (free) or 8000 (Crystalline)
  type: MessageType;
  flags: number; // bitfield
  messageReference: MessageReference | null;
  referencedMessage: Message | null; // denormalized snapshot
  embeds: MessageEmbed[];
  attachments: MessageAttachment[];
  mentions: Snowflake[];
  mentionRoles: Snowflake[];
  mentionEveryone: boolean;
  stickerIds: Snowflake[];
  pollId: Snowflake | null;
  poll: Poll | null;
  reactions: MessageReaction[];
  nonce: string | null; // client dedup
  pinned: boolean;
  tts: boolean;
  editedTimestamp: string | null;
  createdAt: string;
  deletedAt: string | null; // soft delete
}

/** Message reference (for replies, forwards, crossposts) */
export interface MessageReference {
  messageId: Snowflake;
  channelId: Snowflake;
  guildId: Snowflake | null;
}

/** Message embed (rich link previews + bot custom embeds) */
export interface MessageEmbed {
  type: EmbedType;
  title: string | null;
  description: string | null; // max 4096
  url: string | null;
  color: number | null; // 24-bit int
  timestamp: string | null;
  footer: { text: string; iconUrl?: string } | null;
  image: { url: string; width?: number; height?: number; proxyUrl?: string } | null;
  thumbnail: { url: string; width?: number; height?: number; proxyUrl?: string } | null;
  video: { url: string; width?: number; height?: number } | null;
  author: { name: string; url?: string; iconUrl?: string } | null;
  fields: Array<{ name: string; value: string; inline?: boolean }>;
}

/** Message attachment */
export interface MessageAttachment {
  id: Snowflake;
  messageId: Snowflake;
  filename: string;
  description: string | null; // alt text, max 1024 chars
  contentType: string;
  size: number; // bytes
  url: string;
  proxyUrl: string;
  height: number | null;
  width: number | null;
  durationSecs: number | null; // audio/video
  waveform: string | null; // base64 for voice messages
  flags: number; // IS_SPOILER, IS_VOICE_MESSAGE
}

/** Reaction on a message */
export interface MessageReaction {
  emojiId: Snowflake | null; // custom emoji
  emojiName: string; // unicode emoji or custom emoji name
  count: number;
  burstCount: number; // super reactions
  me: boolean; // whether current user reacted
}

/** Poll */
export interface Poll {
  id: Snowflake;
  questionText: string;
  allowMultiselect: boolean;
  expiry: string | null; // ISO datetime
  finalized: boolean;
  answers: PollAnswer[];
}

export interface PollAnswer {
  id: Snowflake;
  text: string;
  emojiId: Snowflake | null;
  emojiName: string | null;
  voteCount: number;
}

/** Scheduled message */
export interface ScheduledMessage {
  id: Snowflake;
  channelId: Snowflake;
  authorId: Snowflake;
  content: string;
  embeds: MessageEmbed[];
  attachments: MessageAttachment[];
  scheduledFor: string; // ISO datetime
  status: ScheduledMessageStatus;
  createdAt: string;
}

// ============================================================================
// Enums
// ============================================================================

export type MessageType =
  | 'DEFAULT'
  | 'REPLY'
  | 'MEMBER_JOIN'
  | 'BOOST'
  | 'PIN'
  | 'THREAD_STARTER'
  | 'APPLICATION_COMMAND'
  | 'THREAD_CREATED'
  | 'GUILD_INVITE_REMINDER'
  | 'AUTO_MODERATION_ACTION'
  | 'STAGE_START'
  | 'STAGE_END'
  | 'POLL';

export type EmbedType = 'rich' | 'image' | 'video' | 'article' | 'link';

export type ScheduledMessageStatus = 'pending' | 'sent' | 'failed' | 'cancelled';

/** Message flags (bitfield) */
export const MessageFlags = {
  CROSSPOSTED: 1 << 0,
  SUPPRESS_EMBEDS: 1 << 2,
  EPHEMERAL: 1 << 6,
  HAS_THREAD: 1 << 5,
  IS_VOICE_MESSAGE: 1 << 13,
  SUPPRESS_NOTIFICATIONS: 1 << 12,
} as const;

/** Attachment flags (bitfield) */
export const AttachmentFlags = {
  IS_SPOILER: 1 << 0,
  IS_VOICE_MESSAGE: 1 << 1,
} as const;
