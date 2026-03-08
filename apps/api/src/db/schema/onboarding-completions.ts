import { pgTable, uuid, text, integer, timestamp, jsonb, unique } from 'drizzle-orm/pg-core';
import { guilds } from './guilds';
import { users } from './users';

export const guildOnboardingSteps = pgTable('guild_onboarding_steps', {
  id: uuid('id').primaryKey().defaultRandom(),
  guildId: uuid('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  stepType: text('step_type').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  options: jsonb('options').notNull().default([]),
  displayOrder: integer('display_order').notNull().default(0),
});

export type GuildOnboardingStep = typeof guildOnboardingSteps.$inferSelect;
export type NewGuildOnboardingStep = typeof guildOnboardingSteps.$inferInsert;

export const guildOnboardingCompletions = pgTable('guild_onboarding_completions', {
  id: uuid('id').primaryKey().defaultRandom(),
  guildId: uuid('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
  selections: jsonb('selections').notNull().default({}),
}, (table) => [
  unique('guild_onboarding_completions_guild_user_key').on(table.guildId, table.userId),
]);

export type GuildOnboardingCompletion = typeof guildOnboardingCompletions.$inferSelect;
export type NewGuildOnboardingCompletion = typeof guildOnboardingCompletions.$inferInsert;
