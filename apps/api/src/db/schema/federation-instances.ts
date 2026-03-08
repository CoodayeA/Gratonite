/** federation-instances.ts — Drizzle ORM schema for federated instance registry. */

import { pgTable, uuid, varchar, text, boolean, integer, timestamp } from 'drizzle-orm/pg-core';

export const federatedInstances = pgTable('federated_instances', {
  id: uuid('id').primaryKey().defaultRandom(),
  baseUrl: varchar('base_url', { length: 500 }).notNull().unique(),
  publicKeyPem: text('public_key_pem'),
  publicKeyId: varchar('public_key_id', { length: 500 }),
  trustLevel: varchar('trust_level', { length: 30 }).notNull().default('auto_discovered'),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  softwareVersion: varchar('software_version', { length: 50 }),
  softwareChecksum: varchar('software_checksum', { length: 100 }),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  failedHeartbeats: integer('failed_heartbeats').notNull().default(0),
  inDiscover: boolean('in_discover').notNull().default(false),
  trustScore: integer('trust_score').notNull().default(50),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type FederatedInstance = typeof federatedInstances.$inferSelect;
export type NewFederatedInstance = typeof federatedInstances.$inferInsert;
