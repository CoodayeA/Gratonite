import { pgTable, uuid, jsonb } from 'drizzle-orm/pg-core';
import { guilds } from './guilds';
import { channels } from './channels';

export const guildLogConfig = pgTable('guild_log_config', {
  guildId: uuid('guild_id').primaryKey().references(() => guilds.id, { onDelete: 'cascade' }),
  channelId: uuid('channel_id').notNull().references(() => channels.id, { onDelete: 'cascade' }),
  events: jsonb('events').notNull().default([
    'member_join', 'member_leave', 'ban', 'unban',
    'role_change', 'channel_create', 'channel_delete', 'message_delete',
  ]),
});

export type GuildLogConfig = typeof guildLogConfig.$inferSelect;
export type NewGuildLogConfig = typeof guildLogConfig.$inferInsert;
