/**
 * routes/bot-permissions.ts — Per-guild bot permission management.
 *
 * Mounted at /guilds/:guildId/bots in src/routes/index.ts.
 *
 * Endpoints:
 *   GET    /:appId/permissions   — Get bot permissions for this guild
 *   PATCH  /:appId/permissions   — Update bot permissions for this guild
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index';
import { botGuildPermissions } from '../db/schema/bot-guild-permissions';
import { guilds } from '../db/schema/guilds';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { logger } from '../lib/logger';

export const botPermissionsRouter = Router({ mergeParams: true });

const updatePermissionsSchema = z.object({
  permissions: z.string().or(z.number()),
});

/** GET /guilds/:guildId/bots/:appId/permissions */
botPermissionsRouter.get(
  '/:appId/permissions',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { guildId, appId } = req.params as Record<string, string>;

      const [perm] = await db.select()
        .from(botGuildPermissions)
        .where(and(
          eq(botGuildPermissions.botApplicationId, appId),
          eq(botGuildPermissions.guildId, guildId),
        ))
        .limit(1);

      if (!perm) {
        // Return default permissions
        res.json({ botApplicationId: appId, guildId, permissions: '384' });
        return;
      }

      res.json({
        botApplicationId: perm.botApplicationId,
        guildId: perm.guildId,
        permissions: String(perm.permissions),
      });
    } catch (err) {
      logger.error('[bot-permissions] GET error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

/** PATCH /guilds/:guildId/bots/:appId/permissions */
botPermissionsRouter.patch(
  '/:appId/permissions',
  requireAuth,
  validate(updatePermissionsSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { guildId, appId } = req.params as Record<string, string>;
      const { permissions } = req.body as { permissions: string | number };

      // Verify caller owns or manages the guild
      const [guild] = await db.select({ ownerId: guilds.ownerId })
        .from(guilds)
        .where(eq(guilds.id, guildId))
        .limit(1);

      if (!guild) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Guild not found' }); return;
      }

      if (guild.ownerId !== req.userId) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'Only the guild owner can manage bot permissions' }); return;
      }

      const permBigint = BigInt(permissions);

      // Upsert
      const existing = await db.select({ id: botGuildPermissions.id })
        .from(botGuildPermissions)
        .where(and(
          eq(botGuildPermissions.botApplicationId, appId),
          eq(botGuildPermissions.guildId, guildId),
        ))
        .limit(1);

      if (existing.length > 0) {
        await db.update(botGuildPermissions)
          .set({ permissions: permBigint, updatedAt: new Date() })
          .where(eq(botGuildPermissions.id, existing[0].id));
      } else {
        await db.insert(botGuildPermissions).values({
          botApplicationId: appId,
          guildId,
          permissions: permBigint,
        });
      }

      res.json({
        botApplicationId: appId,
        guildId,
        permissions: String(permBigint),
      });
    } catch (err) {
      logger.error('[bot-permissions] PATCH error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);
