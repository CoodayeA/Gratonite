/**
 * routes/vanity-profile.ts — Vanity profile URLs (item 110)
 * Mounted at /api/v1/users
 */
import { Router, Request, Response } from 'express';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index';
import { users } from '../db/schema/users';
import { requireAuth } from '../middleware/auth';

export const vanityProfileRouter = Router();

/** GET /api/v1/users/vanity/:vanityUrl — Public profile by vanity URL */
vanityProfileRouter.get('/vanity/:vanityUrl', async (req: Request, res: Response): Promise<void> => {
  const vanityUrl = (req.params.vanityUrl as string).toLowerCase();

  const [user] = await db.select({
    id: users.id,
    username: users.username,
    displayName: users.displayName,
    avatarHash: users.avatarHash,
    bio: users.bio,
    createdAt: users.createdAt,
  }).from(users).where(sql`lower(vanity_url) = ${vanityUrl}`).limit(1);

  if (!user) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'User not found' }); return;
  }

  res.json(user);
});

/** PUT /api/v1/users/@me/vanity — Set vanity URL */
vanityProfileRouter.put('/@me/vanity', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { vanityUrl } = req.body as { vanityUrl: string };

  if (!vanityUrl || vanityUrl.length < 3 || vanityUrl.length > 50) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'vanityUrl must be 3-50 characters' }); return;
  }

  // Only alphanumeric, hyphens, underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(vanityUrl)) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'vanityUrl can only contain letters, numbers, hyphens, underscores' }); return;
  }

  // Check if taken
  const [existing] = await db.select({ id: users.id })
    .from(users).where(sql`lower(vanity_url) = ${vanityUrl.toLowerCase()} AND id != ${req.userId!}`).limit(1);
  if (existing) {
    res.status(409).json({ code: 'CONFLICT', message: 'This vanity URL is already taken' }); return;
  }

  await db.execute(sql`UPDATE users SET vanity_url = ${vanityUrl} WHERE id = ${req.userId!}`);
  res.json({ code: 'OK', vanityUrl });
});

/** DELETE /api/v1/users/@me/vanity — Remove vanity URL */
vanityProfileRouter.delete('/@me/vanity', requireAuth, async (req: Request, res: Response): Promise<void> => {
  await db.execute(sql`UPDATE users SET vanity_url = NULL WHERE id = ${req.userId!}`);
  res.json({ code: 'OK' });
});
