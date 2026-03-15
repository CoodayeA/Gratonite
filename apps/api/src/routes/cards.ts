import { Router, Request, Response } from 'express';
import { eq, and, sql, inArray, gte } from 'drizzle-orm';
import { db } from '../db/index';
import { collectibleCards, cardPacks, userCards, cardTrades, cardTradeItems } from '../db/schema/collectible-cards';
import { users } from '../db/schema/users';
import { requireAuth } from '../middleware/auth';
import { logger } from '../lib/logger';

export const cardsRouter = Router();

// ---------------------------------------------------------------------------
// GET /collection — user's card collection with ownership info
// ---------------------------------------------------------------------------
cardsRouter.get('/collection', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    // Get all cards
    const allCards = await db.select().from(collectibleCards);

    // Get user's owned card IDs (with counts)
    const owned = await db
      .select({ cardId: userCards.cardId, count: sql<number>`count(*)::int` })
      .from(userCards)
      .where(eq(userCards.userId, userId))
      .groupBy(userCards.cardId);

    const ownedMap = new Map(owned.map(o => [o.cardId, o.count]));

    const collection = allCards.map(card => ({
      id: card.id,
      name: card.name,
      image: card.image,
      rarity: card.rarity,
      series: card.series,
      description: card.description,
      owned: ownedMap.has(card.id),
      count: ownedMap.get(card.id) ?? 0,
    }));

    res.json(collection);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load collection' });
  }
});

// ---------------------------------------------------------------------------
// GET /packs — available card packs
// ---------------------------------------------------------------------------
cardsRouter.get('/packs', requireAuth, async (_req: Request, res: Response): Promise<void> => {
  try {
    const packs = await db
      .select()
      .from(cardPacks)
      .where(eq(cardPacks.available, true));
    res.json(packs);
  } catch (err) {
    logger.debug({ msg: 'failed to load card packs', err });
    res.status(500).json({ error: 'Failed to load packs' });
  }
});

// ---------------------------------------------------------------------------
// POST /open-pack — purchase and open a card pack
// ---------------------------------------------------------------------------
cardsRouter.post('/open-pack', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { packId } = req.body;
    if (!packId) { res.status(400).json({ error: 'packId required' }); return; }

    // Get the pack
    const [pack] = await db.select().from(cardPacks).where(eq(cardPacks.id, packId)).limit(1);
    if (!pack || !pack.available) { res.status(404).json({ error: 'Pack not found' }); return; }

    // Atomic check + deduct coins (prevents race condition / negative balance)
    const [deducted] = await db.update(users)
      .set({ coins: sql`coins - ${pack.price}` })
      .where(and(eq(users.id, userId), gte(users.coins, pack.price)))
      .returning({ coins: users.coins });
    if (!deducted) { res.status(400).json({ error: 'Insufficient coins' }); return; }

    // Get eligible cards (by series if pack has one)
    const cardsQuery = pack.series
      ? db.select().from(collectibleCards).where(eq(collectibleCards.series, pack.series))
      : db.select().from(collectibleCards);
    const eligibleCards = await cardsQuery;

    if (eligibleCards.length === 0) {
      // Refund if no cards exist
      await db.update(users).set({ coins: sql`coins + ${pack.price}` }).where(eq(users.id, userId));
      res.status(500).json({ error: 'No cards available in this pack' }); return;
    }

    // Weighted random selection
    const weights = (pack.rarityWeights as Record<string, number>) ?? { common: 0.40, uncommon: 0.30, rare: 0.20, epic: 0.08, legendary: 0.02 };

    const pickCard = (forceRarity?: string) => {
      let rarity: string;
      if (forceRarity) {
        rarity = forceRarity;
      } else {
        const roll = Math.random();
        let cumulative = 0;
        rarity = 'common';
        for (const [r, w] of Object.entries(weights)) {
          cumulative += (w as number);
          if (roll < cumulative) { rarity = r; break; }
        }
      }
      const pool = eligibleCards.filter(c => c.rarity === rarity);
      if (pool.length === 0) return eligibleCards[Math.floor(Math.random() * eligibleCards.length)];
      return pool[Math.floor(Math.random() * pool.length)];
    };

    const pulledCards = [];
    for (let i = 0; i < pack.cardsCount; i++) {
      // First card gets guaranteed rarity if set
      const card = i === 0 && pack.guaranteedRarity ? pickCard(pack.guaranteedRarity) : pickCard();
      pulledCards.push(card);
    }

    // Insert into user_cards
    const insertValues = pulledCards.map(card => ({
      userId,
      cardId: card.id,
      obtainedVia: 'pack' as const,
    }));
    await db.insert(userCards).values(insertValues);

    res.json({
      cards: pulledCards.map(c => ({
        id: c.id,
        name: c.name,
        image: c.image,
        rarity: c.rarity,
        series: c.series,
        description: c.description,
      })),
      coinsSpent: pack.price,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to open pack' });
  }
});

