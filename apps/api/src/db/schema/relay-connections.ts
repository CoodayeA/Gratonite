/** relay-connections.ts — Active relay connections for this instance. */

import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';
import { relayNodes } from './relay-nodes';

export const relayConnections = pgTable('relay_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  relayNodeId: uuid('relay_node_id').notNull().references(() => relayNodes.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 20 }).notNull().default('connected'), // connected, disconnected, error
  connectedAt: timestamp('connected_at', { withTimezone: true }).notNull().defaultNow(),
  disconnectedAt: timestamp('disconnected_at', { withTimezone: true }),
  lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
});

export type RelayConnection = typeof relayConnections.$inferSelect;
