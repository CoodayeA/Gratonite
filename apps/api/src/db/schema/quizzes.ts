import { pgTable, uuid, varchar, text, jsonb, integer, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const quizzes = pgTable('quizzes', {
  id: uuid('id').defaultRandom().primaryKey(),
  guildId: uuid('guild_id').notNull(),
  channelId: uuid('channel_id'),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  /** Array of { question: string, options: string[], correctIndex: number } */
  questions: jsonb('questions').notNull().default([]),
  timeLimit: integer('time_limit'), // seconds per question, null = unlimited
  createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const quizAttempts = pgTable('quiz_attempts', {
  id: uuid('id').defaultRandom().primaryKey(),
  quizId: uuid('quiz_id').notNull().references(() => quizzes.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  answers: jsonb('answers').notNull().default([]), // array of selected indices
  score: integer('score').notNull().default(0),
  maxScore: integer('max_score').notNull().default(0),
  completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Quiz = typeof quizzes.$inferSelect;
export type QuizAttempt = typeof quizAttempts.$inferSelect;
