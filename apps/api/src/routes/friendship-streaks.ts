import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db/index';
import { friendshipStreaks, friendshipMilestones } from '../db/schema/friendship-streaks';
import { users } from '../db/schema/users';
import { requireAuth } from '../middleware/auth';

export const friendshipStreaksRouter = Router({ mergeParams: true });

/** GET /relationships/:friendId/streak */
friendshipStreaksRouter.get('/:friendId/streak', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { friendId } = req.params as Record<string, string>;

    const [streak] = await db.select()
      .from(friendshipStreaks)
      .where(and(
        eq(friendshipStreaks.userId, userId),
        eq(friendshipStreaks.friendId, friendId),
      ))
      .limit(1);

    if (!streak) {
      res.json({ currentStreak: 0, longestStreak: 0, lastInteraction: null, friendsSince: null });
      return;
    }

    res.json(streak);
  } catch (err) {
    logger.error('[friendship-streaks] GET streak error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /relationships/streaks */
friendshipStreaksRouter.get('/streaks', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    const rows = await db.select({
      streak: friendshipStreaks,
      friend: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarHash: users.avatarHash,
      },
    })
      .from(friendshipStreaks)
      .innerJoin(users, eq(users.id, friendshipStreaks.friendId))
      .where(eq(friendshipStreaks.userId, userId))
      .orderBy(desc(friendshipStreaks.currentStreak));

    res.json(rows.map(r => ({ ...r.streak, friend: r.friend })));
  } catch (err) {
    logger.error('[friendship-streaks] GET streaks error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** GET /relationships/:friendId/milestones */
friendshipStreaksRouter.get('/:friendId/milestones', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { friendId } = req.params as Record<string, string>;

    const rows = await db.select()
      .from(friendshipMilestones)
      .where(and(
        eq(friendshipMilestones.userId, userId),
        eq(friendshipMilestones.friendId, friendId),
      ));

    res.json(rows);
  } catch (err) {
    logger.error('[friendship-streaks] GET milestones error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /relationships/:friendId/interact */
friendshipStreaksRouter.post('/:friendId/interact', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { friendId } = req.params as Record<string, string>;

    if (userId === friendId) {
      res.status(400).json({ error: 'Cannot interact with yourself' });
      return;
    }

    const now = new Date();

    // Upsert streak for current user -> friend
    const [streak] = await db.insert(friendshipStreaks).values({
      userId,
      friendId,
      currentStreak: 1,
      longestStreak: 1,
      lastInteraction: now,
      friendsSince: now,
    }).onConflictDoUpdate({
      target: [friendshipStreaks.userId, friendshipStreaks.friendId],
      set: {
        currentStreak: sql`CASE
          WHEN ${friendshipStreaks.lastInteraction} IS NULL THEN 1
          WHEN ${friendshipStreaks.lastInteraction} > NOW() - INTERVAL '24 hours' THEN ${friendshipStreaks.currentStreak}
          WHEN ${friendshipStreaks.lastInteraction} > NOW() - INTERVAL '48 hours' THEN ${friendshipStreaks.currentStreak} + 1
          ELSE 1
        END`,
        longestStreak: sql`GREATEST(${friendshipStreaks.longestStreak}, CASE
          WHEN ${friendshipStreaks.lastInteraction} IS NULL THEN 1
          WHEN ${friendshipStreaks.lastInteraction} > NOW() - INTERVAL '24 hours' THEN ${friendshipStreaks.currentStreak}
          WHEN ${friendshipStreaks.lastInteraction} > NOW() - INTERVAL '48 hours' THEN ${friendshipStreaks.currentStreak} + 1
          ELSE 1
        END)`,
        lastInteraction: sql`NOW()`,
      },
    }).returning();

    res.json(streak);
  } catch (err) {
    logger.error('[friendship-streaks] POST interact error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
