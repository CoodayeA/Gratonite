import { pgTable, uuid, boolean, jsonb, text, timestamp } from 'drizzle-orm/pg-core';
import { guilds } from './guilds';

/**
 * guild_welcome_screens — Configurable welcome screen shown to new members.
 *
 * The `blocks` column is a JSONB array of block objects, each representing
 * a section of the welcome screen (welcome message, recommended channels,
 * rules summary, resource links, etc.). The order in the array determines
 * display order.
 *
 * Block shape:
 *   { type: 'welcome_message' | 'channels' | 'rules' | 'links',
 *     title?: string,
 *     content?: string,
 *     channelIds?: string[],
 *     links?: { label: string, url: string }[] }
 */
export const guildWelcomeScreens = pgTable('guild_welcome_screens', {
  id: uuid('id').defaultRandom().primaryKey(),
  guildId: uuid('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }).unique(),
  enabled: boolean('enabled').notNull().default(false),
  description: text('description'),
  blocks: jsonb('blocks').notNull().default('[]'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type GuildWelcomeScreen = typeof guildWelcomeScreens.$inferSelect;
export type NewGuildWelcomeScreen = typeof guildWelcomeScreens.$inferInsert;
