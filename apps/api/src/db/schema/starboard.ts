import { pgTable, uuid, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { guilds } from './guilds';
import { channels } from './channels';
import { messages } from './messages';

export const starboardConfig = pgTable('starboard_config', {
  guildId: uuid('guild_id').primaryKey().references(() => guilds.id, { onDelete: 'cascade' }),
  targetChannelId: uuid('target_channel_id').references(() => channels.id, { onDelete: 'set null' }),
  emoji: text('emoji').notNull().default('⭐'),
  threshold: integer('threshold').notNull().default(5),
  enabled: boolean('enabled').notNull().default(true),
});

export const starboardEntries = pgTable('starboard_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  guildId: uuid('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  originalMessageId: uuid('original_message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  starboardMessageId: uuid('starboard_message_id').references(() => messages.id, { onDelete: 'set null' }),
  starCount: integer('star_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type StarboardConfig = typeof starboardConfig.$inferSelect;
export type NewStarboardConfig = typeof starboardConfig.$inferInsert;
export type StarboardEntry = typeof starboardEntries.$inferSelect;
export type NewStarboardEntry = typeof starboardEntries.$inferInsert;
