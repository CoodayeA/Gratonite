import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { channels } from './channels';

export const voiceMessages = pgTable('voice_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  channelId: uuid('channel_id').notNull().references(() => channels.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  channelCreatedIdx: index('voice_messages_channel_created_idx').on(table.channelId, table.createdAt),
}));

export type VoiceMessage = typeof voiceMessages.$inferSelect;
export type NewVoiceMessage = typeof voiceMessages.$inferInsert;
