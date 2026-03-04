/**
 * relationships.ts — Drizzle ORM schema for the `relationships` table.
 *
 * Stores all social graph edges between users: friend connections, pending
 * friend requests, and user blocks. A single table with a `type` discriminator
 * covers all three concepts.
 *
 * Why one table for friends, pending requests, AND blocks?
 *
 *   These three concepts are closely related and share the same core data
 *   shape: a directed edge from one user (requester) to another (addressee)
 *   with a label. Using a single table means:
 *
 *     1. A single "does a relationship exist between A and B?" query covers all
 *        cases, which is needed frequently (e.g., "can A send a DM to B?",
 *        "has B blocked A?").
 *
 *     2. State transitions (pending → accepted, accepted → blocked) are simple
 *        UPDATE operations on the `type` column rather than deletes + inserts
 *        across multiple tables.
 *
 *     3. The unique constraint on (requester_id, addressee_id) enforces that
 *        only one relationship edge can exist in each direction at a time,
 *        which mirrors the real-world constraint.
 *
 * Relationship type semantics:
 *
 *   FRIEND           — Both users have accepted the friend request. There will
 *                      be two rows for a mutual friendship:
 *                        (A→B, FRIEND) and (B→A, FRIEND).
 *                      The application creates both atomically on accept.
 *
 *   PENDING_OUTGOING — A sent a request to B; B has not yet responded.
 *                      Stored as a single row: (requester=A, addressee=B, PENDING_OUTGOING).
 *                      B's view of the same request is stored as a matching row:
 *                        (requester=B, addressee=A, PENDING_INCOMING).
 *                      Both rows are created together so that both parties can
 *                      query their own perspective with simple WHERE clauses.
 *
 *   PENDING_INCOMING — Counterpart to PENDING_OUTGOING (see above).
 *
 *   BLOCKED          — requester has blocked addressee. Only one row exists per
 *                      block direction. The blocker can see the row; the blocked
 *                      user cannot (it is invisible to them by design).
 *
 * The unique constraint on (requester_id, addressee_id) means each ordered
 * pair of users can have at most one relationship record, which reflects the
 * real-world constraint that you can't simultaneously be friends with someone
 * and have them blocked (from your perspective).
 */

import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { users } from './users';

// ---------------------------------------------------------------------------
// relationships
// ---------------------------------------------------------------------------

/**
 * The `relationships` table.
 *
 * A directed edge between two users representing one of: a friendship, a
 * pending friend request (in either direction), or a block. See the file-level
 * comment for full semantics.
 */
export const relationships = pgTable(
  'relationships',
  {
    /**
     * Surrogate primary key for the relationship record.
     */
    id: uuid('id').primaryKey().defaultRandom(),

    /**
     * The user who initiated this relationship edge (sent the request,
     * accepted the friendship, or performed the block).
     * Cascades on delete — removing a user cleans up all their relationship
     * records in both directions.
     */
    requesterId: uuid('requester_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /**
     * The user on the receiving end of this relationship edge.
     * Cascades on delete for the same reason as requesterId.
     */
    addresseeId: uuid('addressee_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /**
     * The kind of relationship this edge represents.
     *
     * Valid values:
     *   FRIEND           — Accepted mutual friendship (requester's perspective).
     *   PENDING_OUTGOING — requester sent a request that addressee hasn't answered.
     *   PENDING_INCOMING — requester received a request from addressee (mirror row).
     *   BLOCKED          — requester has blocked addressee.
     *
     * See the file-level comment for details on how these types work together.
     */
    type: varchar('type', { length: 20 }).notNull(),

    /**
     * When this relationship record was created (request sent, block placed,
     * or friendship accepted, depending on type).
     */
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /**
     * Enforce that each ordered (requester, addressee) pair has at most one
     * relationship record. This prevents duplicate or conflicting states
     * (e.g., can't be both FRIEND and BLOCKED toward the same person).
     */
    unique('relationships_requester_id_addressee_id_key').on(
      table.requesterId,
      table.addresseeId,
    ),
  ],
);

/**
 * TypeScript type for a fetched relationship row.
 */
export type Relationship = typeof relationships.$inferSelect;

/**
 * TypeScript type for inserting a new relationship row.
 */
export type NewRelationship = typeof relationships.$inferInsert;
