import { pgTable, uuid, varchar, text, integer, timestamp, unique } from 'drizzle-orm/pg-core';
import { channels } from './channels';
import { guilds } from './guilds';
import { users } from './users';

export const readingListItems = pgTable('reading_list_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  channelId: uuid('channel_id').notNull().references(() => channels.id, { onDelete: 'cascade' }),
  guildId: uuid('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  addedBy: uuid('added_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  title: varchar('title', { length: 300 }).notNull(),
  description: text('description'),
  imageUrl: text('image_url'),
  tags: text('tags').array().notNull().default([]),
  upvotes: integer('upvotes').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const readingListVotes = pgTable('reading_list_votes', {
  id: uuid('id').defaultRandom().primaryKey(),
  itemId: uuid('item_id').notNull().references(() => readingListItems.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
}, (table) => [
  unique().on(table.itemId, table.userId),
]);

export const readingListReadStatus = pgTable('reading_list_read_status', {
  id: uuid('id').defaultRandom().primaryKey(),
  itemId: uuid('item_id').notNull().references(() => readingListItems.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  readAt: timestamp('read_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique().on(table.itemId, table.userId),
]);

export type ReadingListItem = typeof readingListItems.$inferSelect;
export type NewReadingListItem = typeof readingListItems.$inferInsert;
export type ReadingListVote = typeof readingListVotes.$inferSelect;
export type ReadingListReadStatusRow = typeof readingListReadStatus.$inferSelect;
