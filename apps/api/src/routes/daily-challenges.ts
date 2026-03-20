import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/index';
import { dailyChallenges, dailyChallengeStreaks } from '../db/schema/daily-challenges';
import { userWallets } from '../db/schema/economy';
import { economyLedger } from '../db/schema/economy';
import { requireAuth } from '../middleware/auth';

export const dailyChallengesRouter = Router();

// Challenge templates: type → { description template, min/max target, reward per unit }
const CHALLENGE_TEMPLATES = [
  { type: 'send_messages', desc: 'Send {n} messages', minTarget: 5, maxTarget: 25, rewardPer: 2 },
  { type: 'react_to_messages', desc: 'React to {n} messages', minTarget: 3, maxTarget: 15, rewardPer: 3 },
  { type: 'join_voice', desc: 'Spend {n} minutes in voice', minTarget: 5, maxTarget: 30, rewardPer: 2 },
  { type: 'visit_servers', desc: 'Visit {n} different servers', minTarget: 2, maxTarget: 5, rewardPer: 10 },
  { type: 'send_reactions', desc: 'Add {n} emoji reactions', minTarget: 5, maxTarget: 20, rewardPer: 2 },
  { type: 'reply_to_messages', desc: 'Reply to {n} messages', minTarget: 3, maxTarget: 10, rewardPer: 3 },
  { type: 'pin_messages', desc: 'Pin {n} messages', minTarget: 1, maxTarget: 3, rewardPer: 15 },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

async function generateDailyChallenges(userId: string, date: string) {
  const templates = pickRandom(CHALLENGE_TEMPLATES, 3);
  const challenges = templates.map(t => {
    const target = randInt(t.minTarget, t.maxTarget);
    return {
      userId,
      date,
      challengeType: t.type,
      description: t.desc.replace('{n}', String(target)),
      target,
      reward: target * t.rewardPer,
    };
  });
  return db.insert(dailyChallenges).values(challenges).returning();
}

// GET /daily-challenges — get today's challenges (auto-generates if needed)
dailyChallengesRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const date = todayStr();

    let challenges = await db.select()
      .from(dailyChallenges)
      .where(and(eq(dailyChallenges.userId, userId), eq(dailyChallenges.date, date)));

    if (challenges.length === 0) {
      challenges = await generateDailyChallenges(userId, date);
    }

    // Get streak info
    const [streak] = await db.select()
      .from(dailyChallengeStreaks)
      .where(eq(dailyChallengeStreaks.userId, userId))
      .limit(1);

    const allCompleted = challenges.every(c => c.completed);
    const allClaimed = challenges.every(c => c.claimed);

    res.json({
      date,
      challenges: challenges.map(c => ({
        id: c.id,
        type: c.challengeType,
        description: c.description,
        target: c.target,
        progress: Math.min(c.progress, c.target),
        completed: c.completed,
        claimed: c.claimed,
        reward: c.reward,
      })),
      streak: {
        current: streak?.currentStreak ?? 0,
        longest: streak?.longestStreak ?? 0,
        allCompleted,
        allClaimed,
        streakBonus: allCompleted && !allClaimed ? Math.min((streak?.currentStreak ?? 0) + 1, 7) * 10 : 0,
      },
    });
  } catch (err) {
    logger.error('[daily-challenges] GET error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// POST /daily-challenges/:id/claim — claim reward for a completed challenge
dailyChallengesRouter.post('/:id/claim', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const challengeId = req.params.id as string;

    const [challenge] = await db.select()
      .from(dailyChallenges)
      .where(and(eq(dailyChallenges.id, challengeId), eq(dailyChallenges.userId, userId)))
      .limit(1);

    if (!challenge) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Challenge not found' });
      return;
    }
    if (!challenge.completed) {
      res.status(400).json({ code: 'NOT_COMPLETED', message: 'Challenge not yet completed' });
      return;
    }
    if (challenge.claimed) {
      res.status(400).json({ code: 'ALREADY_CLAIMED', message: 'Reward already claimed' });
      return;
    }

    // Mark as claimed
    await db.update(dailyChallenges)
      .set({ claimed: true })
      .where(eq(dailyChallenges.id, challengeId));

    // Credit wallet
    await db.update(userWallets)
      .set({
        balance: sql`${userWallets.balance} + ${challenge.reward}`,
        lifetimeEarned: sql`${userWallets.lifetimeEarned} + ${challenge.reward}`,
        updatedAt: new Date(),
      })
      .where(eq(userWallets.userId, userId));

    // Ledger entry
    await db.insert(economyLedger).values({
      userId,
      direction: 'earn',
      amount: challenge.reward,
      source: 'daily_challenge',
      description: `Daily challenge: ${challenge.description}`,
    });

    res.json({ ok: true, reward: challenge.reward });
  } catch (err) {
    logger.error('[daily-challenges] claim error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// POST /daily-challenges/claim-streak — claim streak bonus (all 3 completed)
dailyChallengesRouter.post('/claim-streak', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const date = todayStr();

    const challenges = await db.select()
      .from(dailyChallenges)
      .where(and(eq(dailyChallenges.userId, userId), eq(dailyChallenges.date, date)));

    if (challenges.length === 0 || !challenges.every(c => c.completed)) {
      res.status(400).json({ code: 'NOT_ALL_COMPLETED', message: 'Complete all challenges first' });
      return;
    }

    // Get or create streak record
    let [streak] = await db.select()
      .from(dailyChallengeStreaks)
      .where(eq(dailyChallengeStreaks.userId, userId))
      .limit(1);

    if (!streak) {
      [streak] = await db.insert(dailyChallengeStreaks)
        .values({ userId, currentStreak: 0, longestStreak: 0 })
        .returning();
    }

    // Check if already claimed streak today
    if (streak.lastCompletedDate === date) {
      res.status(400).json({ code: 'ALREADY_CLAIMED', message: 'Streak bonus already claimed today' });
      return;
    }

    // Calculate streak
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    const newStreak = streak.lastCompletedDate === yesterdayStr
      ? streak.currentStreak + 1
      : 1;

    const longestStreak = Math.max(newStreak, streak.longestStreak);
    const streakBonus = Math.min(newStreak, 7) * 10; // 10-70 coins based on streak (capped at 7 days)

    // Update streak
    await db.update(dailyChallengeStreaks)
      .set({
        currentStreak: newStreak,
        longestStreak,
        lastCompletedDate: date,
        updatedAt: new Date(),
      })
      .where(eq(dailyChallengeStreaks.userId, userId));

    // Credit streak bonus
    if (streakBonus > 0) {
      await db.update(userWallets)
        .set({
          balance: sql`${userWallets.balance} + ${streakBonus}`,
          lifetimeEarned: sql`${userWallets.lifetimeEarned} + ${streakBonus}`,
          updatedAt: new Date(),
        })
        .where(eq(userWallets.userId, userId));

      await db.insert(economyLedger).values({
        userId,
        direction: 'earn',
        amount: streakBonus,
        source: 'daily_challenge_streak',
        description: `${newStreak}-day challenge streak bonus`,
      });
    }

    res.json({
      ok: true,
      streakBonus,
      currentStreak: newStreak,
      longestStreak,
    });
  } catch (err) {
    logger.error('[daily-challenges] claim-streak error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// Increment challenge progress (called by other routes, fire-and-forget)
// Auto-generates today's challenges if they don't exist yet.
export async function incrementChallengeProgress(userId: string, challengeType: string, amount: number = 1) {
  try {
    const date = todayStr();

    // Check if today's challenges exist; if not, generate them
    const existing = await db.select({ id: dailyChallenges.id })
      .from(dailyChallenges)
      .where(and(eq(dailyChallenges.userId, userId), eq(dailyChallenges.date, date)))
      .limit(1);

    if (existing.length === 0) {
      await generateDailyChallenges(userId, date);
    }

    const [challenge] = await db.select()
      .from(dailyChallenges)
      .where(and(
        eq(dailyChallenges.userId, userId),
        eq(dailyChallenges.date, date),
        eq(dailyChallenges.challengeType, challengeType),
      ))
      .limit(1);

    if (!challenge || challenge.completed) return;

    const newProgress = Math.min(challenge.progress + amount, challenge.target);
    const completed = newProgress >= challenge.target;

    await db.update(dailyChallenges)
      .set({ progress: newProgress, completed })
      .where(eq(dailyChallenges.id, challenge.id));
  } catch (err) {
    logger.error('[daily-challenges] progress increment error:', err);
  }
}
