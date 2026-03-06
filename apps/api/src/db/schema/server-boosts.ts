import { pgTable, uuid, boolean, timestamp } from 'drizzle-orm/pg-core';
import { guilds } from './guilds';
import { users } from './users';

/**
 * server_boosts — Tracks active server boost subscriptions.
 */
export const serverBoosts = pgTable('server_boosts', {
  id: uuid('id').defaultRandom().primaryKey(),
  guildId: uuid('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  active: boolean('active').notNull().default(true),
});

export type ServerBoost = typeof serverBoosts.$inferSelect;
export type NewServerBoost = typeof serverBoosts.$inferInsert;
