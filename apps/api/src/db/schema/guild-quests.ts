import { pgTable, uuid, text, timestamp, integer, boolean, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users';
import { guilds } from './guilds';

export const guildQuests = pgTable('guild_quests', {
  id: uuid('id').primaryKey().defaultRandom(),
  guildId: uuid('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  questType: text('quest_type').notNull().default('messages'),
  targetValue: integer('target_value').notNull(),
  currentValue: integer('current_value').notNull().default(0),
  reward: jsonb('reward').notNull().default({ coins: 100 }),
  startDate: timestamp('start_date', { withTimezone: true }).notNull().defaultNow(),
  endDate: timestamp('end_date', { withTimezone: true }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  recurring: boolean('recurring').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const guildQuestContributions = pgTable('guild_quest_contributions', {
  id: uuid('id').primaryKey().defaultRandom(),
  questId: uuid('quest_id').notNull().references(() => guildQuests.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  contributionValue: integer('contribution_value').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type GuildQuest = typeof guildQuests.$inferSelect;
export type NewGuildQuest = typeof guildQuests.$inferInsert;
export type GuildQuestContribution = typeof guildQuestContributions.$inferSelect;
export type NewGuildQuestContribution = typeof guildQuestContributions.$inferInsert;
