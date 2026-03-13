import { pgTable, uuid, varchar, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * user_devices — Tracks known device+IP combos for login alert emails.
 * When a user logs in from an unrecognized device/IP, an alert email is sent.
 */
export const userDevices = pgTable('user_devices', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  ip: varchar('ip', { length: 45 }).notNull(),
  userAgentHash: varchar('user_agent_hash', { length: 64 }).notNull(),
  deviceLabel: varchar('device_label', { length: 255 }).notNull().default('Unknown Device'),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('user_devices_user_id_idx').on(table.userId),
  uniqueIndex('user_devices_user_ip_ua_idx').on(table.userId, table.ip, table.userAgentHash),
]);

export type UserDevice = typeof userDevices.$inferSelect;
export type NewUserDevice = typeof userDevices.$inferInsert;
