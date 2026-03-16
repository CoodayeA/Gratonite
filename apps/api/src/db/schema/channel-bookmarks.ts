import { pgTable, uuid, varchar, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { channels } from './channels';
import { users } from './users';

export const channelBookmarks = pgTable('channel_bookmarks', {
  id: uuid('id').defaultRandom().primaryKey(),
  channelId: uuid('channel_id').notNull().references(() => channels.id, { onDelete: 'cascade' }),
  addedBy: uuid('added_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 200 }).notNull(),
  url: text('url'),
  fileId: uuid('file_id'),
  messageId: uuid('message_id'),
  type: varchar('type', { length: 20 }).notNull().default('link'),
  position: integer('position').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ChannelBookmark = typeof channelBookmarks.$inferSelect;
export type NewChannelBookmark = typeof channelBookmarks.$inferInsert;
