import { pgTable, uuid, text, integer, timestamp, unique } from 'drizzle-orm/pg-core';
import { users } from './users';
import { messages } from './messages';
import { guilds } from './guilds';

export const textReactions = pgTable('text_reactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  messageId: uuid('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  textContent: text('text_content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  unq: unique().on(table.messageId, table.userId, table.textContent),
}));

export const textReactionStats = pgTable('text_reaction_stats', {
  id: uuid('id').primaryKey().defaultRandom(),
  guildId: uuid('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  useCount: integer('use_count').notNull().default(1),
}, (table) => ({
  unq: unique().on(table.guildId, table.text),
}));

export type TextReaction = typeof textReactions.$inferSelect;
export type NewTextReaction = typeof textReactions.$inferInsert;
export type TextReactionStat = typeof textReactionStats.$inferSelect;
