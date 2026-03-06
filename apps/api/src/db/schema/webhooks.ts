import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';
import { channels } from './channels';
import { guilds } from './guilds';
import { users } from './users';

export const webhooks = pgTable('webhooks', {
  id: uuid('id').primaryKey().defaultRandom(),
  channelId: uuid('channel_id').notNull().references(() => channels.id, { onDelete: 'cascade' }),
  guildId: uuid('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  creatorId: uuid('creator_id').references(() => users.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 80 }).notNull(),
  avatarUrl: text('avatar_url'),
  token: uuid('token').notNull().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Webhook = typeof webhooks.$inferSelect;
export type NewWebhook = typeof webhooks.$inferInsert;
