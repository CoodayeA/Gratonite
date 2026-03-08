/**
 * guild-ratings.ts — Drizzle ORM schema for guild ratings.
 *
 * Each user can leave exactly one rating per guild. The unique constraint on
 * (guild_id, user_id) enforces this at the database level.
 */

import {
  pgTable,
  uuid,
  integer,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { guilds } from './guilds';
import { users } from './users';

// ---------------------------------------------------------------------------
// guild_ratings
// ---------------------------------------------------------------------------

export const guildRatings = pgTable(
  'guild_ratings',
  {
    /** Primary key. */
    id: uuid('id').primaryKey().defaultRandom(),

    /** The guild being rated. Cascade-deletes when the guild is removed. */
    guildId: uuid('guild_id')
      .notNull()
      .references(() => guilds.id, { onDelete: 'cascade' }),

    /** The user who submitted the rating. Cascade-deletes when the user is removed. */
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Integer rating value (e.g. 1–5). */
    rating: integer('rating').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /** A user can only rate each guild once. */
    unique('guild_ratings_guild_id_user_id_key').on(table.guildId, table.userId),
  ],
);

export type GuildRating = typeof guildRatings.$inferSelect;
export type NewGuildRating = typeof guildRatings.$inferInsert;
