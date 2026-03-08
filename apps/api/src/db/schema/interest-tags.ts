import { pgTable, uuid, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { users } from './users';

export const interestTags = pgTable('interest_tags', {
  tag: text('tag').primaryKey(),
  category: text('category').notNull(),
  icon: text('icon'),
});

export const userInterests = pgTable('user_interests', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tag: text('tag').notNull().references(() => interestTags.tag, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  unq: unique().on(table.userId, table.tag),
}));

export type InterestTag = typeof interestTags.$inferSelect;
export type UserInterest = typeof userInterests.$inferSelect;
export type NewUserInterest = typeof userInterests.$inferInsert;
