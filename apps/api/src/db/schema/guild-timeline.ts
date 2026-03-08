import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { guilds } from './guilds';
import { users } from './users';

export const guildTimelineEvents = pgTable('guild_timeline_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  guildId: uuid('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
  eventType: text('event_type').notNull(),
  referenceId: text('reference_id'),
  title: text('title').notNull(),
  description: text('description'),
  iconUrl: text('icon_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
});

export type GuildTimelineEvent = typeof guildTimelineEvents.$inferSelect;
export type NewGuildTimelineEvent = typeof guildTimelineEvents.$inferInsert;
