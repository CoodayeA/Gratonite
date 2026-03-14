import { pgTable, uuid, varchar, text, jsonb, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const integrations = pgTable('integrations', {
  id: uuid('id').defaultRandom().primaryKey(),
  guildId: uuid('guild_id').notNull(),
  channelId: uuid('channel_id').notNull(),
  type: varchar('type', { length: 50 }).notNull(), // github, jira, rss, custom_webhook
  name: varchar('name', { length: 100 }).notNull(),
  config: jsonb('config').notNull().default({}),
  enabled: boolean('enabled').notNull().default(true),
  createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const integrationLogs = pgTable('integration_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  integrationId: uuid('integration_id').notNull().references(() => integrations.id, { onDelete: 'cascade' }),
  event: varchar('event', { length: 100 }).notNull(),
  payload: jsonb('payload'),
  status: varchar('status', { length: 20 }).notNull().default('success'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Integration = typeof integrations.$inferSelect;
export type IntegrationLog = typeof integrationLogs.$inferSelect;
