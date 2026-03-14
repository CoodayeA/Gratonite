/**
 * routes/login-rewards.ts — Daily login rewards with streak tracking.
 * Mounted at /
 */
import { Router, Request, Response } from 'express';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index';
import { users } from '../db/schema/users';
import { requireAuth } from '../middleware/auth';
import { logger } from '../lib/logger';

export const loginRewardsRouter = Router();

const STREAK_REWARDS = [
  { day: 1, coins: 10 },
  { day: 2, coins: 15 },
  { day: 3, coins: 20 },
  { day: 4, coins: 25 },
  { day: 5, coins: 35 },
  { day: 6, coins: 40 },
  { day: 7, coins: 75 }, // weekly bonus
  { day: 14, coins: 150 },
  { day: 30, coins: 500 },
];

function todayStr() { return new Date().toISOString().slice(0, 10); }
function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

// GET /login-reward — check today's reward status
loginRewardsRouter.get('/login-reward', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [user] = await db.select({
      currentStreak: users.currentStreak,
      longestStreak: users.longestStreak,
      lastStreakAt: users.lastStreakAt,
      coins: users.coins,
    }).from(users).where(eq(users.id, req.userId!)).limit(1);

    if (!user) { res.status(404).json({ code: 'NOT_FOUND' }); return; }

    const today = todayStr();
    const claimedToday = user.lastStreakAt === today;
    const nextReward = STREAK_REWARDS.find(r => r.day >= (user.currentStreak + 1)) || { day: user.currentStreak + 1, coins: 10 };

    res.json({
      currentStreak: user.currentStreak,
      longestStreak: user.longestStreak,
      claimedToday,
      nextReward: claimedToday ? null : nextReward,
      streakRewards: STREAK_REWARDS,
    });
  } catch (err) {
    logger.error('[login-rewards] GET error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /login-reward/claim — claim daily reward
loginRewardsRouter.post('/login-reward/claim', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [user] = await db.select({
      currentStreak: users.currentStreak,
      longestStreak: users.longestStreak,
      lastStreakAt: users.lastStreakAt,
    }).from(users).where(eq(users.id, req.userId!)).limit(1);

    if (!user) { res.status(404).json({ code: 'NOT_FOUND' }); return; }

    const today = todayStr();
    const yesterday = yesterdayStr();

    if (user.lastStreakAt === today) {
      res.status(400).json({ code: 'ALREADY_CLAIMED', message: 'Already claimed today' }); return;
    }

    // Calculate new streak
    let newStreak: number;
    if (user.lastStreakAt === yesterday) {
      newStreak = user.currentStreak + 1;
    } else {
      newStreak = 1; // streak broken
    }

    const reward = STREAK_REWARDS.find(r => r.day === newStreak) || { coins: 10 };
    const newLongest = Math.max(user.longestStreak, newStreak);

    await db.update(users).set({
      currentStreak: newStreak,
      longestStreak: newLongest,
      lastStreakAt: today,
      coins: sql`${users.coins} + ${reward.coins}`,
    }).where(eq(users.id, req.userId!));

    res.json({
      streak: newStreak,
      longestStreak: newLongest,
      coinsEarned: reward.coins,
    });
  } catch (err) {
    logger.error('[login-rewards] POST claim error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
