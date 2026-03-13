import { pgTable, uuid, varchar, integer, timestamp } from 'drizzle-orm/pg-core';
import { guilds } from './guilds';

/**
 * emoji_categories — Named categories for organizing server custom emojis.
 */
export const emojiCategories = pgTable('emoji_categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  guildId: uuid('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 32 }).notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type EmojiCategory = typeof emojiCategories.$inferSelect;
export type NewEmojiCategory = typeof emojiCategories.$inferInsert;
