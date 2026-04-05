/**
 * encryption.ts — Drizzle ORM schema for E2E encryption key storage.
 *
 * Stores each user's public ECDH key (as JWK JSON string) so that DM
 * participants can derive a shared AES-GCM key client-side and encrypt
 * messages end-to-end. Private keys never leave the client.
 */

import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

// ---------------------------------------------------------------------------
// user_public_keys
// ---------------------------------------------------------------------------

/**
 * The `user_public_keys` table.
 *
 * One row per user. Stores the user's current ECDH P-256 public key as a
 * JSON Web Key (JWK) string. Upserted by the client whenever a new key pair
 * is generated (e.g. first login on a new device).
 */
export const userPublicKeys = pgTable('user_public_keys', {
  /**
   * The user this key belongs to. Primary key — one key per user.
   * Cascades on user deletion so orphan key rows are never left behind.
   */
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),

  /**
   * The user's ECDH P-256 public key serialised as a JWK JSON string.
   * Stored as text so the API can return it directly without parsing.
   */
  publicKeyJwk: text('public_key_jwk').notNull(),

  /**
   * Monotonically-increasing version number. Starts at 1 and increments
   * on every key rotation. Stamped on outgoing DM messages so the recipient
   * can look up the exact historical key if decryption fails with the current
   * shared key.
   */
  keyVersion: integer('key_version').notNull().default(1),

  /**
   * The previous public key JWK (the one replaced by the most recent rotation).
   * Kept for one generation so the other party can re-derive the old shared key
   * and decrypt messages that were sent before the rotation was observed.
   * NULL on first upload or if only one generation has ever existed.
   */
  previousKeyJwk: text('previous_key_jwk'),

  /** Row creation timestamp. */
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),

  /** Timestamp of the last key rotation (upsert). */
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type UserPublicKey = typeof userPublicKeys.$inferSelect;
export type NewUserPublicKey = typeof userPublicKeys.$inferInsert;
