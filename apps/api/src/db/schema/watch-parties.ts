import { pgTable, uuid, text, integer, timestamp, boolean, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { channels } from './channels';

export const watchParties = pgTable('watch_parties', {
  id: uuid('id').primaryKey().defaultRandom(),
  channelId: uuid('channel_id').notNull().references(() => channels.id, { onDelete: 'cascade' }),
  hostId: uuid('host_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  videoUrl: text('video_url').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  currentTime: integer('current_time').notNull().default(0),
  isPlaying: boolean('is_playing').notNull().default(false),
  playbackRate: integer('playback_rate').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
}, (table) => [
  index('idx_watch_parties_channel_active').on(table.channelId, table.isActive),
]);

export const watchPartyMembers = pgTable('watch_party_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  partyId: uuid('party_id').notNull().references(() => watchParties.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_watch_party_members_party').on(table.partyId),
]);

export type WatchParty = typeof watchParties.$inferSelect;
export type NewWatchParty = typeof watchParties.$inferInsert;
export type WatchPartyMember = typeof watchPartyMembers.$inferSelect;
export type NewWatchPartyMember = typeof watchPartyMembers.$inferInsert;
