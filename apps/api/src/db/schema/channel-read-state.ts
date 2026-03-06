import { pgTable, uuid, integer, timestamp, unique } from 'drizzle-orm/pg-core';
import { channels } from './channels';
import { users } from './users';

export const channelReadState = pgTable('channel_read_state', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  channelId: uuid('channel_id').notNull().references(() => channels.id, { onDelete: 'cascade' }),
  lastReadMessageId: uuid('last_read_message_id'),
  lastReadAt: timestamp('last_read_at', { withTimezone: true }).notNull().defaultNow(),
  mentionCount: integer('mention_count').notNull().default(0),
}, (t) => [
  unique('channel_read_state_channel_user_key').on(t.channelId, t.userId),
]);

export type ChannelReadState = typeof channelReadState.$inferSelect;
