/** federation-key-pairs.ts — Drizzle ORM schema for local federation signing keys. */

import { pgTable, uuid, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core';

export const federationKeyPairs = pgTable('federation_key_pairs', {
  id: uuid('id').primaryKey().defaultRandom(),
  keyId: varchar('key_id', { length: 500 }).notNull().unique(),
  publicKeyPem: text('public_key_pem').notNull(),
  privateKeyPem: text('private_key_pem').notNull(),
  algorithm: varchar('algorithm', { length: 30 }).notNull().default('ed25519'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type FederationKeyPair = typeof federationKeyPairs.$inferSelect;
export type NewFederationKeyPair = typeof federationKeyPairs.$inferInsert;
