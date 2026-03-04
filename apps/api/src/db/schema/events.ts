/**
 * events.ts — Drizzle ORM schemas for scheduled events and interest tracking.
 *
 * Tables:
 *   1. `scheduled_events`  — Guild events with time, location, and status.
 *   2. `event_interests`   — Tracks which users are interested in which events.
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { guilds } from './guilds';
import { channels } from './channels';
import { users } from './users';

// ---------------------------------------------------------------------------
// scheduled_events
// ---------------------------------------------------------------------------

export const scheduledEvents = pgTable('scheduled_events', {
  id: uuid('id').primaryKey().defaultRandom(),

  guildId: uuid('guild_id')
    .notNull()
    .references(() => guilds.id, { onDelete: 'cascade' }),

  channelId: uuid('channel_id')
    .references(() => channels.id, { onDelete: 'set null' }),

  name: varchar('name', { length: 255 }).notNull(),

  description: text('description'),

  startTime: timestamp('start_time', { withTimezone: true }).notNull(),

  endTime: timestamp('end_time', { withTimezone: true }),

  location: text('location'),

  creatorId: uuid('creator_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  interestedCount: integer('interested_count').notNull().default(0),

  /** scheduled | active | completed | cancelled */
  status: varchar('status', { length: 20 }).notNull().default('scheduled'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ScheduledEvent = typeof scheduledEvents.$inferSelect;
export type NewScheduledEvent = typeof scheduledEvents.$inferInsert;

// ---------------------------------------------------------------------------
// event_interests
// ---------------------------------------------------------------------------

export const eventInterests = pgTable(
  'event_interests',
  {
    eventId: uuid('event_id')
      .notNull()
      .references(() => scheduledEvents.id, { onDelete: 'cascade' }),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('event_interests_event_user_key').on(table.eventId, table.userId),
  ],
);

export type EventInterest = typeof eventInterests.$inferSelect;
