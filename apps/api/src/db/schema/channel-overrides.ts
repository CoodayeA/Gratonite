import { pgTable, uuid, varchar, bigint, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { channels } from './channels';

/**
 * channel_permission_overrides — Per-channel permission overrides for roles/members.
 */
export const channelPermissionOverrides = pgTable('channel_permission_overrides', {
  id: uuid('id').defaultRandom().primaryKey(),
  channelId: uuid('channel_id').notNull().references(() => channels.id, { onDelete: 'cascade' }),
  targetId: uuid('target_id').notNull(),
  targetType: varchar('target_type', { length: 10 }).notNull(), // 'role' | 'member'
  allow: bigint('allow', { mode: 'bigint' }).notNull().default(sql`0`),
  deny: bigint('deny', { mode: 'bigint' }).notNull().default(sql`0`),
}, (table) => [
  unique('channel_overrides_channel_target_unique').on(table.channelId, table.targetId),
]);

export type ChannelPermissionOverride = typeof channelPermissionOverrides.$inferSelect;
export type NewChannelPermissionOverride = typeof channelPermissionOverrides.$inferInsert;
