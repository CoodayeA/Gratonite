/**
 * routes/keys.ts — API routes for E2E encryption public key management.
 *
 * Mounted at /api/v1/users by src/routes/index.ts.
 *
 * Endpoints:
 *   GET  /users/:userId/public-key  — Retrieve another user's public key
 *   POST /users/@me/public-key      — Upsert the authenticated user's public key
 *
 * All routes require authentication via the `requireAuth` middleware.
 *
 * @module routes/keys
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';

import { db } from '../db/index';
import { userPublicKeys } from '../db/schema/encryption';
import { dmChannelMembers } from '../db/schema/channels';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { getIO } from '../lib/socket-io';
import { logger } from '../lib/logger';

export const keysRouter = Router();

/**
 * asyncHandler — Wraps an async route handler so that rejected promises are
 * forwarded to Express's error middleware via next(err).
 */
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// ---------------------------------------------------------------------------
// Zod validation schema
// ---------------------------------------------------------------------------

const upsertPublicKeySchema = z.object({
  publicKeyJwk: z.string().min(1),
});

// ---------------------------------------------------------------------------
// GET /:userId/public-key — Fetch a user's public key
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/users/:userId/public-key
 *
 * Returns the target user's ECDH public key (JWK string) if one has been
 * uploaded, or null if the user has not set up E2E encryption yet.
 *
 * @auth    requireAuth
 * @param   userId {string} — UUID of the user whose public key to fetch
 * @returns 200 { publicKeyJwk: string } | { publicKeyJwk: null }
 */
keysRouter.get(
  '/:userId/public-key',
  requireAuth,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params as Record<string, string>;
    const wantPrev = req.query.version === 'prev';

    const [row] = await db
      .select({
        publicKeyJwk: userPublicKeys.publicKeyJwk,
        keyVersion: userPublicKeys.keyVersion,
        previousKeyJwk: userPublicKeys.previousKeyJwk,
      })
      .from(userPublicKeys)
      .where(eq(userPublicKeys.userId, userId))
      .limit(1);

    if (!row) {
      res.status(200).json({ publicKeyJwk: null, keyVersion: null });
      return;
    }

    if (wantPrev) {
      res.status(200).json({
        publicKeyJwk: row.previousKeyJwk ?? null,
        keyVersion: row.keyVersion != null ? row.keyVersion - 1 : null,
      });
      return;
    }

    res.status(200).json({ publicKeyJwk: row.publicKeyJwk, keyVersion: row.keyVersion });
  }),
);

// ---------------------------------------------------------------------------
// POST /@me/public-key — Upsert the authenticated user's public key
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/users/@me/public-key
 *
 * Upload or rotate the authenticated user's ECDH P-256 public key. If a key
 * already exists it is replaced (upsert on userId primary key). The server
 * stores the JWK as-is and never inspects or validates its cryptographic
 * content — that is the client's responsibility.
 *
 * @auth    requireAuth
 * @body    { publicKeyJwk: string } — JSON Web Key string
 * @returns 200 { success: true }
 * @returns 400 Validation failure
 */
keysRouter.post(
  '/@me/public-key',
  requireAuth,
  validate(upsertPublicKeySchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { publicKeyJwk } = req.body as z.infer<typeof upsertPublicKeySchema>;
    const userId = req.userId!;
    const now = new Date();

    // Check if user already had a key (to detect key rotation vs first upload)
    const [existing] = await db
      .select({
        userId: userPublicKeys.userId,
        publicKeyJwk: userPublicKeys.publicKeyJwk,
        keyVersion: userPublicKeys.keyVersion,
      })
      .from(userPublicKeys)
      .where(eq(userPublicKeys.userId, userId))
      .limit(1);

    const newKeyVersion = existing ? (existing.keyVersion ?? 1) + 1 : 1;

    await db
      .insert(userPublicKeys)
      .values({
        userId,
        publicKeyJwk,
        createdAt: now,
        updatedAt: now,
        keyVersion: newKeyVersion,
        previousKeyJwk: null,
      })
      .onConflictDoUpdate({
        target: userPublicKeys.userId,
        set: {
          publicKeyJwk,
          updatedAt: now,
          keyVersion: newKeyVersion,
          // Preserve the outgoing key so DM partners can re-derive old shared keys.
          previousKeyJwk: existing?.publicKeyJwk ?? null,
        },
      });

    // If this was a key rotation (not first upload), notify all DM partners
    if (existing) {
      try {
        const dmPartners = await db
          .select({ channelId: dmChannelMembers.channelId })
          .from(dmChannelMembers)
          .where(eq(dmChannelMembers.userId, userId));

        const io = getIO();
        for (const { channelId } of dmPartners) {
          io.to(`channel:${channelId}`).emit('USER_KEY_CHANGED', { userId });
        }
      } catch (err) {
        logger.debug({ msg: 'socket emit failed', event: 'USER_KEY_CHANGED', err });
      }
    }

    res.status(200).json({ success: true, keyVersion: newKeyVersion });
  }),
);
