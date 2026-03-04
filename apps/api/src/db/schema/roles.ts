import { pgTable, uuid, varchar, boolean, bigint, integer, timestamp, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { guilds } from './guilds';
import { users } from './users';

/**
 * Permission bitfield constants.
 * Each permission is a power of 2 so they can be combined with bitwise OR.
 */
export const Permissions = {
  ADMINISTRATOR:     1n << 0n,
  MANAGE_GUILD:      1n << 1n,
  MANAGE_CHANNELS:   1n << 2n,
  MANAGE_ROLES:      1n << 3n,
  KICK_MEMBERS:      1n << 4n,
  BAN_MEMBERS:       1n << 5n,
  MANAGE_MESSAGES:   1n << 6n,
  SEND_MESSAGES:     1n << 7n,
  VIEW_CHANNEL:      1n << 8n,
  CONNECT:           1n << 9n,
  SPEAK:             1n << 10n,
  MUTE_MEMBERS:      1n << 11n,
  DEAFEN_MEMBERS:    1n << 12n,
  MANAGE_NICKNAMES:  1n << 13n,
  MANAGE_EMOJIS:     1n << 14n,
  MANAGE_WEBHOOKS:   1n << 15n,
  CREATE_INVITES:    1n << 16n,
} as const;

/** Default permissions for @everyone role */
export const DEFAULT_PERMISSIONS =
  Permissions.SEND_MESSAGES |
  Permissions.VIEW_CHANNEL |
  Permissions.CONNECT |
  Permissions.SPEAK |
  Permissions.CREATE_INVITES;

/**
 * roles — Guild roles with permission bitfields.
 * Default permissions value: SEND_MESSAGES | VIEW_CHANNEL | CONNECT | SPEAK | CREATE_INVITES = 66432
 */
export const roles = pgTable('roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  guildId: uuid('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  color: varchar('color', { length: 7 }),
  position: integer('position').notNull().default(0),
  permissions: bigint('permissions', { mode: 'bigint' }).notNull().default(sql.raw(`${Number(DEFAULT_PERMISSIONS)}`)),
  hoist: boolean('hoist').notNull().default(false),
  mentionable: boolean('mentionable').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;

/**
 * member_roles — Junction table assigning roles to guild members.
 */
export const memberRoles = pgTable('member_roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  roleId: uuid('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  guildId: uuid('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
}, (table) => [
  unique('member_roles_user_role_unique').on(table.userId, table.roleId),
]);

export type MemberRole = typeof memberRoles.$inferSelect;
export type NewMemberRole = typeof memberRoles.$inferInsert;
