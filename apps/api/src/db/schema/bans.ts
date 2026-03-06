import { pgTable, uuid, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { guilds } from './guilds';
import { users } from './users';

/**
 * guild_bans — Tracks banned users per guild.
 */
export const guildBans = pgTable('guild_bans', {
  id: uuid('id').defaultRandom().primaryKey(),
  guildId: uuid('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  reason: text('reason'),
  bannedBy: uuid('banned_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  appealStatus: text('appeal_status'),
  appealText: text('appeal_text'),
  appealSubmittedAt: timestamp('appeal_submitted_at', { withTimezone: true }),
  appealReviewedBy: uuid('appeal_reviewed_by').references(() => users.id),
  appealReviewedAt: timestamp('appeal_reviewed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('guild_bans_guild_user_unique').on(table.guildId, table.userId),
]);

export type GuildBan = typeof guildBans.$inferSelect;
export type NewGuildBan = typeof guildBans.$inferInsert;
