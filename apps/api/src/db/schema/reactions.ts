import { pgTable, uuid, varchar, timestamp, unique } from 'drizzle-orm/pg-core';
import { messages } from './messages';
import { users } from './users';

/**
 * message_reactions — Emoji reactions on messages.
 */
export const messageReactions = pgTable('message_reactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  messageId: uuid('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  emoji: varchar('emoji', { length: 64 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('message_reactions_msg_user_emoji_unique').on(table.messageId, table.userId, table.emoji),
]);

export type MessageReaction = typeof messageReactions.$inferSelect;
export type NewMessageReaction = typeof messageReactions.$inferInsert;
