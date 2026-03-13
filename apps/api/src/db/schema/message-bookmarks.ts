import { pgTable, uuid, text, timestamp, unique, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { messages } from './messages';
import { bookmarkFolders } from './bookmark-folders';

export const messageBookmarks = pgTable('message_bookmarks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  messageId: uuid('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  folderId: uuid('folder_id').references(() => bookmarkFolders.id, { onDelete: 'set null' }),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique().on(table.userId, table.messageId),
  index().on(table.userId, table.createdAt),
]);

export type MessageBookmark = typeof messageBookmarks.$inferSelect;
export type NewMessageBookmark = typeof messageBookmarks.$inferInsert;
