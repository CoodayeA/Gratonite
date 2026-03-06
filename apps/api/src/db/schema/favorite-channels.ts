import { pgTable, uuid, integer, primaryKey } from 'drizzle-orm/pg-core';
import { users } from './users';
import { channels } from './channels';

/**
 * favorite_channels — User-favorited channels for quick access.
 */
export const favoriteChannels = pgTable('favorite_channels', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  channelId: uuid('channel_id').notNull().references(() => channels.id, { onDelete: 'cascade' }),
  position: integer('position').notNull().default(0),
}, (table) => [
  primaryKey({ columns: [table.userId, table.channelId] }),
]);

export type FavoriteChannel = typeof favoriteChannels.$inferSelect;
export type NewFavoriteChannel = typeof favoriteChannels.$inferInsert;
