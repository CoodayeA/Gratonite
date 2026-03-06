import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { guilds } from './guilds';
import { users } from './users';

export const stickers = pgTable('stickers', {
  id: uuid('id').primaryKey().defaultRandom(),
  guildId: text('guild_id').references(() => guilds.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  assetUrl: text('asset_url').notNull(),
  tags: text('tags').array().notNull().default([]),
  creatorId: text('creator_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Sticker = typeof stickers.$inferSelect;
export type NewSticker = typeof stickers.$inferInsert;
