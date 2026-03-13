import { pgTable, uuid, varchar, text, timestamp, index } from 'drizzle-orm/pg-core';
import { channels } from './channels';
import { users } from './users';

export const channelDocuments = pgTable('channel_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  channelId: uuid('channel_id').notNull().references(() => channels.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 200 }).notNull(),
  content: text('content').notNull().default(''),
  lastEditorId: uuid('last_editor_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index().on(table.channelId, table.updatedAt),
]);

export type ChannelDocument = typeof channelDocuments.$inferSelect;
export type NewChannelDocument = typeof channelDocuments.$inferInsert;
