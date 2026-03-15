/** relay-nodes.ts — Known relay nodes in the federation network. */

import { pgTable, uuid, varchar, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';

export const relayNodes = pgTable('relay_nodes', {
  id: uuid('id').primaryKey().defaultRandom(),
  domain: varchar('domain', { length: 255 }).notNull().unique(),
  websocketUrl: varchar('websocket_url', { length: 500 }).notNull(),
  publicKeyPem: text('public_key_pem'),
  reputationScore: integer('reputation_score').notNull().default(50),
  status: varchar('status', { length: 20 }).notNull().default('active'), // active, suspended, delisted
  connectedInstances: integer('connected_instances').notNull().default(0),
  uptimePercent: integer('uptime_percent').notNull().default(100),
  latencyMs: integer('latency_ms').notNull().default(500),
  meshPeers: integer('mesh_peers').notNull().default(0),
  turnSupported: boolean('turn_supported').notNull().default(false),
  softwareVersion: varchar('software_version', { length: 50 }),
  lastHealthCheck: timestamp('last_health_check', { withTimezone: true }),
  registeredAt: timestamp('registered_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type RelayNode = typeof relayNodes.$inferSelect;
export type NewRelayNode = typeof relayNodes.$inferInsert;
