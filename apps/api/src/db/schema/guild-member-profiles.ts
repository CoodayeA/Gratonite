/**
 * guild-member-profiles.ts — Drizzle ORM schema for per-server member profiles.
 *
 * Each user can have exactly one custom profile per guild, allowing them to
 * set a server-specific display name, avatar, and bio that override their
 * global profile within that guild context.
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { guilds } from './guilds';

// ---------------------------------------------------------------------------
// guild_member_profiles
// ---------------------------------------------------------------------------

export const guildMemberProfiles = pgTable(
  'guild_member_profiles',
  {
    /** Primary key. */
    id: uuid('id').primaryKey().defaultRandom(),

    /** The user this profile belongs to. Cascade-deletes when the user is removed. */
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** The guild this profile is scoped to. Cascade-deletes when the guild is removed. */
    guildId: uuid('guild_id')
      .notNull()
      .references(() => guilds.id, { onDelete: 'cascade' }),

    /** Server-specific display name (nullable — falls back to global). */
    displayName: varchar('display_name', { length: 64 }),

    /** Server-specific avatar URL (nullable — falls back to global). */
    avatarUrl: text('avatar_url'),

    /** Server-specific bio (nullable — falls back to global). */
    bio: text('bio'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /** A user can only have one profile per guild. */
    unique('guild_member_profiles_user_guild_key').on(table.userId, table.guildId),
  ],
);

export type GuildMemberProfile = typeof guildMemberProfiles.$inferSelect;
export type NewGuildMemberProfile = typeof guildMemberProfiles.$inferInsert;
