/**
 * routes/user-titles.ts — User titles / flairs system.
 * Mounted at /
 */
import { Router, Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index';
import { userTitles, userTitleOwnership } from '../db/schema/user-titles';
import { requireAuth } from '../middleware/auth';

export const userTitlesRouter = Router();

// GET /titles — list all available titles
userTitlesRouter.get('/titles', requireAuth, async (_req: Request, res: Response): Promise<void> => {
  const titles = await db.select().from(userTitles);
  res.json(titles);
});

// GET /users/@me/titles — get my owned titles
userTitlesRouter.get('/users/@me/titles', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const owned = await db.select({
    id: userTitleOwnership.id,
    titleId: userTitleOwnership.titleId,
    equipped: userTitleOwnership.equipped,
    earnedAt: userTitleOwnership.earnedAt,
    name: userTitles.name,
    description: userTitles.description,
    color: userTitles.color,
    rarity: userTitles.rarity,
  }).from(userTitleOwnership)
    .innerJoin(userTitles, eq(userTitles.id, userTitleOwnership.titleId))
    .where(eq(userTitleOwnership.userId, req.userId!));

  res.json(owned);
});

// POST /users/@me/titles/:titleId/equip — equip a title
userTitlesRouter.post('/users/@me/titles/:titleId/equip', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const titleId = req.params.titleId as string;

  // Verify ownership
  const [ownership] = await db.select().from(userTitleOwnership)
    .where(and(eq(userTitleOwnership.userId, req.userId!), eq(userTitleOwnership.titleId, titleId))).limit(1);
  if (!ownership) { res.status(404).json({ code: 'NOT_FOUND', message: 'Title not owned' }); return; }

  // Unequip all other titles
  await db.update(userTitleOwnership).set({ equipped: false })
    .where(eq(userTitleOwnership.userId, req.userId!));

  // Equip this one
  await db.update(userTitleOwnership).set({ equipped: true })
    .where(eq(userTitleOwnership.id, ownership.id));

  res.json({ ok: true, titleId });
});

// POST /users/@me/titles/unequip — unequip current title
userTitlesRouter.post('/users/@me/titles/unequip', requireAuth, async (req: Request, res: Response): Promise<void> => {
  await db.update(userTitleOwnership).set({ equipped: false })
    .where(eq(userTitleOwnership.userId, req.userId!));
  res.json({ ok: true });
});

// GET /users/:userId/title — get a user's equipped title
userTitlesRouter.get('/users/:userId/title', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.params.userId as string;

  const [equipped] = await db.select({
    name: userTitles.name,
    color: userTitles.color,
    rarity: userTitles.rarity,
  }).from(userTitleOwnership)
    .innerJoin(userTitles, eq(userTitles.id, userTitleOwnership.titleId))
    .where(and(eq(userTitleOwnership.userId, userId), eq(userTitleOwnership.equipped, true))).limit(1);

  res.json(equipped || null);
});
