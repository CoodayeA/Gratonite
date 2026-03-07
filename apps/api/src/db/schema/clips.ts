import { pgTable, uuid, varchar, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { guilds } from './guilds';
import { channels } from './channels';
import { files } from './files';

export const clips = pgTable('clips', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  guildId: uuid('guild_id').notNull().references(() => guilds.id),
  channelId: uuid('channel_id').references(() => channels.id),
  title: varchar('title', { length: 200 }).notNull(),
  fileId: uuid('file_id').references(() => files.id),
  duration: integer('duration'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_clips_guild').on(table.guildId),
  index('idx_clips_user').on(table.userId),
]);

export type Clip = typeof clips.$inferSelect;
export type NewClip = typeof clips.$inferInsert;