// ---------------------------------------------------------------------------
// POST /trade — propose a trade to another user
// ---------------------------------------------------------------------------
cardsRouter.post('/trade', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const fromUserId = req.userId!;
    const { toUserId, offerCardIds, requestCardIds } = req.body;

    if (!toUserId || !Array.isArray(offerCardIds) || offerCardIds.length === 0) {
      res.status(400).json({ error: 'toUserId and offerCardIds required' }); return;
    }
    if (fromUserId === toUserId) {
      res.status(400).json({ error: 'Cannot trade with yourself' }); return;
    }

    // Verify ownership of offered cards
    const offeredCards = await db.select().from(userCards)
      .where(and(eq(userCards.userId, fromUserId), inArray(userCards.id, offerCardIds)));
    if (offeredCards.length !== offerCardIds.length) {
      res.status(400).json({ error: 'You do not own all offered cards' }); return;
    }

    // Verify target user owns requested cards (if any)
    if (requestCardIds && requestCardIds.length > 0) {
      const requestedCards = await db.select().from(userCards)
        .where(and(eq(userCards.userId, toUserId), inArray(userCards.id, requestCardIds)));
      if (requestedCards.length !== requestCardIds.length) {
        res.status(400).json({ error: 'Target user does not own all requested cards' }); return;
      }
    }

    // Create trade
    const [trade] = await db.insert(cardTrades).values({
      fromUserId,
      toUserId,
    }).returning();

    // Add trade items
    const items = [
      ...offerCardIds.map((id: string) => ({ tradeId: trade.id, userCardId: id, direction: 'offer' })),
      ...(requestCardIds ?? []).map((id: string) => ({ tradeId: trade.id, userCardId: id, direction: 'request' })),
    ];
    if (items.length > 0) {
      await db.insert(cardTradeItems).values(items);
    }

    res.status(201).json({ tradeId: trade.id, status: 'pending' });
  } catch (err) {
    logger.debug({ msg: 'failed to create trade', err });
    res.status(500).json({ error: 'Failed to create trade' });
  }
});

// ---------------------------------------------------------------------------
// POST /trade/:tradeId/accept — accept a pending trade
// ---------------------------------------------------------------------------
cardsRouter.post('/trade/:tradeId/accept', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const tradeId = req.params.tradeId as string;

    const [trade] = await db.select().from(cardTrades).where(eq(cardTrades.id, tradeId)).limit(1);
    if (!trade || trade.status !== 'pending') {
      res.status(404).json({ error: 'Trade not found or not pending' }); return;
    }
    if (trade.toUserId !== userId) {
      res.status(403).json({ error: 'Not authorized to accept this trade' }); return;
    }

    // Get trade items
    const items = await db.select().from(cardTradeItems).where(eq(cardTradeItems.tradeId, tradeId));

    // Transfer offered cards (from → to)
    const offerIds = items.filter(i => i.direction === 'offer').map(i => i.userCardId);
    if (offerIds.length > 0) {
      await db.update(userCards).set({ userId: trade.toUserId, obtainedVia: 'trade' })
        .where(inArray(userCards.id, offerIds));
    }

    // Transfer requested cards (to → from)
    const requestIds = items.filter(i => i.direction === 'request').map(i => i.userCardId);
    if (requestIds.length > 0) {
      await db.update(userCards).set({ userId: trade.fromUserId, obtainedVia: 'trade' })
        .where(inArray(userCards.id, requestIds));
    }

    // Mark trade as accepted
    await db.update(cardTrades)
      .set({ status: 'accepted', resolvedAt: new Date() })
      .where(eq(cardTrades.id, tradeId));

    res.json({ status: 'accepted' });
  } catch (err) {
    logger.debug({ msg: 'failed to accept trade', err });
    res.status(500).json({ error: 'Failed to accept trade' });
  }
});

// ---------------------------------------------------------------------------
// POST /trade/:tradeId/decline — decline a pending trade
// ---------------------------------------------------------------------------
cardsRouter.post('/trade/:tradeId/decline', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const tradeId = req.params.tradeId as string;

    const [trade] = await db.select().from(cardTrades).where(eq(cardTrades.id, tradeId)).limit(1);
    if (!trade || trade.status !== 'pending') {
      res.status(404).json({ error: 'Trade not found or not pending' }); return;
    }
    if (trade.toUserId !== userId && trade.fromUserId !== userId) {
      res.status(403).json({ error: 'Not authorized' }); return;
    }

    await db.update(cardTrades)
      .set({ status: 'declined', resolvedAt: new Date() })
      .where(eq(cardTrades.id, tradeId));

    res.json({ status: 'declined' });
  } catch (err) {
    logger.debug({ msg: 'failed to decline trade', err });
    res.status(500).json({ error: 'Failed to decline trade' });
  }
});

// ---------------------------------------------------------------------------
// GET /trades — list pending trades for the user
// ---------------------------------------------------------------------------
cardsRouter.get('/trades', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    const trades = await db
      .select()
      .from(cardTrades)
      .where(
        and(
          eq(cardTrades.status, 'pending'),
          sql`(${cardTrades.fromUserId} = ${userId} OR ${cardTrades.toUserId} = ${userId})`,
        ),
      );

    res.json(trades);
  } catch (err) {
    logger.debug({ msg: 'failed to load trades', err });
    res.status(500).json({ error: 'Failed to load trades' });
  }
});
