import { pgTable, uuid, date, jsonb, integer, timestamp, unique } from 'drizzle-orm/pg-core';
import { guilds } from './guilds';

export const guildHighlights = pgTable('guild_highlights', {
  id: uuid('id').primaryKey().defaultRandom(),
  guildId: uuid('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  weekStart: date('week_start').notNull(),
  topMessages: jsonb('top_messages').notNull().default([]),
  activeMembers: jsonb('active_members').notNull().default([]),
  messageCount: integer('message_count').notNull().default(0),
  memberCount: integer('member_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('guild_highlights_guild_week').on(table.guildId, table.weekStart),
]);

export type GuildHighlight = typeof guildHighlights.$inferSelect;
