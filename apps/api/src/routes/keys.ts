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
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';

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

    const [row] = await db
      .select({ publicKeyJwk: userPublicKeys.publicKeyJwk })
      .from(userPublicKeys)
      .where(eq(userPublicKeys.userId, userId))
      .limit(1);

    res.status(200).json({ publicKeyJwk: row?.publicKeyJwk ?? null });
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

    await db
      .insert(userPublicKeys)
      .values({ userId, publicKeyJwk, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: userPublicKeys.userId,
        set: { publicKeyJwk, updatedAt: now },
      });

    res.status(200).json({ success: true });
  }),
);
