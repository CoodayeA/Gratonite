import { pgTable, uuid, varchar, text, boolean, integer, timestamp, unique } from 'drizzle-orm/pg-core';
import { channels } from './channels';
import { messages } from './messages';
import { users } from './users';

/**
 * threads — Thread conversations spawned from messages.
 */
export const threads = pgTable('threads', {
  id: uuid('id').defaultRandom().primaryKey(),
  channelId: uuid('channel_id').notNull().references(() => channels.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  creatorId: uuid('creator_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  originMessageId: uuid('origin_message_id').references(() => messages.id, { onDelete: 'set null' }),
  archived: boolean('archived').notNull().default(false),
  locked: boolean('locked').notNull().default(false),
  forumTagIds: text('forum_tag_ids').array(),
  pinned: boolean('pinned').notNull().default(false),
  messageCount: integer('message_count').notNull().default(0),
  /** Auto-archive after N seconds of inactivity. Null = never. */
  archiveAfter: integer('archive_after'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Thread = typeof threads.$inferSelect;
export type NewThread = typeof threads.$inferInsert;

/**
 * thread_members — Users participating in a thread.
 */
export const threadMembers = pgTable('thread_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  threadId: uuid('thread_id').notNull().references(() => threads.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('thread_members_thread_user_unique').on(table.threadId, table.userId),
]);

export type ThreadMember = typeof threadMembers.$inferSelect;
export type NewThreadMember = typeof threadMembers.$inferInsert;
