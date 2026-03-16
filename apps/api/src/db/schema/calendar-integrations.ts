import { pgTable, uuid, varchar, text, timestamp, boolean, unique } from 'drizzle-orm/pg-core';
import { users } from './users';
import { guilds } from './guilds';

export const calendarIntegrations = pgTable('calendar_integrations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  guildId: uuid('guild_id').references(() => guilds.id, { onDelete: 'cascade' }),
  provider: varchar('provider', { length: 20 }).notNull().default('google'),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token').notNull(),
  tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }).notNull(),
  calendarId: varchar('calendar_id', { length: 200 }).notNull().default('primary'),
  syncEnabled: boolean('sync_enabled').notNull().default(true),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique().on(table.userId, table.guildId, table.provider),
]);

export type CalendarIntegration = typeof calendarIntegrations.$inferSelect;
export type NewCalendarIntegration = typeof calendarIntegrations.$inferInsert;
