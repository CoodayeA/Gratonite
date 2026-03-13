/**
 * routes/connections.ts — Express router for connected accounts endpoints.
 *
 * Mounted at /api/v1/users by src/routes/index.ts.
 *
 * Endpoints:
 *   GET    /users/@me/connections           — List my connections
 *   POST   /users/@me/connections           — Add a connection
 *   DELETE /users/@me/connections/:provider — Remove a connection
 *   GET    /users/:userId/connections       — Public list for a user
 */

import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';

import { db } from '../db/index';
import { connectedAccounts } from '../db/schema/connected-accounts';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';

export const connectionsRouter = Router();

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const addConnectionSchema = z.object({
  provider: z.enum(['github', 'twitch', 'steam', 'twitter', 'youtube', 'spotify']),
  providerUsername: z.string().min(1).max(100),
  profileUrl: z.string().url().optional(),
});

// ---------------------------------------------------------------------------
// GET /users/@me/connections
// ---------------------------------------------------------------------------

connectionsRouter.get(
  '/@me/connections',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const rows = await db
        .select()
        .from(connectedAccounts)
        .where(eq(connectedAccounts.userId, req.userId!));

      res.status(200).json(rows);
    } catch (err) {
      logger.error('[connections] GET /@me/connections error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /users/@me/connections
// ---------------------------------------------------------------------------

connectionsRouter.post(
  '/@me/connections',
  requireAuth,
  validate(addConnectionSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { provider, providerUsername, profileUrl } = req.body as z.infer<typeof addConnectionSchema>;

      const [row] = await db
        .insert(connectedAccounts)
        .values({
          userId: req.userId!,
          provider,
          providerUsername,
          profileUrl: profileUrl ?? null,
        })
        .onConflictDoUpdate({
          target: [connectedAccounts.userId, connectedAccounts.provider],
          set: {
            providerUsername,
            profileUrl: profileUrl ?? null,
          },
        })
        .returning();

      res.status(200).json(row);
    } catch (err) {
      logger.error('[connections] POST /@me/connections error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /users/@me/connections/:provider
// ---------------------------------------------------------------------------

connectionsRouter.delete(
  '/@me/connections/:provider',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { provider } = req.params as Record<string, string>;

      await db
        .delete(connectedAccounts)
        .where(
          and(
            eq(connectedAccounts.userId, req.userId!),
            eq(connectedAccounts.provider, provider),
          ),
        );

      res.status(204).send();
    } catch (err) {
      logger.error('[connections] DELETE /@me/connections/:provider error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /users/:userId/connections
// ---------------------------------------------------------------------------

connectionsRouter.get(
  '/:userId/connections',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params as Record<string, string>;

      const rows = await db
        .select({
          id: connectedAccounts.id,
          provider: connectedAccounts.provider,
          providerUsername: connectedAccounts.providerUsername,
          profileUrl: connectedAccounts.profileUrl,
          createdAt: connectedAccounts.createdAt,
        })
        .from(connectedAccounts)
        .where(eq(connectedAccounts.userId, userId));

      res.status(200).json(rows);
    } catch (err) {
      logger.error('[connections] GET /:userId/connections error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);
