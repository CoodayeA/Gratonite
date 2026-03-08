import { pgTable, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { channels } from './channels';

export const musicRoomSettings = pgTable('music_room_settings', {
  channelId: uuid('channel_id').primaryKey().references(() => channels.id, { onDelete: 'cascade' }),
  mode: text('mode').notNull().default('freeQueue'),
  currentDjId: uuid('current_dj_id').references(() => users.id, { onDelete: 'set null' }),
  volume: integer('volume').notNull().default(80),
});

export const musicQueue = pgTable('music_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  channelId: uuid('channel_id').notNull().references(() => channels.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  title: text('title').notNull(),
  thumbnail: text('thumbnail'),
  duration: integer('duration').notNull().default(0),
  addedBy: uuid('added_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  position: integer('position').notNull().default(0),
  playedAt: timestamp('played_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_music_queue_channel').on(table.channelId, table.position),
]);

export type MusicRoomSettings = typeof musicRoomSettings.$inferSelect;
export type NewMusicRoomSettings = typeof musicRoomSettings.$inferInsert;
export type MusicQueueItem = typeof musicQueue.$inferSelect;
export type NewMusicQueueItem = typeof musicQueue.$inferInsert;
