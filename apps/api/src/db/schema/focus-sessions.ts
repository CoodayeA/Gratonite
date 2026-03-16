import { pgTable, uuid, varchar, integer, boolean, timestamp, unique } from 'drizzle-orm/pg-core';
import { channels } from './channels';
import { users } from './users';

export const focusSessions = pgTable('focus_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  channelId: uuid('channel_id').notNull().references(() => channels.id, { onDelete: 'cascade' }),
  creatorId: uuid('creator_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull().default('Focus Session'),
  workDuration: integer('work_duration').notNull().default(1500),
  breakDuration: integer('break_duration').notNull().default(300),
  currentPhase: varchar('current_phase', { length: 10 }).notNull().default('work'),
  phaseStartedAt: timestamp('phase_started_at', { withTimezone: true }),
  roundNumber: integer('round_number').notNull().default(1),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
});

export const focusSessionParticipants = pgTable('focus_session_participants', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id').notNull().references(() => focusSessions.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  totalFocusTime: integer('total_focus_time').notNull().default(0),
  completedRounds: integer('completed_rounds').notNull().default(0),
}, (table) => [
  unique('focus_session_participants_session_user_key').on(table.sessionId, table.userId),
]);

export type FocusSession = typeof focusSessions.$inferSelect;
export type NewFocusSession = typeof focusSessions.$inferInsert;
export type FocusSessionParticipant = typeof focusSessionParticipants.$inferSelect;
export type NewFocusSessionParticipant = typeof focusSessionParticipants.$inferInsert;
