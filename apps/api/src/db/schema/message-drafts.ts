import { pgTable, uuid, text, timestamp, unique, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { channels } from './channels';

export const messageDrafts = pgTable('message_drafts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  channelId: uuid('channel_id').notNull().references(() => channels.id, { onDelete: 'cascade' }),
  content: text('content').notNull().default(''),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique().on(table.userId, table.channelId),
  index().on(table.userId),
]);

export type MessageDraft = typeof messageDrafts.$inferSelect;
export type NewMessageDraft = typeof messageDrafts.$inferInsert;
