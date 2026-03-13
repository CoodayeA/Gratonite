import { pgTable, uuid, varchar, integer, boolean, timestamp, date, index } from 'drizzle-orm/pg-core';
import { users } from './users';

export const dailyChallenges = pgTable('daily_challenges', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  challengeType: varchar('challenge_type', { length: 50 }).notNull(),
  description: varchar('description', { length: 255 }).notNull(),
  target: integer('target').notNull(),
  progress: integer('progress').notNull().default(0),
  completed: boolean('completed').notNull().default(false),
  claimed: boolean('claimed').notNull().default(false),
  reward: integer('reward').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index().on(table.userId, table.date),
]);

export const dailyChallengeStreaks = pgTable('daily_challenge_streaks', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  currentStreak: integer('current_streak').notNull().default(0),
  longestStreak: integer('longest_streak').notNull().default(0),
  lastCompletedDate: date('last_completed_date'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type DailyChallenge = typeof dailyChallenges.$inferSelect;
export type NewDailyChallenge = typeof dailyChallenges.$inferInsert;
export type DailyChallengeStreak = typeof dailyChallengeStreaks.$inferSelect;
