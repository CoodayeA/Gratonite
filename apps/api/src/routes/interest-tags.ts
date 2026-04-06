import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { db } from '../db/index';
import { interestTags, userInterests } from '../db/schema/interest-tags';
import { users } from '../db/schema/users';
import { requireAuth } from '../middleware/auth';
import { z } from 'zod';
import { validate } from '../middleware/validate';

export const interestTagsRouter = Router({ mergeParams: true });

/** GET /interest-tags — list all available tags grouped by category */
interestTagsRouter.get('/interest-tags', async (_req: Request, res: Response): Promise<void> => {
  try {
    const tags = await db.select().from(interestTags);
    const grouped: Record<string, Array<{ tag: string; icon: string | null }>> = {};
    for (const t of tags) {
      if (!grouped[t.category]) grouped[t.category] = [];
      grouped[t.category].push({ tag: t.tag, icon: t.icon });
    }
    res.json(grouped);
  } catch (err) {
    logger.error('[interest-tags] GET tags error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error'  });
  }
});

/** GET /users/@me/interests */
interestTagsRouter.get('/users/@me/interests', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const rows = await db.select({ tag: userInterests.tag }).from(userInterests).where(eq(userInterests.userId, userId));
    res.json(rows.map(r => r.tag));
  } catch (err) {
    logger.error('[interest-tags] GET my interests error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error'  });
  }
});

const setInterestsSchema = z.object({
  tags: z.array(z.string()).max(50),
});

/** PUT /users/@me/interests — set interests (body: { tags: string[] }) */
interestTagsRouter.put('/users/@me/interests', requireAuth, validate(setInterestsSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { tags } = req.body as { tags: string[] };

    // Delete existing and insert new
    await db.delete(userInterests).where(eq(userInterests.userId, userId));

    if (tags.length > 0) {
      await db.insert(userInterests).values(
        tags.map(tag => ({ userId, tag }))
      ).onConflictDoNothing();
    }

    res.json(tags);
  } catch (err) {
    logger.error('[interest-tags] PUT interests error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error'  });
  }
});

/** GET /guilds/:guildId/interest-matches — find users with overlapping interests */
interestTagsRouter.get('/guilds/:guildId/interest-matches', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { guildId } = req.params as Record<string, string>;

    // Get current user's interests
    const myInterests = await db.select({ tag: userInterests.tag })
      .from(userInterests)
      .where(eq(userInterests.userId, userId));

    if (myInterests.length === 0) {
      res.json([]);
      return;
    }

    const myTags = myInterests.map(r => r.tag);

    // Find guild members with overlapping interests
    const { guildMembers } = await import('../db/schema/guilds');

    const matches = await db.select({
      userId: userInterests.userId,
      username: users.username,
      displayName: users.displayName,
      avatarHash: users.avatarHash,
      sharedTags: sql<string[]>`array_agg(${userInterests.tag})`,
      overlapCount: sql<number>`count(*)::int`,
    })
      .from(userInterests)
      .innerJoin(users, eq(users.id, userInterests.userId))
      .innerJoin(guildMembers, and(
        eq(guildMembers.userId, userInterests.userId),
        eq(guildMembers.guildId, guildId),
      ))
      .where(and(
        inArray(userInterests.tag, myTags),
        sql`${userInterests.userId} != ${userId}`,
      ))
      .groupBy(userInterests.userId, users.id, users.username, users.displayName, users.avatarHash)
      .orderBy(sql`count(*) DESC`)
      .limit(20);

    res.json(matches);
  } catch (err) {
    logger.error('[interest-tags] GET interest-matches error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error'  });
  }
});
