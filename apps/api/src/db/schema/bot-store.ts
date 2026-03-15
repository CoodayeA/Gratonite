/**
 * bot-store.ts — Drizzle ORM schemas for bot_listings, bot_reviews, and bot_installs tables.
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  numeric,
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { guilds } from './guilds';

// ---------------------------------------------------------------------------
// bot_listings
// ---------------------------------------------------------------------------

export const botListings = pgTable('bot_listings', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 128 }).notNull(),
  description: text('description'),
  shortDescription: varchar('short_description', { length: 256 }),
  iconUrl: varchar('icon_url', { length: 512 }),
  bannerUrl: varchar('banner_url', { length: 512 }),
  category: varchar('category', { length: 64 }).notNull().default('general'),
  tags: jsonb('tags').notNull().default([]),
  creatorId: uuid('creator_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  applicationId: uuid('application_id'),
  verified: boolean('verified').notNull().default(false),
  listed: boolean('listed').notNull().default(true),
  installCount: integer('install_count').notNull().default(0),
  rating: numeric('rating', { precision: 3, scale: 2 }).notNull().default('0'),
  reviewCount: integer('review_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type BotListing = typeof botListings.$inferSelect;
export type NewBotListing = typeof botListings.$inferInsert;

// ---------------------------------------------------------------------------
// bot_reviews
// ---------------------------------------------------------------------------

export const botReviews = pgTable(
  'bot_reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listingId: uuid('listing_id').notNull().references(() => botListings.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    rating: integer('rating').notNull(),
    content: text('content').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('bot_reviews_listing_user_key').on(table.listingId, table.userId),
  ],
);

export type BotReview = typeof botReviews.$inferSelect;
export type NewBotReview = typeof botReviews.$inferInsert;

// ---------------------------------------------------------------------------
// bot_installs
// ---------------------------------------------------------------------------

export const botInstalls = pgTable(
  'bot_installs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    botId: uuid('bot_id').notNull().references(() => botListings.id, { onDelete: 'cascade' }),
    guildId: uuid('guild_id').notNull().references(() => guilds.id, { onDelete: 'cascade' }),
    applicationId: uuid('application_id'),
    installedBy: uuid('installed_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('bot_installs_guild_bot_key').on(table.guildId, table.botId),
    index('bot_installs_guild_id_idx').on(table.guildId),
  ],
);

export type BotInstall = typeof botInstalls.$inferSelect;
export type NewBotInstall = typeof botInstalls.$inferInsert;
