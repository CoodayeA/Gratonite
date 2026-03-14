import { pgTable, uuid, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const userTitles = pgTable('user_titles', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  color: varchar('color', { length: 20 }).default('#ffffff'),
  requirement: varchar('requirement', { length: 200 }), // e.g. "level_10", "messages_1000", "streak_30"
  rarity: varchar('rarity', { length: 20 }).notNull().default('common'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const userTitleOwnership = pgTable('user_title_ownership', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  titleId: uuid('title_id').notNull().references(() => userTitles.id, { onDelete: 'cascade' }),
  equipped: boolean('equipped').notNull().default(false),
  earnedAt: timestamp('earned_at', { withTimezone: true }).notNull().defaultNow(),
});

export type UserTitle = typeof userTitles.$inferSelect;
export type UserTitleOwnership = typeof userTitleOwnership.$inferSelect;
