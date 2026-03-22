/**
 * instance-reports.ts — Schema for user-submitted abuse reports against
 * federated instances.
 *
 * Reports are reviewed in the admin panel. 3+ reports from unique users
 * against the same instance triggers an auto-suspension pending review.
 *
 * Security: One report per user per instance (enforced via unique constraint).
 * This prevents a single user from spamming reports to trigger auto-suspend.
 */

import { pgTable, uuid, text, varchar, timestamp, unique } from 'drizzle-orm/pg-core';
import { federatedInstances } from './federation-instances';
import { users } from './users';

export const instanceReports = pgTable('instance_reports', {
  id: uuid('id').primaryKey().defaultRandom(),

  /** The instance being reported. */
  instanceId: uuid('instance_id').notNull().references(() => federatedInstances.id, { onDelete: 'cascade' }),

  /** The user who filed the report. */
  reporterId: uuid('reporter_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  /** Reason category. */
  reason: varchar('reason', { length: 30 }).notNull(),

  /** Free-text details about the report. */
  details: text('details'),

  /** Review status. */
  status: varchar('status', { length: 20 }).notNull().default('pending'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // One report per user per instance — prevents spam-triggering auto-suspend
  unique().on(table.instanceId, table.reporterId),
]);

export type InstanceReport = typeof instanceReports.$inferSelect;
export type NewInstanceReport = typeof instanceReports.$inferInsert;
