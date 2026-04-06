import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { db } from '../db/index';
import { achievements, userAchievements } from '../db/schema/achievements';
import { users } from '../db/schema/users';
import { requireAuth } from '../middleware/auth';

export const achievementsRouter = Router();

// GET /achievements — public list of all achievements (for BadgesGallery)
achievementsRouter.get('/achievements', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const allAchievements = await db.select().from(achievements);
    const earned = await db.select().from(userAchievements).where(eq(userAchievements.userId, userId));
    const earnedSet = new Set(earned.map(e => e.achievementId));
    const result = allAchievements
      .filter(a => !a.hidden || earnedSet.has(a.id))
      .map(a => ({
        ...a,
        earned: earnedSet.has(a.id),
        earnedAt: earned.find(e => e.achievementId === a.id)?.earnedAt ?? null,
      }));
    res.json(result);
  } catch (err) {
    logger.error('[achievements] GET /achievements error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error'  });
  }
});

// GET /users/@me/achievements
achievementsRouter.get('/users/@me/achievements', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const allAchievements = await db.select().from(achievements);
    const earned = await db.select().from(userAchievements).where(eq(userAchievements.userId, userId));
    const earnedSet = new Set(earned.map(e => e.achievementId));
    const result = allAchievements
      .filter(a => !a.hidden || earnedSet.has(a.id))
      .map(a => ({
        ...a,
        earned: earnedSet.has(a.id),
        earnedAt: earned.find(e => e.achievementId === a.id)?.earnedAt ?? null,
      }));
    res.json(result);
  } catch (err) {
    logger.error('[achievements] GET error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error'  });
  }
});

// Internal helper — call after significant user events
export async function checkAchievements(userId: string, event: 'message_sent' | 'guild_joined' | 'reaction_given' | 'bookmark_saved' | 'coins_gifted' | 'streak_7' | 'streak_30'): Promise<void> {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return;

    const earned = await db.select({ id: userAchievements.achievementId }).from(userAchievements).where(eq(userAchievements.userId, userId));
    const earnedIds = new Set(earned.map(e => e.id));

    const toGrant: string[] = [];

    if (event === 'message_sent') {
      // first_message: granted after first message — we use xp as proxy (5 xp per message)
      if (!earnedIds.has('first_message')) {
        toGrant.push('first_message');
      }
    }

    if (event === 'guild_joined' && !earnedIds.has('social_butterfly')) {
      const { guildMembers } = await import('../db/schema/guilds');
      const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(guildMembers).where(eq(guildMembers.userId, userId));
      if (Number(row?.count ?? 0) >= 5) toGrant.push('social_butterfly');
    }

    if (event === 'bookmark_saved' && !earnedIds.has('bookmarker')) {
      const { messageBookmarks } = await import('../db/schema/message-bookmarks');
      const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(messageBookmarks).where(eq(messageBookmarks.userId, userId));
      if (Number(row?.count ?? 0) >= 10) toGrant.push('bookmarker');
    }

    if (event === 'coins_gifted' && !earnedIds.has('gifter')) {
      toGrant.push('gifter');
    }

    if (event === 'streak_7' && !earnedIds.has('streak_7')) {
      toGrant.push('streak_7');
    }

    if (event === 'streak_30' && !earnedIds.has('streak_30')) {
      toGrant.push('streak_30');
    }

    if (toGrant.length > 0) {
      await db.insert(userAchievements).values(
        toGrant.map(id => ({ userId, achievementId: id, earnedAt: new Date() }))
      ).onConflictDoNothing();

      // Insert activity events for each earned achievement (include human-readable name)
      const { activityEvents } = await import('../db/schema/activity-feed');
      const allAchievements = await db.select().from(achievements);
      const achievementMap = new Map(allAchievements.map(a => [a.id, a.name]));
      await db.insert(activityEvents).values(
        toGrant.map(id => ({
          userId,
          type: 'earned_achievement',
          payload: { achievementId: id, achievementName: achievementMap.get(id) ?? id },
        }))
      ).onConflictDoNothing();
    }
  } catch (err) {
    // Non-critical — don't throw
    logger.error('checkAchievements error:', err);
  }
}
