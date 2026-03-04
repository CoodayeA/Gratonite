/**
 * bot-applications.ts — Drizzle ORM schema for the bot_applications table.
 *
 * Webhook bots are user self-hosted. Gratonite sends signed events to their
 * webhookUrl. The webhookSecret is stored as a bcrypt hash; it is shown to
 * the developer only once on creation. The apiToken is a JWT the bot uses to
 * call the Gratonite API (limited permission set).
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { botListings } from './bot-store';

// ---------------------------------------------------------------------------
// bot_applications
// ---------------------------------------------------------------------------

export const botApplications = pgTable('bot_applications', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 64 }).notNull(),
  description: text('description'),
  avatarHash: varchar('avatar_hash', { length: 255 }),
  webhookUrl: varchar('webhook_url', { length: 512 }).notNull(),
  // Stored as bcrypt hash — never returned in API responses.
  webhookSecretHash: varchar('webhook_secret_hash', { length: 255 }).notNull(),
  // Raw HMAC key stored encrypted. Used for signing outbound events.
  webhookSecretKey: varchar('webhook_secret_key', { length: 255 }).notNull(),
  // JWT for the bot to call the Gratonite API (limited scope).
  apiToken: varchar('api_token', { length: 512 }).notNull(),
  listingId: uuid('listing_id').references(() => botListings.id, { onDelete: 'set null' }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type BotApplication = typeof botApplications.$inferSelect;
export type NewBotApplication = typeof botApplications.$inferInsert;
