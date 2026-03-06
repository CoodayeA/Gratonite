import { pgTable, uuid, text, integer } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * guild_folders — User-defined server folder organization.
 */
export const guildFolders = pgTable('guild_folders', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name'),
  color: text('color'),
  position: integer('position').notNull().default(0),
  guildIds: text('guild_ids').array().notNull().default([]),
});

export type GuildFolder = typeof guildFolders.$inferSelect;
export type NewGuildFolder = typeof guildFolders.$inferInsert;
