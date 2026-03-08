/** instance-blocks.ts — Drizzle ORM schema for domain/instance-level blocks. */

import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';
import { federatedInstances } from './federation-instances';

export const instanceBlocks = pgTable('instance_blocks', {
  id: uuid('id').primaryKey().defaultRandom(),
  instanceId: uuid('instance_id').references(() => federatedInstances.id, { onDelete: 'cascade' }),
  blockedDomain: text('blocked_domain').notNull(),
  blockedBy: uuid('blocked_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  reason: text('reason'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type InstanceBlock = typeof instanceBlocks.$inferSelect;
export type NewInstanceBlock = typeof instanceBlocks.$inferInsert;
