/** relay-instance-keys.ts — Cached E2E public keys for relay envelope encryption. */

import { pgTable, uuid, varchar, text, timestamp, unique } from 'drizzle-orm/pg-core';

export const relayInstanceKeys = pgTable('relay_instance_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  instanceDomain: varchar('instance_domain', { length: 255 }).notNull().unique(),
  publicKeyPem: text('public_key_pem').notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
});

export type RelayInstanceKey = typeof relayInstanceKeys.$inferSelect;
