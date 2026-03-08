import { pgTable, uuid, text, timestamp, boolean } from 'drizzle-orm/pg-core';
import { users } from './users';
import { messages } from './messages';
import { channels } from './channels';
import { guilds } from './guilds';

export const messageReminders = pgTable('message_reminders', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  messageId: uuid('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  channelId: uuid('channel_id').notNull().references(() => channels.id, { onDelete: 'cascade' }),
  guildId: uuid('guild_id').references(() => guilds.id, { onDelete: 'cascade' }),
  remindAt: timestamp('remind_at', { withTimezone: true }).notNull(),
  note: text('note'),
  fired: boolean('fired').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type MessageReminder = typeof messageReminders.$inferSelect;
export type NewMessageReminder = typeof messageReminders.$inferInsert;
