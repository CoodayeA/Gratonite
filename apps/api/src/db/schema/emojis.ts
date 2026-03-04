import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';
import { guilds } from './guilds';
import { users } from './users';

/**
 * guild_emojis — Custom emojis uploaded to a guild.
 */
export const guildEmojis = pgTable('guild_emojis', {
  id: uuid('id').defaultRandom().primaryKey(),
  guildId: uuid('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 32 }).notNull(),
  imageUrl: varchar('image_url', { length: 500 }).notNull(),
  uploadedBy: uuid('uploaded_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type GuildEmoji = typeof guildEmojis.$inferSelect;
export type NewGuildEmoji = typeof guildEmojis.$inferInsert;
