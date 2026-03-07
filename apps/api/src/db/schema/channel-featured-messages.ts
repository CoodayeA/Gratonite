import { pgTable, uuid, text, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { users } from './users';
import { channels } from './channels';
import { messages } from './messages';

export const channelFeaturedMessages = pgTable('channel_featured_messages', {
  channelId: uuid('channel_id').notNull().references(() => channels.id, { onDelete: 'cascade' }),
  messageId: uuid('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  featuredBy: uuid('featured_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.channelId, table.messageId] }),
}));

export type ChannelFeaturedMessage = typeof channelFeaturedMessages.$inferSelect;
