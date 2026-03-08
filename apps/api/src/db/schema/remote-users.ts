/** remote-users.ts — Drizzle ORM schema for users on remote federated instances. */

import { pgTable, uuid, varchar, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { federatedInstances } from './federation-instances';

export const remoteUsers = pgTable('remote_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  instanceId: uuid('instance_id').notNull().references(() => federatedInstances.id, { onDelete: 'cascade' }),
  remoteUserId: varchar('remote_user_id', { length: 255 }).notNull(),
  federationAddress: varchar('federation_address', { length: 255 }).notNull().unique(),
  username: varchar('username', { length: 32 }).notNull(),
  displayName: varchar('display_name', { length: 64 }),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  publicKeyPem: text('public_key_pem'),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique().on(table.instanceId, table.remoteUserId),
]);

export type RemoteUser = typeof remoteUsers.$inferSelect;
export type NewRemoteUser = typeof remoteUsers.$inferInsert;
