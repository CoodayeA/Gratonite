import {
  pgTable,
  bigint,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { channels } from './channels';

// ============================================================================
// Messages
// ============================================================================

export const messages = pgTable(
  'messages',
  {
    id: bigint('id', { mode: 'number' }).primaryKey(),
    channelId: bigint('channel_id', { mode: 'number' }).notNull(),
    guildId: bigint('guild_id', { mode: 'number' }),
    authorId: bigint('author_id', { mode: 'number' })
      .notNull()
      .references(() => users.id),
    content: text('content').notNull().default(''),
    type: integer('type').notNull().default(0), // MessageType as int
    flags: integer('flags').notNull().default(0),
    messageReference: jsonb('message_reference'), // {messageId, channelId, guildId}
    referencedMessage: jsonb('referenced_message'), // denormalized snapshot
    embeds: jsonb('embeds').notNull().default([]),
    mentions: jsonb('mentions').notNull().default([]), // bigint[] as string[]
    mentionRoles: jsonb('mention_roles').notNull().default([]),
    mentionEveryone: boolean('mention_everyone').notNull().default(false),
    stickerIds: jsonb('sticker_ids').notNull().default([]),
    pollId: bigint('poll_id', { mode: 'number' }),
    nonce: varchar('nonce', { length: 64 }),
    pinned: boolean('pinned').notNull().default(false),
    tts: boolean('tts').notNull().default(false),
    editedTimestamp: timestamp('edited_timestamp', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_messages_channel_id').on(table.channelId, table.id),
    index('idx_messages_author_id').on(table.authorId),
  ],
);

// ============================================================================
// Message attachments
// ============================================================================

export const messageAttachments = pgTable('message_attachments', {
  id: bigint('id', { mode: 'number' }).primaryKey(),
  messageId: bigint('message_id', { mode: 'number' }).notNull(),
  filename: varchar('filename', { length: 255 }).notNull(),
  description: varchar('description', { length: 1024 }), // alt text
  contentType: varchar('content_type', { length: 128 }).notNull(),
  size: integer('size').notNull(), // bytes
  url: text('url').notNull(),
  proxyUrl: text('proxy_url').notNull(),
  height: integer('height'),
  width: integer('width'),
  durationSecs: integer('duration_secs'),
  waveform: text('waveform'), // base64 for voice messages
  flags: integer('flags').notNull().default(0),
});

// ============================================================================
// Reactions
// ============================================================================

export const messageReactions = pgTable('message_reactions', {
  messageId: bigint('message_id', { mode: 'number' }).notNull(),
  emojiId: bigint('emoji_id', { mode: 'number' }),
  emojiName: varchar('emoji_name', { length: 64 }).notNull(),
  count: integer('count').notNull().default(0),
  burstCount: integer('burst_count').notNull().default(0),
});

export const messageReactionUsers = pgTable('message_reaction_users', {
  messageId: bigint('message_id', { mode: 'number' }).notNull(),
  emojiId: bigint('emoji_id', { mode: 'number' }),
  emojiName: varchar('emoji_name', { length: 64 }).notNull(),
  userId: bigint('user_id', { mode: 'number' })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  burst: boolean('burst').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// Edit history
// ============================================================================

export const messageEditHistory = pgTable('message_edit_history', {
  id: bigint('id', { mode: 'number' }).primaryKey(),
  messageId: bigint('message_id', { mode: 'number' }).notNull(),
  content: text('content').notNull(),
  embeds: jsonb('embeds'),
  editedAt: timestamp('edited_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// Pinned messages
// ============================================================================

export const channelPins = pgTable('channel_pins', {
  channelId: bigint('channel_id', { mode: 'number' }).notNull(),
  messageId: bigint('message_id', { mode: 'number' }).notNull(),
  pinnedBy: bigint('pinned_by', { mode: 'number' })
    .notNull()
    .references(() => users.id),
  pinnedAt: timestamp('pinned_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// Polls
// ============================================================================

export const polls = pgTable('polls', {
  id: bigint('id', { mode: 'number' }).primaryKey(),
  questionText: varchar('question_text', { length: 300 }).notNull(),
  allowMultiselect: boolean('allow_multiselect').notNull().default(false),
  expiry: timestamp('expiry', { withTimezone: true }),
  finalized: boolean('finalized').notNull().default(false),
});

export const pollAnswers = pgTable('poll_answers', {
  id: bigint('id', { mode: 'number' }).primaryKey(),
  pollId: bigint('poll_id', { mode: 'number' })
    .notNull()
    .references(() => polls.id, { onDelete: 'cascade' }),
  text: varchar('text', { length: 255 }).notNull(),
  emojiId: bigint('emoji_id', { mode: 'number' }),
  emojiName: varchar('emoji_name', { length: 64 }),
  voteCount: integer('vote_count').notNull().default(0),
});

export const pollVotes = pgTable('poll_votes', {
  pollId: bigint('poll_id', { mode: 'number' })
    .notNull()
    .references(() => polls.id, { onDelete: 'cascade' }),
  answerId: bigint('answer_id', { mode: 'number' })
    .notNull()
    .references(() => pollAnswers.id, { onDelete: 'cascade' }),
  userId: bigint('user_id', { mode: 'number' })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
});

// ============================================================================
// Scheduled messages
// ============================================================================

export const scheduledMessages = pgTable('scheduled_messages', {
  id: bigint('id', { mode: 'number' }).primaryKey(),
  channelId: bigint('channel_id', { mode: 'number' }).notNull(),
  authorId: bigint('author_id', { mode: 'number' })
    .notNull()
    .references(() => users.id),
  content: text('content').notNull(),
  embeds: jsonb('embeds').notNull().default([]),
  attachments: jsonb('attachments').notNull().default([]),
  scheduledFor: timestamp('scheduled_for', { withTimezone: true }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
