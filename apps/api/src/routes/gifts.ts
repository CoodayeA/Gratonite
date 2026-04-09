import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { eq, and, desc, sql, gte } from 'drizzle-orm';

import { db } from '../db/index';
import { giftTransactions } from '../db/schema/gift-transactions';
import { users } from '../db/schema/users';
import { serverBoosts } from '../db/schema/server-boosts';
import { requireAuth } from '../middleware/auth';

export const giftsRouter = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

const GIFT_TYPES = ['server_boost', 'premium_month', 'premium_year', 'coins'] as const;

const GIFT_COSTS: Record<string, number> = {
  server_boost: 500,
  premium_month: 1000,
  premium_year: 10000,
  coins: 0, // cost is the quantity itself
};

const createGiftSchema = z.object({
  recipientId: z.string().uuid(),
  giftType: z.enum(GIFT_TYPES),
  guildId: z.string().uuid().optional(),
  quantity: z.number().int().min(1).max(100).default(1),
  message: z.string().max(500).optional(),
});

/**
 * POST /gifts — Create a gift for another user.
 */
giftsRouter.post('/', requireAuth, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parseResult = createGiftSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Validation failed', details: parseResult.error.issues });
    return;
  }

  const { recipientId, giftType, guildId, quantity, message } = parseResult.data;

  if (recipientId === req.userId) {
    res.status(400).json({ code: 'CANNOT_GIFT_SELF', message: 'You cannot gift yourself' });
    return;
  }

  // Check recipient exists
  const [recipient] = await db.select({ id: users.id }).from(users).where(eq(users.id, recipientId)).limit(1);
  if (!recipient) {
    res.status(404).json({ code: 'USER_NOT_FOUND', message: 'Recipient not found' });
    return;
  }

  // Calculate cost
  let coinsCost: number;
  if (giftType === 'coins') {
    coinsCost = quantity; // gifting coins costs the coins themselves
  } else {
    coinsCost = GIFT_COSTS[giftType] * quantity;
  }

  // Check sender has enough coins
  const [sender] = await db.select({ coins: users.coins }).from(users).where(eq(users.id, req.userId!)).limit(1);
  if (!sender || (sender.coins ?? 0) < coinsCost) {
    res.status(400).json({ code: 'INSUFFICIENT_COINS', message: 'Not enough coins' });
    return;
  }

  // Atomic check + deduct coins (prevents race condition / negative balance)
  const [deducted] = await db.update(users)
    .set({ coins: sql`coins - ${coinsCost}` } as any)
    .where(and(eq(users.id, req.userId!), gte(users.coins, coinsCost)))
    .returning({ coins: users.coins });
  if (!deducted) { res.status(400).json({ code: 'INSUFFICIENT_COINS', message: 'Not enough coins' }); return; }

  // Generate redeem code
  const redeemCode = crypto.randomBytes(16).toString('hex');

  // Create gift
  const [gift] = await db.insert(giftTransactions).values({
    senderId: req.userId!,
    recipientId,
    giftType,
    guildId: giftType === 'server_boost' ? guildId : undefined,
    quantity,
    message,
    redeemCode,
    coinsCost,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  }).returning();

  res.status(201).json({
    id: gift.id,
    giftType: gift.giftType,
    recipientId: gift.recipientId,
    redeemCode: gift.redeemCode,
    status: gift.status,
    message: gift.message,
    createdAt: gift.createdAt.toISOString(),
  });
}));

/**
 * POST /gifts/redeem — Redeem a gift by code.
 */
