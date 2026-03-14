import { pgTable, uuid, varchar, jsonb, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { guilds } from './guilds';
import { users } from './users';

export const guildBackups = pgTable('guild_backups', {
  id: uuid('id').primaryKey().defaultRandom(),
  guildId: uuid('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 200 }).notNull(),
  data: jsonb('data').notNull(),
  sizeBytes: integer('size_bytes').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('guild_backups_guild_idx').on(table.guildId),
]);

export type GuildBackup = typeof guildBackups.$inferSelect;
