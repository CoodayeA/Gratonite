import { pgTable, text, integer, boolean, uuid, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { users } from './users';

export const achievements = pgTable('achievements', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  icon: text('icon').notNull(),
  points: integer('points').notNull().default(10),
  hidden: boolean('hidden').notNull().default(false),
});

export const userAchievements = pgTable('user_achievements', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  achievementId: text('achievement_id').notNull().references(() => achievements.id),
  earnedAt: timestamp('earned_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.achievementId] }),
}));

export type Achievement = typeof achievements.$inferSelect;
export type UserAchievement = typeof userAchievements.$inferSelect;
