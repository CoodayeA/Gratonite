import type { Snowflake } from './snowflake';

// ============================================================================
// Channel types
// ============================================================================

/** Channel */
export interface Channel {
  id: Snowflake;
  guildId: Snowflake | null; // null for DMs
  type: ChannelType;
  name: string | null; // null for DMs
  topic: string | null;
  position: number;
  parentId: Snowflake | null; // category ID
  nsfw: boolean;
  lastMessageId: Snowflake | null;
  rateLimitPerUser: number; // slow mode seconds, 0 = off
  defaultAutoArchiveDuration: number | null; // for forums
  defaultThreadRateLimitPerUser: number | null;
  defaultSortOrder: ForumSortOrder | null;
  defaultForumLayout: ForumLayout | null;
  availableTags: ForumTag[] | null; // for forums
  defaultReactionEmoji: { emojiId: Snowflake | null; emojiName: string | null } | null;
  createdAt: string;
}

/** Thread (treated as a sub-channel) */
export interface Thread {
  id: Snowflake;
  parentId: Snowflake; // parent channel
  guildId: Snowflake;
  ownerId: Snowflake;
  name: string;
  type: ThreadType;
  archived: boolean;
  autoArchiveDuration: number; // minutes
  locked: boolean;
  invitable: boolean;
  messageCount: number;
  memberCount: number;
  appliedTags: Snowflake[]; // for forum threads
  pinned: boolean; // forum pin to top
  createdAt: string;
}

/** Channel permission override */
export interface ChannelPermissionOverride {
  channelId: Snowflake;
  targetId: Snowflake; // role or user ID
  targetType: 'role' | 'user';
  allow: string; // bigint as string
  deny: string; // bigint as string
}

/** DM channel */
export interface DmChannel {
  id: Snowflake;
  type: 'dm' | 'group_dm';
  ownerId: Snowflake | null; // group DMs only
  name: string | null; // group DMs only
  iconHash: string | null;
  lastMessageId: Snowflake | null;
  recipientIds: Snowflake[];
}

/** Forum tag */
export interface ForumTag {
  id: Snowflake;
  name: string;
  moderated: boolean; // only mods can apply
  emojiId: Snowflake | null;
  emojiName: string | null;
}

// ============================================================================
// Enums
// ============================================================================

export type ChannelType =
  | 'GUILD_TEXT'
  | 'GUILD_VOICE'
  | 'GUILD_CATEGORY'
  | 'GUILD_ANNOUNCEMENT'
  | 'GUILD_STAGE_VOICE'
  | 'GUILD_FORUM'
  | 'GUILD_MEDIA'
  | 'GUILD_WIKI'
  | 'GUILD_QA'
  | 'DM'
  | 'GROUP_DM';

export type ThreadType = 'public' | 'private' | 'announcement';

export type ForumSortOrder = 'latest_activity' | 'creation_date';
export type ForumLayout = 'list' | 'gallery';
