import { pgTable, uuid, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { users } from './users';
import { guilds } from './guilds';
import { channels } from './channels';

export const studyRoomSettings = pgTable('study_room_settings', {
  channelId: uuid('channel_id').primaryKey().references(() => channels.id, { onDelete: 'cascade' }),
  pomodoroWork: integer('pomodoro_work').notNull().default(25),
  pomodoroBreak: integer('pomodoro_break').notNull().default(5),
  ambientSound: text('ambient_sound'),
});

export const studySessions = pgTable('study_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  guildId: uuid('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  channelId: uuid('channel_id').notNull().references(() => channels.id, { onDelete: 'cascade' }),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  duration: integer('duration').notNull().default(0),
  sessionType: text('session_type').notNull().default('pomodoro'),
});

export type StudyRoomSettings = typeof studyRoomSettings.$inferSelect;
export type NewStudyRoomSettings = typeof studyRoomSettings.$inferInsert;
export type StudySession = typeof studySessions.$inferSelect;
export type NewStudySession = typeof studySessions.$inferInsert;
