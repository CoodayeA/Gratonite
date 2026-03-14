import { pgTable, uuid, varchar, real, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { guilds } from './guilds';
import { users } from './users';

export const guildSoundboard = pgTable('guild_soundboard', {
  id: uuid('id').primaryKey().defaultRandom(),
  guildId: uuid('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  fileHash: varchar('file_hash', { length: 255 }).notNull(),
  uploadedBy: uuid('uploaded_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  emoji: varchar('emoji', { length: 10 }),
  volume: real('volume').notNull().default(1.0),
  uses: integer('uses').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('guild_soundboard_guild_idx').on(table.guildId),
]);

export type GuildSoundboardEntry = typeof guildSoundboard.$inferSelect;
