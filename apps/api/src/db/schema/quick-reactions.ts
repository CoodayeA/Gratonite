import { pgTable, uuid, text } from 'drizzle-orm/pg-core';
import { users } from './users';

export const userQuickReactions = pgTable('user_quick_reactions', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  emojis: text('emojis').array().notNull().default(['👍', '❤️', '😂', '🎉', '🔥', '😮', '😢', '👀']),
});

export type UserQuickReactions = typeof userQuickReactions.$inferSelect;
