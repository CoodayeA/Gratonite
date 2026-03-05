import { Router, Request, Response } from 'express';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/index';
import { fameTransactions } from '../db/schema/fameTransactions';
import { fameDailyLimits } from '../db/schema/fameDailyLimits';
import { requireAuth } from '../middleware/auth';

export const fameRouter = Router({ mergeParams: true });

const DAILY_FAME_LIMIT = 5;

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * POST /api/v1/users/:userId/fame — Give fame to a user
 */
fameRouter.post(
  '/',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId: receiverId } = req.params as Record<string, string>;
      const giverId = req.userId!;
      const { messageId, guildId } = req.body as { messageId?: string; guildId?: string };

      if (giverId === receiverId) {
        res.status(400).json({ code: 'BAD_REQUEST', message: 'You cannot give fame to yourself' });
        return;
      }

      if (!guildId) {
        res.status(400).json({ code: 'BAD_REQUEST', message: 'guildId is required' });
        return;
      }

      const today = todayDateString();

      // Check daily limit
      const [limitRow] = await db
        .select({ count: fameDailyLimits.count })
        .from(fameDailyLimits)
        .where(and(eq(fameDailyLimits.userId, giverId), eq(fameDailyLimits.date, today)))
        .limit(1);

      const currentCount = limitRow?.count ?? 0;
      if (currentCount >= DAILY_FAME_LIMIT) {
        res.status(429).json({ code: 'RATE_LIMIT', message: 'Daily fame limit reached' });
        return;
      }

      // Insert fame transaction
      await db.insert(fameTransactions).values({
        giverId,
        receiverId,
        messageId: messageId ?? null,
        guildId,
      });

      // Upsert daily limit
      await db
        .insert(fameDailyLimits)
        .values({ userId: giverId, date: today, count: 1 })
        .onConflictDoUpdate({
          target: [fameDailyLimits.userId, fameDailyLimits.date],
          set: { count: sql`${fameDailyLimits.count} + 1` },
        });

      const newCount = currentCount + 1;
      res.status(200).json({ success: true, fameGiven: newCount, remaining: DAILY_FAME_LIMIT - newCount });
    } catch (err) {
      console.error('[fame] give error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

/**
 * GET /api/v1/users/:userId/fame — Get fame stats for a user
 */
fameRouter.get(
  '/',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params as Record<string, string>;

      const [received] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(fameTransactions)
        .where(eq(fameTransactions.receiverId, userId));

      const [given] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(fameTransactions)
        .where(eq(fameTransactions.giverId, userId));

      res.status(200).json({
        fameReceived: received?.count ?? 0,
        fameGiven: given?.count ?? 0,
      });
    } catch (err) {
      console.error('[fame] stats error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);
