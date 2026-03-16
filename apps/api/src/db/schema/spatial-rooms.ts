import { pgTable, uuid, varchar, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { channels } from './channels';

export const spatialRooms = pgTable('spatial_rooms', {
  id: uuid('id').primaryKey().defaultRandom(),
  channelId: uuid('channel_id')
    .notNull()
    .unique()
    .references(() => channels.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  width: integer('width').notNull().default(800),
  height: integer('height').notNull().default(600),
  backgroundUrl: text('background_url'),
  gridEnabled: boolean('grid_enabled').notNull().default(true),
  maxParticipants: integer('max_participants').notNull().default(25),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type SpatialRoom = typeof spatialRooms.$inferSelect;
export type NewSpatialRoom = typeof spatialRooms.$inferInsert;
