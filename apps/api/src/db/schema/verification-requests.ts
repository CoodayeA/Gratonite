/**
 * verification-requests.ts — Schema for instance verification applications.
 *
 * When a federated instance reaches trust tier 1 (Trusted), its owner can
 * submit a verification request. The Gratonite team reviews these manually
 * before promoting the instance to tier 2 (Verified).
 *
 * Security: Only one pending request per instance is allowed (enforced in
 * application logic). Rejected instances can resubmit after 7 days.
 */

import { pgTable, uuid, text, varchar, timestamp } from 'drizzle-orm/pg-core';
import { federatedInstances } from './federation-instances';
import { users } from './users';

export const verificationRequests = pgTable('verification_requests', {
  id: uuid('id').primaryKey().defaultRandom(),

  /** The instance applying for verification. */
  instanceId: uuid('instance_id').notNull().references(() => federatedInstances.id, { onDelete: 'cascade' }),

  /** Contact email for the instance admin. */
  contactEmail: varchar('contact_email', { length: 255 }).notNull(),

  /** Community description — why this instance should be verified. */
  description: text('description').notNull(),

  /** Review status. Only one 'pending' request per instance allowed. */
  status: varchar('status', { length: 20 }).notNull().default('pending'),

  /** Admin who reviewed the request (null if still pending). */
  reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),

  /** When the review was completed. */
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),

  /** Admin notes explaining the decision (visible to instance owner). */
  reviewNotes: text('review_notes'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type VerificationRequest = typeof verificationRequests.$inferSelect;
export type NewVerificationRequest = typeof verificationRequests.$inferInsert;
