import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/index';
import { fameTransactions } from '../db/schema/fameTransactions';
import { fameDailyLimits } from '../db/schema/fameDailyLimits';
import { userWallets } from '../db/schema/economy';
import { users } from '../db/schema/users';
import { messages } from '../db/schema/messages';
import { requireAuth } from '../middleware/auth';
import { getIO } from '../lib/socket-io';

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
      const { messageId, guildId, channelId } = req.body as { messageId?: string; guildId?: string; channelId?: string };

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

      // Per-recipient daily limit: only 1 fame per person per day
      const [alreadyGave] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(fameTransactions)
        .where(and(
          eq(fameTransactions.giverId, giverId),
          eq(fameTransactions.receiverId, receiverId),
          sql`${fameTransactions.createdAt}::date = CURRENT_DATE`
        ));
      if ((alreadyGave?.count ?? 0) > 0) {
        res.status(429).json({ code: 'RATE_LIMIT', message: 'You already gave this person fame today' });
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

      // Award +200 Gratonite to receiver
      try {
        await db
          .insert(userWallets)
          .values({ userId: receiverId, balance: 200, lifetimeEarned: 200 })
          .onConflictDoUpdate({
            target: [userWallets.userId],
            set: {
              balance: sql`${userWallets.balance} + 200`,
              lifetimeEarned: sql`${userWallets.lifetimeEarned} + 200`,
            },
          });
      } catch { /* wallet reward non-critical */ }

      // Create system message in the channel & emit socket event
      try {
        const [giver] = await db.select({ username: users.username, displayName: users.displayName }).from(users).where(eq(users.id, giverId)).limit(1);
        const [receiver] = await db.select({ username: users.username, displayName: users.displayName }).from(users).where(eq(users.id, receiverId)).limit(1);
        const giverName = giver?.displayName || giver?.username || 'Someone';
        const receiverName = receiver?.displayName || receiver?.username || 'Someone';

        // Resolve the target channel: use channelId directly if provided, else look it up from messageId
        let targetChannelId: string | null = channelId ?? null;
        if (!targetChannelId && messageId) {
          const [msg] = await db.select({ channelId: messages.channelId }).from(messages).where(eq(messages.id, messageId)).limit(1);
          targetChannelId = msg?.channelId ?? null;
        }
        if (targetChannelId) {
          const [sysMsg] = await db.insert(messages).values({
            channelId: targetChannelId,
            authorId: giverId,
            content: `**${giverName}** gave **${receiverName}** FAME! 🌟`,
          }).returning();

          getIO().to(`channel:${targetChannelId}`).emit('MESSAGE_CREATE', {
            ...sysMsg,
            isSystem: true,
            author: { id: giverId, username: giver?.username, displayName: giver?.displayName },
          });
        }
      } catch { /* system message non-critical */ }

      const newCount = currentCount + 1;
      res.status(200).json({ success: true, fameGiven: newCount, remaining: DAILY_FAME_LIMIT - newCount });
    } catch (err) {
      logger.error('[fame] give error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

/**
 * GET /remaining — Get remaining daily FAME tokens for the current user
 */
fameRouter.get(
  '/remaining',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.userId!;
      const today = todayDateString();
      const [row] = await db
        .select({ count: fameDailyLimits.count })
        .from(fameDailyLimits)
        .where(and(eq(fameDailyLimits.userId, userId), eq(fameDailyLimits.date, today)))
        .limit(1);
      const used = row?.count ?? 0;
      res.json({ remaining: Math.max(0, DAILY_FAME_LIMIT - used), used });
    } catch (err) {
      logger.error('[fame] remaining error:', err);
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
      logger.error('[fame] stats error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);
