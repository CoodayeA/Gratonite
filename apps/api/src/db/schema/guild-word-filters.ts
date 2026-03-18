import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { guilds } from './guilds';
import { sql } from 'drizzle-orm';

export const guildWordFilters = pgTable('guild_word_filters', {
  id: uuid('id').primaryKey().defaultRandom(),
  guildId: uuid('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }).unique(),
  words: text('words').array().notNull().default(sql`'{}'::text[]`),
  action: text('action').notNull().default('block'), // 'block'|'delete'|'warn'
  exemptRoles: uuid('exempt_roles').array().notNull().default(sql`'{}'::uuid[]`),
  regexPatterns: text('regex_patterns').array().notNull().default(sql`'{}'::text[]`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type GuildWordFilter = typeof guildWordFilters.$inferSelect;
export type NewGuildWordFilter = typeof guildWordFilters.$inferInsert;
