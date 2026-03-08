/** remote-guilds.ts — Drizzle ORM schema for guilds on remote federated instances. */

import { pgTable, uuid, varchar, text, integer, real, boolean, jsonb, timestamp, unique } from 'drizzle-orm/pg-core';
import { federatedInstances } from './federation-instances';

export const remoteGuilds = pgTable('remote_guilds', {
  id: uuid('id').primaryKey().defaultRandom(),
  instanceId: uuid('instance_id').notNull().references(() => federatedInstances.id, { onDelete: 'cascade' }),
  remoteGuildId: varchar('remote_guild_id', { length: 255 }).notNull(),
  federationAddress: varchar('federation_address', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  iconUrl: varchar('icon_url', { length: 500 }),
  bannerUrl: varchar('banner_url', { length: 500 }),
  memberCount: integer('member_count').notNull().default(0),
  onlineCount: integer('online_count').notNull().default(0),
  category: varchar('category', { length: 30 }),
  tags: jsonb('tags').notNull().default([]),
  isApproved: boolean('is_approved').notNull().default(false),
  averageRating: real('average_rating').notNull().default(0),
  totalRatings: integer('total_ratings').notNull().default(0),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique().on(table.instanceId, table.remoteGuildId),
]);

export type RemoteGuild = typeof remoteGuilds.$inferSelect;
export type NewRemoteGuild = typeof remoteGuilds.$inferInsert;
