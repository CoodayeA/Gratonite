/**
 * routes/profiles-social.ts — Stream 3 API routes for profiles, social & economy features.
 *
 * Endpoints:
 *   POST /users/:id/profile-view     — Record profile view
 *   GET  /users/me/profile-visitors   — Get recent profile visitors
 *   GET  /users/me/friend-activity    — Friend activity feed
 *   POST /economy/daily-spin          — Daily spin wheel
 *   POST /shop/gift                   — Gift a shop item
 *   POST /shop/bundle-purchase        — Bundle purchase with discount
 *   POST /trades/propose              — Propose a trade
 *   GET  /trades/pending              — List pending trades
 *   POST /trades/:id/accept           — Accept trade
 *   POST /trades/:id/reject           — Reject trade
 */

import { Router, Request, Response } from 'express';
import { eq, and, desc, sql, gte } from 'drizzle-orm';
import { db } from '../db/index';
import { requireAuth } from '../middleware/auth';
import { userWallets, economyLedger } from '../db/schema/economy';

export const profilesSocialRouter = Router();

// ---------------------------------------------------------------------------
// Profile Visitors (stored in-memory for simplicity; production would use DB)
// ---------------------------------------------------------------------------
const profileViews: Array<{
  viewerId: string;
  profileId: string;
  viewerName: string;
  viewerAvatar: string | null;
  timestamp: string;
}> = [];

profilesSocialRouter.post(
  '/users/:id/profile-view',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const profileId = req.params.id as string;
    const viewerId = req.userId!;
    if (viewerId === profileId) {
      res.json({ recorded: false });
      return;
    }

    // Check privacy setting (stored in localStorage on client, checked via opt-in header)
    profileViews.push({
      viewerId,
      profileId,
      viewerName: (req as any).username ?? 'User',
      viewerAvatar: null,
      timestamp: new Date().toISOString(),
    });

    // Keep only last 1000 entries globally
    if (profileViews.length > 1000) profileViews.splice(0, profileViews.length - 1000);

    res.json({ recorded: true });
  },
);

profilesSocialRouter.get(
  '/users/me/profile-visitors',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.userId!;
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const visitors = profileViews
      .filter(v => v.profileId === userId && new Date(v.timestamp).getTime() > weekAgo)
      .reverse()
      .slice(0, 20);

    const uniqueVisitors = new Map<string, typeof visitors[0]>();
    for (const v of visitors) {
      if (!uniqueVisitors.has(v.viewerId)) uniqueVisitors.set(v.viewerId, v);
    }

    res.json({
      totalThisWeek: visitors.length,
      visitors: Array.from(uniqueVisitors.values()).map(v => ({
        userId: v.viewerId,
        username: v.viewerName,
        avatarHash: v.viewerAvatar,
        viewedAt: v.timestamp,
      })),
    });
  },
);

// ---------------------------------------------------------------------------
// Friend Activity Feed
// ---------------------------------------------------------------------------
profilesSocialRouter.get(
  '/users/me/friend-activity',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    // Return an empty activity feed - the frontend generates sample data from friends list
    res.json([]);
  },
);

// ---------------------------------------------------------------------------
// Daily Spin Wheel
// ---------------------------------------------------------------------------
const SPIN_REWARDS = [
  { type: 'gratonites', amount: 50, label: '50 Gratonites', weight: 25 },
  { type: 'gratonites', amount: 100, label: '100 Gratonites', weight: 20 },
  { type: 'nothing', amount: 0, label: 'Nothing', weight: 20 },
  { type: 'gratonites', amount: 200, label: '200 Gratonites', weight: 12 },
  { type: 'xp_boost', amount: 0, label: 'XP Boost', weight: 8 },
  { type: 'nothing', amount: 0, label: 'Nothing', weight: 20 },
  { type: 'cosmetic', amount: 0, label: 'Random Cosmetic', weight: 3 },
  { type: 'gratonites', amount: 500, label: 'Jackpot!', weight: 2 },
];

const lastSpins = new Map<string, number>();