giftsRouter.post('/redeem', requireAuth, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { code } = req.body as { code?: string };
  if (!code) {
    res.status(400).json({ code: 'MISSING_CODE', message: 'Redeem code is required' });
    return;
  }

  const [gift] = await db
    .select()
    .from(giftTransactions)
    .where(and(eq(giftTransactions.redeemCode, code), eq(giftTransactions.status, 'pending')))
    .limit(1);

  if (!gift) {
    res.status(404).json({ code: 'INVALID_CODE', message: 'Invalid or already redeemed gift code' });
    return;
  }

  if (gift.recipientId !== req.userId) {
    res.status(403).json({ code: 'NOT_RECIPIENT', message: 'This gift is not for you' });
    return;
  }

  if (gift.expiresAt && gift.expiresAt < new Date()) {
    await db.update(giftTransactions).set({ status: 'expired' }).where(eq(giftTransactions.id, gift.id));
    res.status(400).json({ code: 'GIFT_EXPIRED', message: 'This gift has expired' });
    return;
  }

  const redeemedAt = new Date();
  const boostExpiresAt = new Date(redeemedAt.getTime() + 30 * 24 * 60 * 60 * 1000);

  const redeemed = await db.transaction(async (tx) => {
    const [claimedGift] = await tx.update(giftTransactions)
      .set({ status: 'redeemed', redeemedAt })
      .where(and(eq(giftTransactions.id, gift.id), eq(giftTransactions.status, 'pending')))
      .returning();

    if (!claimedGift) {
      return null;
    }

    if (gift.giftType === 'coins') {
      await tx.update(users)
        .set({ coins: sql`coins + ${gift.quantity}` } as any)
        .where(eq(users.id, req.userId!));
    } else if (gift.giftType === 'server_boost' && gift.guildId) {
      for (let i = 0; i < gift.quantity; i++) {
        await tx.insert(serverBoosts).values({
          guildId: gift.guildId,
          userId: req.userId!,
          expiresAt: boostExpiresAt,
        });
      }
    } else if (gift.giftType === 'premium_month' || gift.giftType === 'premium_year') {
      const months = gift.giftType === 'premium_year' ? 12 * gift.quantity : gift.quantity;
      const premiumDuration = months * 30 * 24 * 60 * 60 * 1000;
      await tx.update(users).set({
        premiumUntil: new Date(redeemedAt.getTime() + premiumDuration),
      } as any).where(eq(users.id, req.userId!));
    }

    return claimedGift;
  });

  if (!redeemed) {
    res.status(409).json({ code: 'INVALID_CODE', message: 'Invalid or already redeemed gift code' });
    return;
  }

  res.json({
    message: 'Gift redeemed successfully',
    giftType: gift.giftType,
    quantity: gift.quantity,
    senderMessage: gift.message,
  });
}));

/**
 * GET /gifts/sent — List gifts sent by the current user.
 */
giftsRouter.get('/sent', requireAuth, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const gifts = await db
    .select({
      id: giftTransactions.id,
      recipientId: giftTransactions.recipientId,
      giftType: giftTransactions.giftType,
      quantity: giftTransactions.quantity,
      message: giftTransactions.message,
      status: giftTransactions.status,
      coinsCost: giftTransactions.coinsCost,
      createdAt: giftTransactions.createdAt,
      redeemedAt: giftTransactions.redeemedAt,
      recipientName: users.username,
      recipientAvatar: users.avatarHash,
    })
    .from(giftTransactions)
    .leftJoin(users, eq(giftTransactions.recipientId, users.id))
    .where(eq(giftTransactions.senderId, req.userId!))
    .orderBy(desc(giftTransactions.createdAt))
    .limit(50);

  res.json(gifts.map(g => ({
    ...g,
    createdAt: g.createdAt.toISOString(),
    redeemedAt: g.redeemedAt?.toISOString() ?? null,
  })));
}));

/**
 * GET /gifts/received — List gifts received by the current user.
 */
giftsRouter.get('/received', requireAuth, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const gifts = await db
    .select({
      id: giftTransactions.id,
      senderId: giftTransactions.senderId,
      giftType: giftTransactions.giftType,
      quantity: giftTransactions.quantity,
      message: giftTransactions.message,
      status: giftTransactions.status,
      redeemCode: giftTransactions.redeemCode,
      createdAt: giftTransactions.createdAt,
      redeemedAt: giftTransactions.redeemedAt,
      expiresAt: giftTransactions.expiresAt,
      senderName: users.username,
      senderAvatar: users.avatarHash,
    })
    .from(giftTransactions)
    .leftJoin(users, eq(giftTransactions.senderId, users.id))
    .where(eq(giftTransactions.recipientId, req.userId!))
    .orderBy(desc(giftTransactions.createdAt))
    .limit(50);

  res.json(gifts.map(g => ({
    ...g,
    createdAt: g.createdAt.toISOString(),
    redeemedAt: g.redeemedAt?.toISOString() ?? null,
    expiresAt: g.expiresAt?.toISOString() ?? null,
  })));
}));
