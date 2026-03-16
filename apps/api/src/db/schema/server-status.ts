import { pgTable, uuid, varchar, integer, timestamp, jsonb, unique } from 'drizzle-orm/pg-core';
import { guilds } from './guilds';
import { users } from './users';

export const botHeartbeats = pgTable('bot_heartbeats', {
  id: uuid('id').defaultRandom().primaryKey(),
  guildId: uuid('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  botId: uuid('bot_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  lastPingAt: timestamp('last_ping_at', { withTimezone: true }).notNull().defaultNow(),
  status: varchar('status', { length: 20 }).notNull().default('online'),
  metadata: jsonb('metadata'),
}, (table) => [
  unique().on(table.guildId, table.botId),
]);

export const webhookStatusHistory = pgTable('webhook_status_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  guildId: uuid('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  webhookId: uuid('webhook_id').notNull(),
  status: varchar('status', { length: 20 }).notNull(),
  statusCode: integer('status_code'),
  responseTime: integer('response_time'),
  checkedAt: timestamp('checked_at', { withTimezone: true }).notNull().defaultNow(),
});

export type BotHeartbeat = typeof botHeartbeats.$inferSelect;
export type NewBotHeartbeat = typeof botHeartbeats.$inferInsert;
export type WebhookStatusHistoryRow = typeof webhookStatusHistory.$inferSelect;
export type NewWebhookStatusHistoryRow = typeof webhookStatusHistory.$inferInsert;
