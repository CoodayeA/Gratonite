/**
 * schema/rss-feeds.ts — Drizzle ORM schema for the `rss_feeds` table.
 *
 * Stores RSS/Atom feed subscriptions linked to guild channels. A background
 * poller job fetches new items and posts them as messages in the target channel.
 */

import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { guilds } from './guilds';
import { channels } from './channels';
import { users } from './users';

export const rssFeeds = pgTable(
  'rss_feeds',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /** Guild this feed belongs to. */
    guildId: uuid('guild_id')
      .notNull()
      .references(() => guilds.id, { onDelete: 'cascade' }),

    /** Channel where new feed items will be posted. */
    channelId: uuid('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),

    /** The RSS/Atom feed URL. */
    feedUrl: text('feed_url').notNull(),

    /** Optional human-readable title for the feed. */
    title: varchar('title', { length: 200 }),

    /** How often (in minutes) to poll this feed. Default 30. */
    pollIntervalMinutes: integer('poll_interval_minutes').notNull().default(30),

    /** When we last successfully fetched this feed. */
    lastFetchedAt: timestamp('last_fetched_at', { withTimezone: true }),

    /** GUID or link of the last posted item (to track what we have already posted). */
    lastItemGuid: text('last_item_guid'),

    /** Optional regex to filter items by title or description. */
    contentFilter: text('content_filter'),

    /** Whether this feed is actively being polled. */
    enabled: boolean('enabled').notNull().default(true),

    /** User who created this feed subscription. */
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'set null' }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('rss_feeds_channel_id_idx').on(table.channelId),
    index('rss_feeds_guild_id_idx').on(table.guildId),
  ],
);

export type RssFeed = typeof rssFeeds.$inferSelect;
export type NewRssFeed = typeof rssFeeds.$inferInsert;
