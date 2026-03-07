import { pgTable, text, uuid, integer, jsonb, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { users } from './users';

export const seasonalEvents = pgTable('seasonal_events', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  themeOverride: text('theme_override'),
  startAt: timestamp('start_at', { withTimezone: true }).notNull(),
  endAt: timestamp('end_at', { withTimezone: true }).notNull(),
  bannerColor: text('banner_color'),
  emoji: text('emoji'),
});

export const userEventProgress = pgTable('user_event_progress', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  eventId: text('event_id').notNull().references(() => seasonalEvents.id),
  points: integer('points').notNull().default(0),
  claimedRewards: jsonb('claimed_rewards').notNull().default([]),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.eventId] }),
}));

export type SeasonalEvent = typeof seasonalEvents.$inferSelect;
export type UserEventProgress = typeof userEventProgress.$inferSelect;
