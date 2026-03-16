import { pgTable, uuid, varchar, boolean, real, integer, timestamp, unique } from 'drizzle-orm/pg-core';
import { channels } from './channels';
import { users } from './users';

export const ambientRooms = pgTable('ambient_rooms', {
  id: uuid('id').defaultRandom().primaryKey(),
  channelId: uuid('channel_id').notNull().unique().references(() => channels.id, { onDelete: 'cascade' }),
  theme: varchar('theme', { length: 30 }).notNull().default('coffee_shop'),
  musicEnabled: boolean('music_enabled').notNull().default(false),
  musicVolume: real('music_volume').notNull().default(0.3),
  maxParticipants: integer('max_participants').notNull().default(50),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const ambientRoomParticipants = pgTable('ambient_room_participants', {
  id: uuid('id').defaultRandom().primaryKey(),
  roomId: uuid('room_id').notNull().references(() => ambientRooms.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  status: varchar('status', { length: 20 }).notNull().default('working'),
}, (table) => [
  unique().on(table.roomId, table.userId),
]);

export type AmbientRoom = typeof ambientRooms.$inferSelect;
export type NewAmbientRoom = typeof ambientRooms.$inferInsert;
export type AmbientRoomParticipant = typeof ambientRoomParticipants.$inferSelect;
export type NewAmbientRoomParticipant = typeof ambientRoomParticipants.$inferInsert;
