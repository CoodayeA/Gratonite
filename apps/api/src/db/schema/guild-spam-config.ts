import { pgTable, uuid, boolean, integer, text, timestamp } from 'drizzle-orm/pg-core';
import { guilds } from './guilds';
import { sql } from 'drizzle-orm';

export const guildSpamConfig = pgTable('guild_spam_config', {
  id: uuid('id').primaryKey().defaultRandom(),
  guildId: uuid('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }).unique(),
  enabled: boolean('enabled').notNull().default(false),
  maxDuplicateMessages: integer('max_duplicate_messages').notNull().default(5),
  duplicateWindowSeconds: integer('duplicate_window_seconds').notNull().default(10),
  maxMentionsPerMessage: integer('max_mentions_per_message').notNull().default(10),
  maxLinksPerMessage: integer('max_links_per_message').notNull().default(5),
  rapidJoinThreshold: integer('rapid_join_threshold').notNull().default(10),
  rapidJoinWindowSeconds: integer('rapid_join_window_seconds').notNull().default(30),
  action: text('action').notNull().default('flag'),
  exemptRoles: uuid('exempt_roles').array().notNull().default(sql`'{}'::uuid[]`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type GuildSpamConfig = typeof guildSpamConfig.$inferSelect;
