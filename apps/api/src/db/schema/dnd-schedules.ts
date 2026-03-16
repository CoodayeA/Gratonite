import { pgTable, uuid, varchar, jsonb, boolean, timestamp, unique } from 'drizzle-orm/pg-core';
import { users } from './users';

export const dndSchedules = pgTable('dnd_schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  startTime: varchar('start_time', { length: 5 }).notNull(),
  endTime: varchar('end_time', { length: 5 }).notNull(),
  days: jsonb('days').notNull().default([0, 1, 2, 3, 4, 5, 6]),
  timezone: varchar('timezone', { length: 50 }).notNull().default('UTC'),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique().on(table.userId),
]);

export type DndSchedule = typeof dndSchedules.$inferSelect;
export type NewDndSchedule = typeof dndSchedules.$inferInsert;
