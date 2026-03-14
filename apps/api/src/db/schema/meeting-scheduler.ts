import { pgTable, uuid, varchar, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const meetingPolls = pgTable('meeting_polls', {
  id: uuid('id').defaultRandom().primaryKey(),
  channelId: uuid('channel_id').notNull(),
  guildId: uuid('guild_id').notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  /** Array of { date: string, startTime: string, endTime: string } */
  timeSlots: jsonb('time_slots').notNull().default([]),
  createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const meetingVotes = pgTable('meeting_votes', {
  id: uuid('id').defaultRandom().primaryKey(),
  pollId: uuid('poll_id').notNull().references(() => meetingPolls.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  /** Indices of selected time slots */
  selectedSlots: jsonb('selected_slots').notNull().default([]),
  timezone: varchar('timezone', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type MeetingPoll = typeof meetingPolls.$inferSelect;
export type MeetingVote = typeof meetingVotes.$inferSelect;
