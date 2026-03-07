import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { messages } from './messages';

export const messageEditHistory = pgTable('message_edit_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  messageId: uuid('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  editedAt: timestamp('edited_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_edit_history_message').on(table.messageId),
]);

export type MessageEditHistory = typeof messageEditHistory.$inferSelect;
export type NewMessageEditHistory = typeof messageEditHistory.$inferInsert;
