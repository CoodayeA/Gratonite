import {
  pgTable,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  pgEnum,
  jsonb,
} from 'drizzle-orm/pg-core';
import { bigintString } from './helpers';
import { guilds } from './guilds';
import { users } from './users';

// ============================================================================
// Enums
// ============================================================================

export const channelTypeEnum = pgEnum('channel_type', [
  'GUILD_TEXT',
  'GUILD_VOICE',
  'GUILD_CATEGORY',
  'GUILD_ANNOUNCEMENT',
  'GUILD_STAGE_VOICE',
  'GUILD_FORUM',
  'GUILD_MEDIA',
  'GUILD_WIKI',
  'GUILD_QA',
  'DM',
  'GROUP_DM',
]);

export const threadTypeEnum = pgEnum('thread_type', ['public', 'private', 'announcement']);

export const forumSortOrderEnum = pgEnum('forum_sort_order', [
  'latest_activity',
  'creation_date',
]);

export const forumLayoutEnum = pgEnum('forum_layout', ['list', 'gallery']);

// ============================================================================
// Channels
// ============================================================================

export const channels = pgTable('channels', {
  id: bigintString('id').primaryKey(),
  guildId: bigintString('guild_id').references(() => guilds.id, {
    onDelete: 'cascade',
  }),
  type: channelTypeEnum('type').notNull(),
  name: varchar('name', { length: 100 }),
  topic: varchar('topic', { length: 1024 }),
  position: integer('position').notNull().default(0),
  parentId: bigintString('parent_id'), // category
  nsfw: boolean('nsfw').notNull().default(false),
  lastMessageId: bigintString('last_message_id'),
  rateLimitPerUser: integer('rate_limit_per_user').notNull().default(0),
  // Forum-specific
  defaultAutoArchiveDuration: integer('default_auto_archive_duration'),
  defaultThreadRateLimitPerUser: integer('default_thread_rate_limit_per_user'),
  defaultSortOrder: forumSortOrderEnum('default_sort_order'),
  defaultForumLayout: forumLayoutEnum('default_forum_layout'),
  availableTags: jsonb('available_tags'),
  defaultReactionEmoji: jsonb('default_reaction_emoji'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// Channel permission overrides
// ============================================================================

export const channelPermissions = pgTable('channel_permissions', {
  id: bigintString('id').primaryKey(),
  channelId: bigintString('channel_id')
    .notNull()
    .references(() => channels.id, { onDelete: 'cascade' }),
  targetId: bigintString('target_id').notNull(), // role or user ID
  targetType: varchar('target_type', { length: 10 }).notNull(), // 'role' or 'user'
  allow: bigintString('allow').notNull().default('0'),
  deny: bigintString('deny').notNull().default('0'),
});

// ============================================================================
// Threads
// ============================================================================

export const threads = pgTable('threads', {
  id: bigintString('id').primaryKey(),
  parentId: bigintString('parent_id')
    .notNull()
    .references(() => channels.id, { onDelete: 'cascade' }),
  guildId: bigintString('guild_id')
    .notNull()
    .references(() => guilds.id, { onDelete: 'cascade' }),
  ownerId: bigintString('owner_id')
    .notNull()
    .references(() => users.id),
  name: varchar('name', { length: 100 }).notNull(),
  type: threadTypeEnum('type').notNull().default('public'),
  archived: boolean('archived').notNull().default(false),
  autoArchiveDuration: integer('auto_archive_duration').notNull().default(10080), // 7 days
  locked: boolean('locked').notNull().default(false),
  invitable: boolean('invitable').notNull().default(true),
  messageCount: integer('message_count').notNull().default(0),
  memberCount: integer('member_count').notNull().default(0),
  appliedTags: jsonb('applied_tags').notNull().default([]),
  pinned: boolean('pinned').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const threadMembers = pgTable('thread_members', {
  threadId: bigintString('thread_id')
    .notNull()
    .references(() => threads.id, { onDelete: 'cascade' }),
  userId: bigintString('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  joinTimestamp: timestamp('join_timestamp', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// DM channels
// ============================================================================

export const dmChannels = pgTable('dm_channels', {
  id: bigintString('id').primaryKey(),
  type: varchar('type', { length: 10 }).notNull(), // 'dm' or 'group_dm'
  ownerId: bigintString('owner_id').references(() => users.id),
  name: varchar('name', { length: 100 }),
  iconHash: varchar('icon_hash', { length: 64 }),
  lastMessageId: bigintString('last_message_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const dmRecipients = pgTable('dm_recipients', {
  channelId: bigintString('channel_id')
    .notNull()
    .references(() => dmChannels.id, { onDelete: 'cascade' }),
  userId: bigintString('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
});

// ============================================================================
// Read state (which messages the user has seen)
// ============================================================================

export const channelReadState = pgTable('channel_read_state', {
  userId: bigintString('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  channelId: bigintString('channel_id').notNull(),
  lastReadMessageId: bigintString('last_read_message_id'),
  mentionCount: integer('mention_count').notNull().default(0),
});
