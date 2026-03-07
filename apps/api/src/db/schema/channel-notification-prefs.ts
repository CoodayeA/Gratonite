import { pgTable, uuid, text, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { users } from './users';
import { channels } from './channels';

export const channelNotificationPrefs = pgTable('channel_notification_prefs', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  channelId: uuid('channel_id').notNull().references(() => channels.id, { onDelete: 'cascade' }),
  level: text('level').notNull().default('default'), // 'all'|'mentions'|'none'|'default'
  mutedUntil: timestamp('muted_until', { withTimezone: true }),
}, (table) => [
  primaryKey({ columns: [table.userId, table.channelId] }),
]);

export type ChannelNotificationPref = typeof channelNotificationPrefs.$inferSelect;
export type NewChannelNotificationPref = typeof channelNotificationPrefs.$inferInsert;
