import { pgTable, uuid, varchar, integer, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

/** Per-guild XP tracking (separate from global user.xp) */
export const guildXp = pgTable('guild_xp', {
  id: uuid('id').defaultRandom().primaryKey(),
  guildId: uuid('guild_id').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  xp: integer('xp').notNull().default(0),
  level: integer('level').notNull().default(1),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Level-up role rewards per guild */
export const levelRoles = pgTable('level_roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  guildId: uuid('guild_id').notNull(),
  level: integer('level').notNull(),
  roleId: uuid('role_id').notNull(),
});

export type GuildXp = typeof guildXp.$inferSelect;
export type LevelRole = typeof levelRoles.$inferSelect;
