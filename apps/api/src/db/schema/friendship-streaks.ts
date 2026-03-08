import { pgTable, uuid, text, integer, timestamp, unique } from 'drizzle-orm/pg-core';
import { users } from './users';

export const friendshipStreaks = pgTable('friendship_streaks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  friendId: uuid('friend_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  currentStreak: integer('current_streak').notNull().default(0),
  longestStreak: integer('longest_streak').notNull().default(0),
  lastInteraction: timestamp('last_interaction', { withTimezone: true }),
  friendsSince: timestamp('friends_since', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  unq: unique().on(table.userId, table.friendId),
}));

export const friendshipMilestones = pgTable('friendship_milestones', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  friendId: uuid('friend_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  milestone: text('milestone').notNull(),
  unlockedAt: timestamp('unlocked_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  unq: unique().on(table.userId, table.friendId, table.milestone),
}));

export type FriendshipStreak = typeof friendshipStreaks.$inferSelect;
export type NewFriendshipStreak = typeof friendshipStreaks.$inferInsert;
export type FriendshipMilestone = typeof friendshipMilestones.$inferSelect;
export type NewFriendshipMilestone = typeof friendshipMilestones.$inferInsert;