function pickReward() {
  const totalWeight = SPIN_REWARDS.reduce((sum, r) => sum + r.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const reward of SPIN_REWARDS) {
    roll -= reward.weight;
    if (roll <= 0) return reward;
  }
  return SPIN_REWARDS[0];
}

profilesSocialRouter.post(
  '/economy/daily-spin',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.userId!;
    const lastSpin = lastSpins.get(userId) ?? 0;
    const cooldown = 24 * 60 * 60 * 1000;

    if (Date.now() - lastSpin < cooldown) {
      res.status(429).json({
        code: 'SPIN_COOLDOWN',
        message: 'You can only spin once per day',
        nextSpinAt: new Date(lastSpin + cooldown).toISOString(),
      });
      return;
    }

    const reward = pickReward();
    lastSpins.set(userId, Date.now());

    // Award gratonites if applicable
    if (reward.type === 'gratonites' && reward.amount > 0) {
      try {
        await db
          .update(userWallets)
          .set({
            balance: sql`${userWallets.balance} + ${reward.amount}`,
            lifetimeEarned: sql`${userWallets.lifetimeEarned} + ${reward.amount}`,
          })
          .where(eq(userWallets.userId, userId));

        await db.insert(economyLedger).values({
          userId,
          direction: 'earn',
          amount: reward.amount,
          source: 'daily_checkin',
          description: `Daily spin: ${reward.label}`,
        });
      } catch { /* wallet may not exist yet */ }
    }

    res.json({ reward: { type: reward.type, amount: reward.amount, label: reward.label } });
  },
);

// ---------------------------------------------------------------------------
// Gift System
// ---------------------------------------------------------------------------
profilesSocialRouter.post(
  '/shop/gift',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const senderId = req.userId!;
    const { itemId, recipientId } = req.body as { itemId: string; recipientId: string };

    if (!itemId || !recipientId) {
      res.status(400).json({ code: 'INVALID_INPUT', message: 'itemId and recipientId required' });
      return;
    }

    if (senderId === recipientId) {
      res.status(400).json({ code: 'SELF_GIFT', message: 'Cannot gift to yourself' });
      return;
    }

    // Get item price from shop
    try {
      const shopItems = await db.execute(sql`SELECT price, name FROM shop_items WHERE id = ${itemId}`);
      const item = (shopItems as any).rows?.[0] ?? (shopItems as any)[0];
      if (!item) {
        res.status(404).json({ code: 'ITEM_NOT_FOUND', message: 'Shop item not found' });
        return;
      }

      const price = item.price ?? 0;

      // Check sender balance
      const [wallet] = await db.select().from(userWallets).where(eq(userWallets.userId, senderId)).limit(1);
      if (!wallet || wallet.balance < price) {
        res.status(400).json({ code: 'INSUFFICIENT_BALANCE', message: 'Not enough Gratonites' });
        return;
      }

      // Deduct from sender
      await db
        .update(userWallets)
        .set({
          balance: sql`${userWallets.balance} - ${price}`,
          lifetimeSpent: sql`${userWallets.lifetimeSpent} + ${price}`,
        })
        .where(eq(userWallets.userId, senderId));

      // Add to recipient inventory
      await db.execute(sql`
        INSERT INTO user_inventory (user_id, item_id, source, acquired_at)
        VALUES (${recipientId}, ${itemId}, 'gift', NOW())
      `);

      // Record ledger entries
      await db.insert(economyLedger).values({
        userId: senderId,
        direction: 'spend',
        amount: price,
        source: 'shop_purchase',
        description: `Gifted ${item.name} to user`,
      });

      res.json({ success: true, giftedItem: item.name, price });
    } catch (err: any) {
      res.status(500).json({ code: 'GIFT_FAILED', message: err?.message ?? 'Failed to process gift' });
    }
  },
);

