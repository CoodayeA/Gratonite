import {
  pgTable,
  uuid,
  integer,
  date,
  unique,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const fameDailyLimits = pgTable(
  'fame_daily_limits',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    date: date('date').notNull(),

    count: integer('count').notNull().default(0),
  },
  (table) => [
    unique('fame_daily_limits_user_id_date_key').on(table.userId, table.date),
  ],
);

export type FameDailyLimit = typeof fameDailyLimits.$inferSelect;
export type NewFameDailyLimit = typeof fameDailyLimits.$inferInsert;
