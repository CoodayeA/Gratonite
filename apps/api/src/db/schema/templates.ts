import { pgTable, text, uuid, integer, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { guilds } from './guilds';
import { users } from './users';

/**
 * guild_templates — Server templates that snapshot a guild's structure.
 */
export const guildTemplates = pgTable('guild_templates', {
  code: text('code').primaryKey(),
  guildId: uuid('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  creatorId: uuid('creator_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  description: text('description'),
  usageCount: integer('usage_count').notNull().default(0),
  serializedGuild: jsonb('serialized_guild').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type GuildTemplate = typeof guildTemplates.$inferSelect;
export type NewGuildTemplate = typeof guildTemplates.$inferInsert;
