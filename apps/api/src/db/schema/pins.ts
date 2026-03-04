import { pgTable, uuid, timestamp, unique } from 'drizzle-orm/pg-core';
import { channels } from './channels';
import { messages } from './messages';
import { users } from './users';

/**
 * channel_pins — Pinned messages per channel.
 */
export const channelPins = pgTable('channel_pins', {
  id: uuid('id').defaultRandom().primaryKey(),
  channelId: uuid('channel_id').notNull().references(() => channels.id, { onDelete: 'cascade' }),
  messageId: uuid('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  pinnedBy: uuid('pinned_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  pinnedAt: timestamp('pinned_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('channel_pins_channel_message_unique').on(table.channelId, table.messageId),
]);

export type ChannelPin = typeof channelPins.$inferSelect;
export type NewChannelPin = typeof channelPins.$inferInsert;
