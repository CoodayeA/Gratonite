import { pgTable, uuid, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { guilds } from './guilds';
import { channels } from './channels';

export const moodBoardItems = pgTable('mood_board_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  channelId: uuid('channel_id').notNull().references(() => channels.id, { onDelete: 'cascade' }),
  guildId: uuid('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  itemType: text('item_type').notNull(),
  content: text('content').notNull(),
  position: jsonb('position').notNull().default({ x: 0, y: 0, w: 200, h: 200 }),
  addedBy: uuid('added_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_mood_board_items_channel').on(table.channelId),
]);

export type MoodBoardItem = typeof moodBoardItems.$inferSelect;
export type NewMoodBoardItem = typeof moodBoardItems.$inferInsert;
