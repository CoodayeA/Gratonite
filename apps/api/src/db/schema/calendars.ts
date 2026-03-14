import { pgTable, uuid, varchar, text, timestamp, boolean } from 'drizzle-orm/pg-core';
import { users } from './users';

export const calendarEvents = pgTable('calendar_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  guildId: uuid('guild_id').notNull(),
  channelId: uuid('channel_id'),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  startAt: timestamp('start_at', { withTimezone: true }).notNull(),
  endAt: timestamp('end_at', { withTimezone: true }),
  allDay: boolean('all_day').notNull().default(false),
  color: varchar('color', { length: 20 }).default('#5865F2'),
  createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  recurring: varchar('recurring', { length: 20 }), // none, daily, weekly, monthly
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const calendarRsvps = pgTable('calendar_rsvps', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').notNull().references(() => calendarEvents.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 20 }).notNull().default('going'), // going, maybe, not_going
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type CalendarRsvp = typeof calendarRsvps.$inferSelect;
