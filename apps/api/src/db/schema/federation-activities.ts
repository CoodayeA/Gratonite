/** federation-activities.ts — Drizzle ORM schema for inbound/outbound federation activity log. */

import { pgTable, uuid, varchar, text, jsonb, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { federatedInstances } from './federation-instances';

export const federationActivities = pgTable('federation_activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  direction: varchar('direction', { length: 10 }).notNull(),
  activityType: varchar('activity_type', { length: 100 }).notNull(),
  instanceId: uuid('instance_id').references(() => federatedInstances.id, { onDelete: 'set null' }),
  payload: jsonb('payload').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(5),
  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
  idempotencyKey: varchar('idempotency_key', { length: 255 }).notNull().unique(),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index().on(table.status, table.nextAttemptAt),
]);

export type FederationActivity = typeof federationActivities.$inferSelect;
export type NewFederationActivity = typeof federationActivities.$inferInsert;
