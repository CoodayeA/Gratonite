/** guild-replicas.ts — Drizzle ORM schema for guild replication state across federated instances. */

import { pgTable, uuid, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';
import { guilds } from './guilds';
import { federatedInstances } from './federation-instances';
import { remoteGuilds } from './remote-guilds';

export const guildReplicas = pgTable('guild_replicas', {
  id: uuid('id').primaryKey().defaultRandom(),
  guildId: uuid('guild_id').references(() => guilds.id, { onDelete: 'cascade' }),
  remoteGuildId: uuid('remote_guild_id').references(() => remoteGuilds.id, { onDelete: 'cascade' }),
  instanceId: uuid('instance_id').notNull().references(() => federatedInstances.id, { onDelete: 'cascade' }),
  role: varchar('role', { length: 20 }).notNull(),
  syncState: varchar('sync_state', { length: 20 }).notNull().default('syncing'),
  syncCursor: varchar('sync_cursor', { length: 255 }),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type GuildReplica = typeof guildReplicas.$inferSelect;
export type NewGuildReplica = typeof guildReplicas.$inferInsert;
