import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { guilds } from './guilds';

export const photoAlbums = pgTable('photo_albums', {
  id: uuid('id').primaryKey().defaultRandom(),
  guildId: uuid('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  coverUrl: text('cover_url'),
  createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_photo_albums_guild').on(table.guildId),
]);

export const photoAlbumItems = pgTable('photo_album_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  albumId: uuid('album_id').notNull().references(() => photoAlbums.id, { onDelete: 'cascade' }),
  fileUrl: text('file_url').notNull(),
  caption: text('caption'),
  addedBy: uuid('added_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  messageId: uuid('message_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_photo_album_items_album').on(table.albumId),
]);

export type PhotoAlbum = typeof photoAlbums.$inferSelect;
export type NewPhotoAlbum = typeof photoAlbums.$inferInsert;
export type PhotoAlbumItem = typeof photoAlbumItems.$inferSelect;
export type NewPhotoAlbumItem = typeof photoAlbumItems.$inferInsert;