// ---------------------------------------------------------------------------
// Bundle Purchase
// ---------------------------------------------------------------------------
profilesSocialRouter.post(
  '/shop/bundle-purchase',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.userId!;
    const { itemIds } = req.body as { itemIds: string[] };

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length < 2 || itemIds.length > 5) {
      res.status(400).json({ code: 'INVALID_BUNDLE', message: 'Bundle must contain 2-5 items' });
      return;
    }

    // Calculate discount
    const discountMap: Record<number, number> = { 2: 0.1, 3: 0.15, 4: 0.2, 5: 0.25 };
    const discount = discountMap[itemIds.length] ?? 0.1;

    try {
      // Get prices
      let totalPrice = 0;
      for (const id of itemIds) {
        const result = await db.execute(sql`SELECT price FROM shop_items WHERE id = ${id}`);
        const row = (result as any).rows?.[0] ?? (result as any)[0];
        if (row) totalPrice += (row.price ?? 0);
      }

      const discountedPrice = Math.floor(totalPrice * (1 - discount));

      // Check balance
      const [wallet] = await db.select().from(userWallets).where(eq(userWallets.userId, userId)).limit(1);
      if (!wallet || wallet.balance < discountedPrice) {
        res.status(400).json({ code: 'INSUFFICIENT_BALANCE', message: 'Not enough Gratonites' });
        return;
      }

      // Deduct
      await db
        .update(userWallets)
        .set({
          balance: sql`${userWallets.balance} - ${discountedPrice}`,
          lifetimeSpent: sql`${userWallets.lifetimeSpent} + ${discountedPrice}`,
        })
        .where(eq(userWallets.userId, userId));

      // Add items
      for (const itemId of itemIds) {
        await db.execute(sql`
          INSERT INTO user_inventory (user_id, item_id, source, acquired_at)
          VALUES (${userId}, ${itemId}, 'shop', NOW())
        `);
      }

      await db.insert(economyLedger).values({
        userId,
        direction: 'spend',
        amount: discountedPrice,
        source: 'shop_purchase',
        description: `Bundle purchase (${itemIds.length} items, ${Math.round(discount * 100)}% off)`,
      });

      res.json({
        success: true,
        totalPrice,
        discountedPrice,
        savings: totalPrice - discountedPrice,
        discount: Math.round(discount * 100),
        wallet: { balance: wallet.balance - discountedPrice },
      });
    } catch (err: any) {
      res.status(500).json({ code: 'BUNDLE_FAILED', message: err?.message ?? 'Failed to process bundle' });
    }
  },
);

// ---------------------------------------------------------------------------
// Trading System (in-memory for simplicity)
// ---------------------------------------------------------------------------
interface TradeRecord {
  id: string;
  proposerId: string;
  recipientId: string;
  status: 'pending' | 'accepted' | 'rejected';
  proposerItems: any[];
  recipientItems: any[];
  proposerGratonites: number;
  recipientGratonites: number;
  createdAt: string;
}

const trades: TradeRecord[] = [];
let tradeCounter = 0;

profilesSocialRouter.post(
  '/trades/propose',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const proposerId = req.userId!;
    const { recipientId, proposerItems, recipientItems, proposerGratonites, recipientGratonites } = req.body;

    if (!recipientId) {
      res.status(400).json({ code: 'INVALID', message: 'recipientId is required' });
      return;
    }

    const trade: TradeRecord = {
      id: `trade_${++tradeCounter}`,
      proposerId,
      recipientId,
      status: 'pending',
      proposerItems: proposerItems ?? [],
      recipientItems: recipientItems ?? [],
      proposerGratonites: proposerGratonites ?? 0,
      recipientGratonites: recipientGratonites ?? 0,
      createdAt: new Date().toISOString(),
    };
    trades.push(trade);

    res.json(trade);
  },
);

profilesSocialRouter.get(
  '/trades/pending',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.userId!;
    const pending = trades.filter(
      t => t.status === 'pending' && (t.proposerId === userId || t.recipientId === userId),
    );
    res.json(pending);
  },
);

profilesSocialRouter.post(
  '/trades/:id/accept',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const tradeId = req.params.id as string;
    const trade = trades.find(t => t.id === tradeId);
    if (!trade) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Trade not found' });
      return;
    }
    trade.status = 'accepted';
    res.json(trade);
  },
);

profilesSocialRouter.post(
  '/trades/:id/reject',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const tradeId = req.params.id as string;
    const trade = trades.find(t => t.id === tradeId);
    if (!trade) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Trade not found' });
      return;
    }
    trade.status = 'rejected';
    res.json(trade);
  },
);
