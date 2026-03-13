/**
 * routes/guild-currency.ts — CRUD for server-specific currencies and balance operations.
 *
 * Mounted at /api/v1/guilds/:guildId/currency
 */

import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../db/index';
import { guildCurrencies, guildCurrencyBalances } from '../db/schema/guild-currencies';
import { requireAuth } from '../middleware/auth';
import { requireMember, requireOwner } from './guilds';

export const guildCurrencyRouter = Router({ mergeParams: true });

// GET /guilds/:guildId/currency — get guild's currency config
guildCurrencyRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const guildId = req.params.guildId as string;
    const userId = req.userId!;
    await requireMember(guildId, userId);

    const [currency] = await db.select()
      .from(guildCurrencies)
      .where(eq(guildCurrencies.guildId, guildId))
      .limit(1);

    if (!currency) {
      res.json({ enabled: false, currency: null, balance: 0 });
      return;
    }

    // Get user's balance
    const [bal] = await db.select()
      .from(guildCurrencyBalances)
      .where(and(eq(guildCurrencyBalances.guildId, guildId), eq(guildCurrencyBalances.userId, userId)))
      .limit(1);

    res.json({
      enabled: true,
      currency: {
        id: currency.id,
        name: currency.name,
        emoji: currency.emoji,
        earnPerMessage: currency.earnPerMessage,
        earnPerReaction: currency.earnPerReaction,
        earnPerVoiceMinute: currency.earnPerVoiceMinute,
      },
      balance: bal?.balance ?? 0,
      lifetimeEarned: bal?.lifetimeEarned ?? 0,
    });
  } catch (err: any) {
    if (err?.statusCode) { res.status(err.statusCode).json({ code: err.code, message: err.message }); return; }
    logger.error('[guild-currency] GET error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// POST /guilds/:guildId/currency — create or update guild's currency (owner only)
guildCurrencyRouter.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const guildId = req.params.guildId as string;
    const userId = req.userId!;
    await requireOwner(guildId, userId);

    const { name, emoji, earnPerMessage, earnPerReaction, earnPerVoiceMinute } = req.body;

    if (!name || typeof name !== 'string' || name.length > 50) {
      res.status(400).json({ code: 'INVALID_NAME', message: 'Currency name is required (max 50 chars)' });
      return;
    }

    const [existing] = await db.select()
      .from(guildCurrencies)
      .where(eq(guildCurrencies.guildId, guildId))
      .limit(1);

    if (existing) {
      // Update
      const [updated] = await db.update(guildCurrencies)
        .set({
          name: name.trim(),
          emoji: (emoji ?? '💰').slice(0, 20),
          earnPerMessage: Math.max(0, Math.min(100, Number(earnPerMessage) || 1)),
          earnPerReaction: Math.max(0, Math.min(100, Number(earnPerReaction) || 1)),
          earnPerVoiceMinute: Math.max(0, Math.min(100, Number(earnPerVoiceMinute) || 2)),
          updatedAt: new Date(),
        })
        .where(eq(guildCurrencies.id, existing.id))
        .returning();

      res.json(updated);
    } else {
      // Create
      const [created] = await db.insert(guildCurrencies)
        .values({
          guildId,
          name: name.trim(),
          emoji: (emoji ?? '💰').slice(0, 20),
          earnPerMessage: Math.max(0, Math.min(100, Number(earnPerMessage) || 1)),
          earnPerReaction: Math.max(0, Math.min(100, Number(earnPerReaction) || 1)),
          earnPerVoiceMinute: Math.max(0, Math.min(100, Number(earnPerVoiceMinute) || 2)),
        })
        .returning();

      res.status(201).json(created);
    }
  } catch (err: any) {
    if (err?.statusCode) { res.status(err.statusCode).json({ code: err.code, message: err.message }); return; }
    logger.error('[guild-currency] POST error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// DELETE /guilds/:guildId/currency — delete guild's currency (owner only)
guildCurrencyRouter.delete('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const guildId = req.params.guildId as string;
    const userId = req.userId!;
    await requireOwner(guildId, userId);

    await db.delete(guildCurrencies).where(eq(guildCurrencies.guildId, guildId));
    await db.delete(guildCurrencyBalances).where(eq(guildCurrencyBalances.guildId, guildId));

    res.json({ ok: true });
  } catch (err: any) {
    if (err?.statusCode) { res.status(err.statusCode).json({ code: err.code, message: err.message }); return; }
    logger.error('[guild-currency] DELETE error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// GET /guilds/:guildId/currency/leaderboard — top balances
guildCurrencyRouter.get('/leaderboard', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const guildId = req.params.guildId as string;
    const userId = req.userId!;
    await requireMember(guildId, userId);

    const rows = await db.select({
      userId: guildCurrencyBalances.userId,
      balance: guildCurrencyBalances.balance,
      lifetimeEarned: guildCurrencyBalances.lifetimeEarned,
    })
      .from(guildCurrencyBalances)
      .where(eq(guildCurrencyBalances.guildId, guildId))
      .orderBy(desc(guildCurrencyBalances.balance))
      .limit(25);

    res.json(rows);
  } catch (err: any) {
    if (err?.statusCode) { res.status(err.statusCode).json({ code: err.code, message: err.message }); return; }
    logger.error('[guild-currency] leaderboard error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// POST /guilds/:guildId/currency/award — owner awards currency to a user
guildCurrencyRouter.post('/award', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const guildId = req.params.guildId as string;
    const userId = req.userId!;
    await requireOwner(guildId, userId);

    const { targetUserId, amount } = req.body;
    if (!targetUserId || !amount || amount <= 0 || amount > 10000) {
      res.status(400).json({ code: 'INVALID_INPUT', message: 'targetUserId and amount (1-10000) required' });
      return;
    }

    // Upsert balance
    await db.insert(guildCurrencyBalances)
      .values({ guildId, userId: targetUserId, balance: amount, lifetimeEarned: amount })
      .onConflictDoUpdate({
        target: [guildCurrencyBalances.guildId, guildCurrencyBalances.userId],
        set: {
          balance: sql`${guildCurrencyBalances.balance} + ${amount}`,
          lifetimeEarned: sql`${guildCurrencyBalances.lifetimeEarned} + ${amount}`,
          updatedAt: new Date(),
        },
      });

    res.json({ ok: true, awarded: amount });
  } catch (err: any) {
    if (err?.statusCode) { res.status(err.statusCode).json({ code: err.code, message: err.message }); return; }
    logger.error('[guild-currency] award error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

/**
 * Exported helper — called from message/reaction/voice routes to auto-earn server currency.
 */
export async function earnGuildCurrency(guildId: string, userId: string, type: 'message' | 'reaction' | 'voice_minute'): Promise<void> {
  try {
    const [currency] = await db.select()
      .from(guildCurrencies)
      .where(eq(guildCurrencies.guildId, guildId))
      .limit(1);

    if (!currency) return;

    let amount = 0;
    switch (type) {
      case 'message': amount = currency.earnPerMessage; break;
      case 'reaction': amount = currency.earnPerReaction; break;
      case 'voice_minute': amount = currency.earnPerVoiceMinute; break;
    }

    if (amount <= 0) return;

    await db.insert(guildCurrencyBalances)
      .values({ guildId, userId, balance: amount, lifetimeEarned: amount })
      .onConflictDoUpdate({
        target: [guildCurrencyBalances.guildId, guildCurrencyBalances.userId],
        set: {
          balance: sql`${guildCurrencyBalances.balance} + ${amount}`,
          lifetimeEarned: sql`${guildCurrencyBalances.lifetimeEarned} + ${amount}`,
          updatedAt: new Date(),
        },
      });
  } catch (err) {
    logger.error('[guild-currency] earn error:', err);
  }
}
