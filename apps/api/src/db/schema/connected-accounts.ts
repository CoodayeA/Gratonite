/**
 * connected-accounts.ts — Drizzle ORM schema for the `connected_accounts` table.
 *
 * Stores third-party platform connections linked to a user account
 * (e.g. GitHub, Twitch, Steam, Twitter, YouTube).
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { users } from './users';

// ---------------------------------------------------------------------------
// connected_accounts
// ---------------------------------------------------------------------------

export const connectedAccounts = pgTable(
  'connected_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Platform identifier, e.g. 'github', 'twitch', 'steam', 'twitter', 'youtube' */
    provider: varchar('provider', { length: 30 }).notNull(),

    /** The user's username or display name on that platform */
    providerUsername: varchar('provider_username', { length: 100 }).notNull(),

    /** Optional deep-link URL to the user's profile on the provider */
    profileUrl: text('profile_url'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('connected_accounts_user_provider_key').on(table.userId, table.provider),
  ],
);

export type ConnectedAccount = typeof connectedAccounts.$inferSelect;
export type NewConnectedAccount = typeof connectedAccounts.$inferInsert;
