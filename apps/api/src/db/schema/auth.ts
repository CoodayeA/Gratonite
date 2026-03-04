/**
 * auth.ts — Drizzle ORM schemas for authentication-related tables.
 *
 * This file defines two tables:
 *
 *   1. `refresh_tokens`           — Long-lived JWT refresh token hashes.
 *   2. `email_verification_tokens` — Short-lived one-time tokens for verifying
 *                                    a user's email address.
 *
 * Security philosophy for token storage:
 *   We NEVER store raw tokens in the database. Both tables store a SHA-256
 *   hash of the token. The raw token is returned to the client exactly once
 *   (in the API response or email). This means that even if the database is
 *   fully compromised, an attacker cannot replay any token without also
 *   breaking SHA-256.
 *
 *   For refresh tokens this is especially important because they are long-lived
 *   (30 days) and stored in an httpOnly cookie.
 */

import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

// ---------------------------------------------------------------------------
// refresh_tokens
// ---------------------------------------------------------------------------

/**
 * Stores hashes of issued JWT refresh tokens.
 *
 * Flow:
 *   1. On login, a refresh token JWT is created by `signRefreshToken()`.
 *   2. The raw JWT is sent to the client as an httpOnly cookie.
 *   3. SHA-256(rawJwt) is stored in this table alongside userId and expiresAt.
 *   4. On `/auth/refresh`, the server:
 *        a. Reads the cookie.
 *        b. Verifies JWT signature.
 *        c. Computes SHA-256(cookie) and looks it up in this table.
 *        d. Checks expiresAt hasn't passed.
 *        e. Issues a new access token.
 *   5. On `/auth/logout`, the hash is deleted from this table and the cookie
 *      is cleared — effectively invalidating the session immediately.
 *
 * Why store hashes at all when the JWT is already self-verifying?
 *   JWT signature verification alone doesn't let you revoke a specific token
 *   before it expires. Storing hashes gives us per-session revocation
 *   (logout invalidates immediately) without needing a full Redis allow-list.
 *
 * Note: each user can have multiple rows here (one per active session /
 * device). Rows are cleaned up on logout; stale rows can be purged by a
 * background job comparing expiresAt.
 */
export const refreshTokens = pgTable('refresh_tokens', {
  /**
   * Surrogate primary key for the token record.
   */
  id: uuid('id').primaryKey().defaultRandom(),

  /**
   * The user this session belongs to.
   * Cascades on delete so all sessions are removed when the user account is
   * deleted — no orphan rows.
   */
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  /**
   * SHA-256 hash of the raw refresh token JWT (hex-encoded string).
   * The actual JWT is NEVER stored here — only its hash.
   * The unique constraint ensures that even if two tokens hash to the same
   * value (astronomically unlikely with SHA-256) there are no silent
   * collisions.
   */
  tokenHash: varchar('token_hash', { length: 255 }).notNull().unique(),

  /**
   * When this refresh token expires. Matches the `exp` claim of the JWT
   * (30 days from issuance). The application checks this in addition to JWT
   * signature verification as a defence-in-depth measure.
   */
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),

  /**
   * When the token record was created. Useful for auditing active sessions.
   */
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * TypeScript type for a fetched refresh token row.
 */
export type RefreshToken = typeof refreshTokens.$inferSelect;

/**
 * TypeScript type for inserting a new refresh token row.
 */
export type NewRefreshToken = typeof refreshTokens.$inferInsert;

// ---------------------------------------------------------------------------
// email_verification_tokens
// ---------------------------------------------------------------------------

/**
 * Stores hashes of one-time email verification tokens.
 *
 * Flow:
 *   1. On registration (or `/auth/verify-email/request`), a 32-byte random
 *      hex token is generated.
 *   2. The raw token is embedded in a link sent to the user's email:
 *        `${APP_URL}/app/verify?token=<rawToken>&email=<email>`
 *   3. SHA-256(rawToken) is stored in this table with the target email and
 *      a 24-hour expiry.
 *   4. On `/auth/verify-email/confirm`, the server:
 *        a. Receives `{ token, email }` from the client.
 *        b. Looks up the row by email.
 *        c. Computes SHA-256(token) and compares to the stored hash.
 *        d. Checks expiresAt hasn't passed.
 *        e. Sets user.emailVerified = true and deletes this row.
 *
 * Why store the email in this table separately from userId?
 *   It makes the confirm endpoint stateless from the client's perspective —
 *   the client sends the email it received the link at, which the server can
 *   use to look up the record without exposing userId in the verification URL.
 */
export const emailVerificationTokens = pgTable('email_verification_tokens', {
  /**
   * Surrogate primary key for the token record.
   */
  id: uuid('id').primaryKey().defaultRandom(),

  /**
   * The user whose email is being verified.
   * Cascades on delete so orphan verification records are never left behind
   * if the account is deleted before verification completes.
   */
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  /**
   * SHA-256 hash of the raw verification token sent to the user's email.
   * The raw token is NEVER stored here.
   * Unique so that a compromised DB row cannot be used to forge a token.
   */
  token: varchar('token', { length: 255 }).notNull().unique(),

  /**
   * The email address being verified. Stored here (not just on the user row)
   * because in a future "change email" flow the email being confirmed may
   * differ from the user's current email.
   */
  email: varchar('email', { length: 255 }).notNull(),

  /**
   * Expiry time — 24 hours from creation. After this the token is invalid
   * and the user must request a new one.
   */
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),

  /**
   * When the token was created.
   */
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * TypeScript type for a fetched email verification token row.
 */
export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;

/**
 * TypeScript type for inserting a new email verification token row.
 */
export type NewEmailVerificationToken = typeof emailVerificationTokens.$inferInsert;
