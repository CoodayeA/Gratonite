/**
 * routes/group-keys.ts — API routes for GROUP_DM E2E group key management.
 *
 * Mounted at /api/v1/channels by src/routes/index.ts.
 *
 * Endpoints:
 *   GET  /channels/:channelId/group-key  — Fetch the latest group key version
 *                                          for the calling user
 *   POST /channels/:channelId/group-key  — Store a new group key version
 *
 * All routes require authentication via the `requireAuth` middleware.
 *
 * @module routes/group-keys
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';

import { db } from '../db/index';
import { groupEncryptionKeys } from '../db/schema/group-encryption';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';

export const groupKeysRouter = Router({ mergeParams: true });

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

const postGroupKeySchema = z.object({
  version: z.number().int(),
  keyData: z.record(z.string(), z.string()),
});

// ---------------------------------------------------------------------------
// GET /:channelId/group-key — Fetch the calling user's latest group key
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/channels/:channelId/group-key
 *
 * Returns the latest group key version that contains the calling user's
 * userId in keyData, along with the encrypted key blob for that user.
 *
 * @auth    requireAuth
 * @param   channelId {string} — UUID of the GROUP_DM channel
 * @returns 200 { version: number, encryptedKey: string } | { version: null, encryptedKey: null }
 */
groupKeysRouter.get(
  '/:channelId/group-key',
  requireAuth,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { channelId } = req.params as Record<string, string>;
    const userId = req.userId!;

    // Fetch all key versions for this channel, newest first.
    const rows = await db
      .select()
      .from(groupEncryptionKeys)
      .where(eq(groupEncryptionKeys.channelId, channelId))
      .orderBy(desc(groupEncryptionKeys.version));

    // Find the newest version that includes this user's encrypted key.
    for (const row of rows) {
      const keyDataMap = row.keyData as Record<string, string>;
      if (keyDataMap[userId]) {
        res.status(200).json({
          version: row.version,
          encryptedKey: keyDataMap[userId],
        });
        return;
      }
    }

    // No key found for this user.
    res.status(200).json({ version: null, encryptedKey: null });
  }),
);

// ---------------------------------------------------------------------------
// POST /:channelId/group-key — Store a new group key version
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/channels/:channelId/group-key
 *
 * Inserts a new group key version for the channel. The body must contain the
 * version number and a keyData map of { userId: base64EncryptedKey }.
 *
 * @auth    requireAuth
 * @param   channelId {string} — UUID of the GROUP_DM channel
 * @body    { version: number, keyData: Record<string, string> }
 * @returns 200 { success: true }
 * @returns 400 Validation failure
 */
groupKeysRouter.post(
  '/:channelId/group-key',
  requireAuth,
  validate(postGroupKeySchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { channelId } = req.params as Record<string, string>;
    const { version, keyData } = req.body as z.infer<typeof postGroupKeySchema>;

    await db.insert(groupEncryptionKeys).values({
      channelId,
      version,
      keyData,
    });

    res.status(200).json({ success: true });
  }),
);
