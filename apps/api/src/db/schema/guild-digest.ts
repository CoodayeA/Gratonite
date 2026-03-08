import { pgTable, uuid, boolean, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { guilds } from './guilds';
import { channels } from './channels';

export const guildDigestConfig = pgTable('guild_digest_config', {
  guildId: uuid('guild_id').primaryKey().references(() => guilds.id, { onDelete: 'cascade' }),
  targetChannelId: uuid('target_channel_id').references(() => channels.id, { onDelete: 'set null' }),
  enabled: boolean('enabled').notNull().default(false),
  sections: jsonb('sections').notNull().default([
    'top_messages', 'new_members', 'message_count', 'active_channels', 'active_members',
  ]),
  dayOfWeek: integer('day_of_week').notNull().default(1),
  lastSentAt: timestamp('last_sent_at', { withTimezone: true }),
});

export type GuildDigestConfig = typeof guildDigestConfig.$inferSelect;
export type NewGuildDigestConfig = typeof guildDigestConfig.$inferInsert;

export const guildDigests = pgTable('guild_digests', {
  id: uuid('id').primaryKey().defaultRandom(),
  guildId: uuid('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  weekStart: timestamp('week_start', { withTimezone: true }).notNull(),
  content: jsonb('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type GuildDigest = typeof guildDigests.$inferSelect;
export type NewGuildDigest = typeof guildDigests.$inferInsert;
