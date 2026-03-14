import { pgTable, uuid, varchar, text, jsonb, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const standupConfigs = pgTable('standup_configs', {
  id: uuid('id').defaultRandom().primaryKey(),
  guildId: uuid('guild_id').notNull(),
  channelId: uuid('channel_id').notNull(),
  /** Cron-like schedule: "09:00" daily, "MON,WED,FRI 09:00", etc. */
  schedule: varchar('schedule', { length: 100 }).notNull().default('09:00'),
  timezone: varchar('timezone', { length: 100 }).notNull().default('UTC'),
  questions: jsonb('questions').notNull().default(['What did you do yesterday?', 'What will you do today?', 'Any blockers?']),
  enabled: boolean('enabled').notNull().default(true),
  createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const standupResponses = pgTable('standup_responses', {
  id: uuid('id').defaultRandom().primaryKey(),
  configId: uuid('config_id').notNull().references(() => standupConfigs.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: varchar('date', { length: 10 }).notNull(), // YYYY-MM-DD
  answers: jsonb('answers').notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type StandupConfig = typeof standupConfigs.$inferSelect;
export type StandupResponse = typeof standupResponses.$inferSelect;
