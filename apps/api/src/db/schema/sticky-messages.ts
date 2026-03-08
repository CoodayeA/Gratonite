import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { channels } from './channels';
import { messages } from './messages';
import { users } from './users';

export const stickyMessages = pgTable('sticky_messages', {
  channelId: uuid('channel_id').primaryKey().references(() => channels.id, { onDelete: 'cascade' }),
  messageId: uuid('message_id').references(() => messages.id, { onDelete: 'set null' }),
  content: text('content').notNull(),
  setBy: uuid('set_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  setAt: timestamp('set_at', { withTimezone: true }).notNull().defaultNow(),
});

export type StickyMessage = typeof stickyMessages.$inferSelect;
export type NewStickyMessage = typeof stickyMessages.$inferInsert;
