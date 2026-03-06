/**
 * guild-onboarding.ts — Drizzle ORM schema for the `guild_member_onboarding` table.
 *
 * Tracks whether a member has completed the server onboarding flow.
 * A row is inserted (with completedAt = null) when a user joins a guild.
 * The row's completedAt is set to the current time when the user dismisses
 * the welcome modal.
 */

import {
  pgTable,
  uuid,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { guilds } from './guilds';
import { users } from './users';

// ---------------------------------------------------------------------------
// guild_member_onboarding
// ---------------------------------------------------------------------------

export const guildMemberOnboarding = pgTable(
  'guild_member_onboarding',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    guildId: uuid('guild_id')
      .notNull()
      .references(() => guilds.id, { onDelete: 'cascade' }),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Null until the user completes/dismisses the onboarding flow */
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    unique('guild_member_onboarding_guild_user_key').on(table.guildId, table.userId),
  ],
);

export type GuildMemberOnboarding = typeof guildMemberOnboarding.$inferSelect;
export type NewGuildMemberOnboarding = typeof guildMemberOnboarding.$inferInsert;
