import { Router, Request, Response, NextFunction } from 'express';
import { eq, and } from 'drizzle-orm';

import { db } from '../db/index';
import { userMutes } from '../db/schema/user-mutes';
import { users } from '../db/schema/users';
import { requireAuth } from '../middleware/auth';

export const mutesRouter = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// GET /users/@me/mutes
mutesRouter.get('/@me/mutes', requireAuth, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const limit = Math.min(parseInt(req.query.limit as string) || 200, 200);

  const rows = await db
    .select({
      mutedUserId: userMutes.mutedUserId,
      createdAt: userMutes.createdAt,
      username: users.username,
      displayName: users.displayName,
      avatarHash: users.avatarHash,
    })
    .from(userMutes)
    .innerJoin(users, eq(users.id, userMutes.mutedUserId))
    .where(eq(userMutes.userId, req.userId!))
    .limit(limit);

  res.json(rows);
}));

// PUT /users/@me/mutes/:userId
mutesRouter.put('/@me/mutes/:userId', requireAuth, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const targetId = req.params.userId as string;

  if (targetId === req.userId!) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'You cannot mute yourself' });
    return;
  }

  await db.insert(userMutes).values({
    userId: req.userId!,
    mutedUserId: targetId,
  }).onConflictDoNothing();

  res.status(204).end();
}));

// DELETE /users/@me/mutes/:userId
mutesRouter.delete('/@me/mutes/:userId', requireAuth, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const targetId = req.params.userId as string;

  if (targetId === req.userId!) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'You cannot unmute yourself' });
    return;
  }

  await db.delete(userMutes).where(
    and(eq(userMutes.userId, req.userId!), eq(userMutes.mutedUserId, targetId))
  );

  res.status(204).end();
}));
