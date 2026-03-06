import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index';
import { memberWarnings } from '../db/schema/warnings';
import { users } from '../db/schema/users';
import { Permissions } from '../db/schema/roles';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { hasPermission } from './roles';

export const moderationRouter = Router({ mergeParams: true });

const warningSchema = z.object({
  reason: z.string().min(1).max(1000),
});

/** GET /guilds/:guildId/members/:userId/warnings */
moderationRouter.get(
  '/:userId/warnings',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { guildId, userId } = req.params as Record<string, string>;

    if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_MESSAGES))) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Missing moderation permission' }); return;
    }

    const warnings = await db
      .select({
        id: memberWarnings.id,
        guildId: memberWarnings.guildId,
        userId: memberWarnings.userId,
        moderatorId: memberWarnings.moderatorId,
        reason: memberWarnings.reason,
        createdAt: memberWarnings.createdAt,
        moderatorUsername: users.username,
        moderatorDisplayName: users.displayName,
      })
      .from(memberWarnings)
      .leftJoin(users, eq(users.id, memberWarnings.moderatorId))
      .where(and(eq(memberWarnings.guildId, guildId), eq(memberWarnings.userId, userId)));

    res.json(warnings);
  },
);

/** POST /guilds/:guildId/members/:userId/warnings */
moderationRouter.post(
  '/:userId/warnings',
  requireAuth,
  validate(warningSchema),
  async (req: Request, res: Response): Promise<void> => {
    const { guildId, userId } = req.params as Record<string, string>;

    if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_MESSAGES))) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Missing moderation permission' }); return;
    }

    const { reason } = req.body;

    const [warning] = await db.insert(memberWarnings).values({
      guildId,
      userId,
      moderatorId: req.userId!,
      reason,
    }).returning();

    res.status(201).json(warning);
  },
);

/** DELETE /guilds/:guildId/warnings/:warningId */
moderationRouter.delete(
  '/warnings/:warningId',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { guildId, warningId } = req.params as Record<string, string>;

    if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_MESSAGES))) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Missing moderation permission' }); return;
    }

    await db.delete(memberWarnings).where(
      and(eq(memberWarnings.id, warningId), eq(memberWarnings.guildId, guildId)),
    );

    res.json({ code: 'OK', message: 'Warning deleted' });
  },
);
