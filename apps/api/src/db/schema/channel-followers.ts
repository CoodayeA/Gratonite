import { pgTable, uuid, primaryKey } from 'drizzle-orm/pg-core';
import { channels } from './channels';

/**
 * channel_followers — Tracks which channels follow announcement channels.
 */
export const channelFollowers = pgTable('channel_followers', {
  sourceChannelId: uuid('source_channel_id').notNull().references(() => channels.id, { onDelete: 'cascade' }),
  targetChannelId: uuid('target_channel_id').notNull().references(() => channels.id, { onDelete: 'cascade' }),
}, (table) => [
  primaryKey({ columns: [table.sourceChannelId, table.targetChannelId] }),
]);

export type ChannelFollower = typeof channelFollowers.$inferSelect;
export type NewChannelFollower = typeof channelFollowers.$inferInsert;
