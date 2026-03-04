import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { guilds } from './guilds';
import { users } from './users';

export const guildMemberGroups = pgTable('guild_member_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  guildId: uuid('guild_id')
    .notNull()
    .references(() => guilds.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 64 }).notNull(),
  color: varchar('color', { length: 16 }).notNull().default('#99aab5'),
  position: integer('position').notNull().default(0),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const guildMemberGroupMembers = pgTable(
  'guild_member_group_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => guildMemberGroups.id, { onDelete: 'cascade' }),
    guildId: uuid('guild_id')
      .notNull()
      .references(() => guilds.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('guild_member_group_members_group_user_key').on(table.groupId, table.userId),
  ],
);

export type GuildMemberGroup = typeof guildMemberGroups.$inferSelect;
export type NewGuildMemberGroup = typeof guildMemberGroups.$inferInsert;
export type GuildMemberGroupMember = typeof guildMemberGroupMembers.$inferSelect;
export type NewGuildMemberGroupMember = typeof guildMemberGroupMembers.$inferInsert;
