/**
 * routes/economy.ts — Express router for economy endpoints.
 *
 * Endpoints:
 *   GET  /economy/wallet        — Get user's wallet (auto-creates with 1000 starting balance)
 *   GET  /economy/ledger        — Transaction history
 *   POST /economy/rewards/claim — Claim a reward (daily_checkin, chat_message, server_engagement)
 *   POST /economy/spend         — Spend currency
 */

import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { eq, desc, sql, and, gte } from 'drizzle-orm';

import { db } from '../db/index';
import { userWallets } from '../db/schema/economy';
import { economyLedger } from '../db/schema/economy';
import { requireAuth } from '../middleware/auth';

export const economyRouter = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STARTING_BALANCE = 1000;
const DAILY_REWARD_AMOUNT = 100;
const DAILY_REWARD_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get or create a wallet for the given user. New wallets start with
 * STARTING_BALANCE gratonites and a matching ledger entry.
 */
async function getOrCreateWallet(userId: string) {
  let [wallet] = await db
    .select()
    .from(userWallets)
    .where(eq(userWallets.userId, userId))
    .limit(1);

  if (!wallet) {
    const [created] = await db
      .insert(userWallets)
      .values({
        userId,
        balance: STARTING_BALANCE,
        lifetimeEarned: STARTING_BALANCE,
      })
      .returning();
    wallet = created;

    // Record the welcome bonus in the ledger
    await db.insert(economyLedger).values({
      userId,
      direction: 'earn',
      amount: STARTING_BALANCE,
      source: 'daily_checkin',
      description: 'Welcome bonus',
    });
  }

  return wallet;
}

function walletJson(w: typeof userWallets.$inferSelect) {
  return {
    userId: w.userId,
    balance: w.balance,
    lifetimeEarned: w.lifetimeEarned,
    lifetimeSpent: w.lifetimeSpent,
    updatedAt: w.updatedAt.toISOString(),
    lastDailyClaimAt: w.lastDailyClaimAt ? w.lastDailyClaimAt.toISOString() : null,
  };
}

function ledgerJson(e: typeof economyLedger.$inferSelect) {
  return {
    id: e.id,
    userId: e.userId,
    direction: e.direction,
    amount: e.amount,
    source: e.source,
    description: e.description,
    contextKey: e.contextKey,
    createdAt: e.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// GET /economy/wallet
// ---------------------------------------------------------------------------

economyRouter.get(
  '/wallet',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const wallet = await getOrCreateWallet(req.userId!);
      res.status(200).json(walletJson(wallet));
    } catch (err) {
      logger.error('[economy] getWallet error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /economy/ledger?limit=20
// ---------------------------------------------------------------------------

economyRouter.get(
  '/ledger',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 20, 1), 100);

      const entries = await db
        .select()
        .from(economyLedger)
        .where(eq(economyLedger.userId, req.userId!))
        .orderBy(desc(economyLedger.createdAt))
        .limit(limit);

      res.status(200).json(entries.map(ledgerJson));
    } catch (err) {
      logger.error('[economy] getLedger error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /economy/rewards/claim
// ---------------------------------------------------------------------------

economyRouter.post(
  '/rewards/claim',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { source, contextKey } = req.body as {
        source?: 'chat_message' | 'server_engagement' | 'daily_checkin';
        contextKey?: string;
      };

      if (!source) {
        res.status(400).json({ code: 'BAD_REQUEST', message: 'source is required' });
        return;
      }

      const wallet = await getOrCreateWallet(req.userId!);

      // Determine reward amount by source
      let rewardAmount = 0;
      let description = '';

      switch (source) {
        case 'daily_checkin': {
          // Enforce 24-hour cooldown
          if (wallet.lastDailyClaimAt) {
            const elapsed = Date.now() - wallet.lastDailyClaimAt.getTime();
            if (elapsed < DAILY_REWARD_COOLDOWN_MS) {
              const nextClaim = new Date(wallet.lastDailyClaimAt.getTime() + DAILY_REWARD_COOLDOWN_MS);
              res.status(200).json({
                wallet: walletJson(wallet),
                ledgerEntry: null,
                amount: 0,
                nextClaimAt: nextClaim.toISOString(),
              });
              return;
            }
          }
          rewardAmount = DAILY_REWARD_AMOUNT;
          description = 'Daily check-in reward';
          break;
        }
        case 'chat_message': {
          rewardAmount = 1;
          description = 'Chat message reward';
          break;
        }
        case 'server_engagement': {
          rewardAmount = 5;
          description = 'Server engagement reward';
          break;
        }
        default:
          res.status(400).json({ code: 'BAD_REQUEST', message: 'Invalid reward source' });
          return;
      }

      // Credit wallet
      const [updatedWallet] = await db
        .update(userWallets)
        .set({
          balance: wallet.balance + rewardAmount,
          lifetimeEarned: wallet.lifetimeEarned + rewardAmount,
          ...(source === 'daily_checkin' ? { lastDailyClaimAt: new Date() } : {}),
          updatedAt: new Date(),
        })
        .where(eq(userWallets.userId, req.userId!))
        .returning();

      // Ledger entry
      const [ledgerEntry] = await db
        .insert(economyLedger)
        .values({
          userId: req.userId!,
          direction: 'earn',
          amount: rewardAmount,
          source,
          description,
          contextKey: contextKey ?? null,
        })
        .returning();

      res.status(200).json({
        wallet: walletJson(updatedWallet),
        ledgerEntry: ledgerJson(ledgerEntry),
        amount: rewardAmount,
      });
    } catch (err) {
      logger.error('[economy] claimReward error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /economy/spend
// ---------------------------------------------------------------------------

economyRouter.post(
  '/spend',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { source, amount, description, contextKey } = req.body as {
        source?: string;
        amount?: number;
        description?: string;
        contextKey?: string;
      };

      if (!amount || amount <= 0) {
        res.status(400).json({ code: 'BAD_REQUEST', message: 'amount must be a positive integer' });
        return;
      }
      if (!description) {
        res.status(400).json({ code: 'BAD_REQUEST', message: 'description is required' });
        return;
      }

      // Ensure wallet exists before atomic deduct
      await getOrCreateWallet(req.userId!);

      // Atomic balance deduct: only succeeds if balance >= amount (prevents double-spend)
      const [updatedWallet] = await db
        .update(userWallets)
        .set({
          balance: sql`${userWallets.balance} - ${amount}`,
          lifetimeSpent: sql`${userWallets.lifetimeSpent} + ${amount}`,
          updatedAt: new Date(),
        })
        .where(and(eq(userWallets.userId, req.userId!), gte(userWallets.balance, amount)))
        .returning();

      if (!updatedWallet) {
        res.status(400).json({ code: 'INSUFFICIENT_BALANCE', message: 'Not enough currency' });
        return;
      }

      const [ledgerEntry] = await db
        .insert(economyLedger)
        .values({
          userId: req.userId!,
          direction: 'spend',
          amount,
          source: source ?? 'shop_purchase',
          description,
          contextKey: contextKey ?? null,
        })
        .returning();

      res.status(200).json({
        wallet: walletJson(updatedWallet),
        ledgerEntry: ledgerJson(ledgerEntry),
      });
    } catch (err) {
      logger.error('[economy] spend error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);
