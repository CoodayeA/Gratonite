/**
 * bot-guild-permissions.ts — Per-guild permissions for installed bots.
 */

import { pgTable, uuid, bigint, timestamp, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { botApplications } from './bot-applications';
import { guilds } from './guilds';
import { Permissions } from './roles';

/** Default bot permissions: SEND_MESSAGES | VIEW_CHANNEL */
export const DEFAULT_BOT_PERMISSIONS = Permissions.SEND_MESSAGES | Permissions.VIEW_CHANNEL;

export const botGuildPermissions = pgTable('bot_guild_permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  botApplicationId: uuid('bot_application_id').notNull().references(() => botApplications.id, { onDelete: 'cascade' }),
  guildId: uuid('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  permissions: bigint('permissions', { mode: 'bigint' }).notNull().default(sql.raw(`${Number(DEFAULT_BOT_PERMISSIONS)}`)),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('bot_guild_permissions_bot_guild_key').on(table.botApplicationId, table.guildId),
]);

export type BotGuildPermission = typeof botGuildPermissions.$inferSelect;
export type NewBotGuildPermission = typeof botGuildPermissions.$inferInsert;
