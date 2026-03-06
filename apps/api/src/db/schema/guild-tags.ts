/**
 * guild-tags.ts — Drizzle ORM schema for guild tags used in discovery.
 *
 * Guilds can have up to 10 tags to help users filter and find communities.
 */

import { pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import { guilds } from './guilds';

export const guildTags = pgTable('guild_tags', {
  id: uuid('id').primaryKey().defaultRandom(),

  guildId: uuid('guild_id')
    .notNull()
    .references(() => guilds.id, { onDelete: 'cascade' }),

  tag: varchar('tag', { length: 32 }).notNull(),
});

export type GuildTag = typeof guildTags.$inferSelect;
export type NewGuildTag = typeof guildTags.$inferInsert;
