/**
 * routes/auctions.ts — Express router for auction endpoints.
 *
 * Endpoints:
 *   POST   /auctions              — Create an auction
 *   GET    /auctions              — List active auctions
 *   GET    /auctions/:id          — Single auction + bid history
 *   POST   /auctions/:id/bid      — Place a bid (atomic transaction)
 *   DELETE /auctions/:id          — Cancel auction (seller only, no bids)
 */

import { Router, Request, Response } from 'express';
import { eq, and, desc, asc, gt, sql } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '../db/index';
import { auctions, auctionBids } from '../db/schema/auctions';
import { cosmetics, userCosmetics } from '../db/schema/cosmetics';
import { userWallets, economyLedger } from '../db/schema/economy';
import { users } from '../db/schema/users';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';

export const auctionsRouter = Router();

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const createAuctionSchema = z.object({
  cosmeticId: z.string().uuid(),
  startingPrice: z.number().int().positive(),
  reservePrice: z.number().int().positive().optional(),
  durationHours: z.number().int().min(1).max(168),
});

const placeBidSchema = z.object({
  amount: z.number().int().positive(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function param(req: Request, key: string): string {
  const v = req.params[key];
  return typeof v === 'string' ? v : Array.isArray(v) ? v[0] : '';
}

function auctionJson(a: typeof auctions.$inferSelect) {
  return {
    id: a.id,
    cosmeticId: a.cosmeticId,
    sellerId: a.sellerId,
    startingPrice: a.startingPrice,
    reservePrice: a.reservePrice,
    currentBid: a.currentBid,
    currentBidderId: a.currentBidderId,
    endsAt: a.endsAt.toISOString(),
    status: a.status,
    createdAt: a.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// POST /auctions — Create auction
// ---------------------------------------------------------------------------

auctionsRouter.post(
  '/',
  requireAuth,
  validate(createAuctionSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { cosmeticId, startingPrice, reservePrice, durationHours } = req.body as z.infer<
        typeof createAuctionSchema
      >;
      const sellerId = req.userId!;

      // Verify seller owns the cosmetic
      const [ownership] = await db
        .select()
        .from(userCosmetics)
        .where(and(eq(userCosmetics.userId, sellerId), eq(userCosmetics.cosmeticId, cosmeticId)))
        .limit(1);

      if (!ownership) {
        res.status(403).json({ code: 'NOT_OWNED', message: 'You do not own this cosmetic' });
        return;
      }

      // Cosmetic must be published
      const [cosmetic] = await db
        .select()
        .from(cosmetics)
        .where(and(eq(cosmetics.id, cosmeticId), eq(cosmetics.isPublished, true)))
        .limit(1);

      if (!cosmetic) {
        res.status(400).json({ code: 'NOT_PUBLISHED', message: 'Cosmetic must be published to auction' });
        return;
      }

      // No active auction already exists for this cosmetic
      const [existingAuction] = await db
        .select({ id: auctions.id })
        .from(auctions)
        .where(and(eq(auctions.cosmeticId, cosmeticId), eq(auctions.status, 'active')))
        .limit(1);

      if (existingAuction) {
        res.status(409).json({
          code: 'AUCTION_EXISTS',
          message: 'An active auction already exists for this cosmetic',
        });
        return;
      }

      const endsAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);

      const [auction] = await db
        .insert(auctions)
        .values({
          cosmeticId,
          sellerId,
          startingPrice,
          reservePrice: reservePrice ?? null,
          status: 'active',
          endsAt,
        })
        .returning();

      res.status(201).json(auctionJson(auction));
    } catch (err) {
      console.error('[auctions] create error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /auctions — List active auctions
// ---------------------------------------------------------------------------

auctionsRouter.get(
  '/',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const typeFilter = req.query.type as string | undefined;
      const sort = (req.query.sort as string) || 'newest';
      const search = req.query.search as string | undefined;
      const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 50, 1), 100);
      const offset = Math.max(parseInt(req.query.offset as string, 10) || 0, 0);
      const now = new Date();

      // Escape special ILIKE characters to prevent SQL injection
      const escapedSearch = search ? search.replace(/[%_\\]/g, '\\$&') : '';
      
      const conditions = [
        eq(auctions.status, 'active'),
        gt(auctions.endsAt, now),
        ...(typeFilter ? [eq(cosmetics.type, typeFilter)] : []),
        ...(search ? [sql`${cosmetics.name} ilike ${'%' + escapedSearch + '%'}`] : []),
      ];

      const baseQuery = db
        .select({
          auction: auctions,
          cosmetic: {
            id: cosmetics.id,
            name: cosmetics.name,
            type: cosmetics.type,
            rarity: cosmetics.rarity,
            previewImageUrl: cosmetics.previewImageUrl,
            assetUrl: cosmetics.assetUrl,
          },
          seller: {
            id: users.id,
            username: users.username,
            displayName: users.displayName,
          },
        })
        .from(auctions)
        .innerJoin(cosmetics, eq(cosmetics.id, auctions.cosmeticId))
        .innerJoin(users, eq(users.id, auctions.sellerId))
        .where(and(...conditions));

      let rows;
      switch (sort) {
        case 'price-low':
          rows = await baseQuery.orderBy(asc(auctions.currentBid), asc(auctions.startingPrice)).limit(limit).offset(offset);
          break;
        case 'price-high':
          rows = await baseQuery.orderBy(desc(auctions.currentBid), desc(auctions.startingPrice)).limit(limit).offset(offset);
          break;
        case 'popular':
          rows = await baseQuery.orderBy(desc(auctions.currentBid)).limit(limit).offset(offset);
          break;
        default:
          rows = await baseQuery.orderBy(desc(auctions.createdAt)).limit(limit).offset(offset);
      }

      res.status(200).json(
        rows.map((r) => ({
          ...auctionJson(r.auction),
          cosmetic: r.cosmetic,
          seller: r.seller,
        })),
      );
    } catch (err) {
      console.error('[auctions] list error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /auctions/:id — Single auction + bid history
// ---------------------------------------------------------------------------

auctionsRouter.get(
  '/:id',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const auctionId = param(req, 'id');

      const [row] = await db
        .select({
          auction: auctions,
          cosmetic: cosmetics,
          seller: {
            id: users.id,
            username: users.username,
            displayName: users.displayName,
          },
        })
        .from(auctions)
        .innerJoin(cosmetics, eq(cosmetics.id, auctions.cosmeticId))
        .innerJoin(users, eq(users.id, auctions.sellerId))
        .where(eq(auctions.id, auctionId))
        .limit(1);

      if (!row) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Auction not found' });
        return;
      }

      const bids = await db
        .select({
          bid: auctionBids,
          bidder: {
            id: users.id,
            username: users.username,
            displayName: users.displayName,
          },
        })
        .from(auctionBids)
        .innerJoin(users, eq(users.id, auctionBids.bidderId))
        .where(eq(auctionBids.auctionId, auctionId))
        .orderBy(desc(auctionBids.amount));

      res.status(200).json({
        ...auctionJson(row.auction),
        cosmetic: row.cosmetic,
        seller: row.seller,
        bids: bids.map((b) => ({
          id: b.bid.id,
          amount: b.bid.amount,
          createdAt: b.bid.createdAt.toISOString(),
          bidder: b.bidder,
        })),
      });
    } catch (err) {
      console.error('[auctions] get error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /auctions/:id/bid — Place a bid (atomic)
// ---------------------------------------------------------------------------

auctionsRouter.post(
  '/:id/bid',
  requireAuth,
  validate(placeBidSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const auctionId = param(req, 'id');
      const bidderId = req.userId!;
      const { amount } = req.body as z.infer<typeof placeBidSchema>;
      const now = new Date();

      // Pre-flight checks before entering transaction
      const [auction] = await db
        .select()
        .from(auctions)
        .where(eq(auctions.id, auctionId))
        .limit(1);

      if (!auction) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Auction not found' });
        return;
      }

      if (auction.status !== 'active') {
        res.status(400).json({ code: 'AUCTION_NOT_ACTIVE', message: 'Auction is not active' });
        return;
      }

      if (auction.endsAt <= now) {
        res.status(400).json({ code: 'AUCTION_ENDED', message: 'Auction has ended' });
        return;
      }

      if (auction.sellerId === bidderId) {
        res.status(400).json({ code: 'SELLER_CANNOT_BID', message: 'You cannot bid on your own auction' });
        return;
      }

      const minimumBid = auction.currentBid !== null ? auction.currentBid + 1 : auction.startingPrice;
      if (amount < minimumBid) {
        res.status(400).json({ code: 'BID_TOO_LOW', message: `Bid must be at least ${minimumBid}` });
        return;
      }

      // Atomic transaction
      await db.transaction(async (tx) => {
        // Re-fetch inside tx
        const [txAuction] = await tx
          .select()
          .from(auctions)
          .where(eq(auctions.id, auctionId))
          .limit(1);

        if (!txAuction || txAuction.status !== 'active' || txAuction.endsAt <= now) {
          throw new Error('AUCTION_STATE_CHANGED');
        }

        const txMinBid = txAuction.currentBid !== null ? txAuction.currentBid + 1 : txAuction.startingPrice;
        if (amount < txMinBid) throw new Error('BID_TOO_LOW');

        // Get/create bidder wallet
        let [bidderWallet] = await tx
          .select()
          .from(userWallets)
          .where(eq(userWallets.userId, bidderId))
          .limit(1);

        if (!bidderWallet) {
          const [created] = await tx
            .insert(userWallets)
            .values({ userId: bidderId, balance: 0, lifetimeEarned: 0 })
            .returning();
          bidderWallet = created;
        }

        if (bidderWallet.balance < amount) throw new Error('INSUFFICIENT_BALANCE');

        // Deduct bidder
        await tx
          .update(userWallets)
          .set({
            balance: bidderWallet.balance - amount,
            lifetimeSpent: bidderWallet.lifetimeSpent + amount,
            updatedAt: new Date(),
          })
          .where(eq(userWallets.userId, bidderId));

        // Refund previous bidder
        if (txAuction.currentBidderId && txAuction.currentBid !== null) {
          const prevId = txAuction.currentBidderId;
          const prevAmount = txAuction.currentBid;

          let [prevWallet] = await tx
            .select()
            .from(userWallets)
            .where(eq(userWallets.userId, prevId))
            .limit(1);

          if (!prevWallet) {
            const [created] = await tx
              .insert(userWallets)
              .values({ userId: prevId, balance: 0, lifetimeEarned: 0 })
              .returning();
            prevWallet = created;
          }

          await tx
            .update(userWallets)
            .set({
              balance: prevWallet.balance + prevAmount,
              lifetimeEarned: prevWallet.lifetimeEarned + prevAmount,
              updatedAt: new Date(),
            })
            .where(eq(userWallets.userId, prevId));

          await tx.insert(economyLedger).values({
            userId: prevId,
            direction: 'earn',
            amount: prevAmount,
            source: 'auction_refund',
            description: `Outbid refund for auction ${auctionId}`,
            contextKey: auctionId,
          });
        }

        // Update auction state
        await tx
          .update(auctions)
          .set({ currentBid: amount, currentBidderId: bidderId })
          .where(eq(auctions.id, auctionId));

        // Record bid
        await tx.insert(auctionBids).values({ auctionId, bidderId, amount });

        // Ledger: bidder spend
        await tx.insert(economyLedger).values({
          userId: bidderId,
          direction: 'spend',
          amount,
          source: 'auction_bid',
          description: `Bid on auction ${auctionId}`,
          contextKey: auctionId,
        });
      });

      const [updatedAuction] = await db
        .select()
        .from(auctions)
        .where(eq(auctions.id, auctionId))
        .limit(1);

      res.status(200).json(auctionJson(updatedAuction!));
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === 'INSUFFICIENT_BALANCE') {
          res.status(400).json({ code: 'INSUFFICIENT_BALANCE', message: 'Not enough currency to place this bid' });
          return;
        }
        if (err.message === 'BID_TOO_LOW') {
          res.status(400).json({ code: 'BID_TOO_LOW', message: 'Your bid is too low' });
          return;
        }
        if (err.message === 'AUCTION_STATE_CHANGED') {
          res.status(409).json({ code: 'AUCTION_STATE_CHANGED', message: 'Auction state changed; please retry' });
          return;
        }
      }
      console.error('[auctions] bid error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /auctions/:id — Cancel auction (seller only, no bids placed)
// ---------------------------------------------------------------------------

auctionsRouter.delete(
  '/:id',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const auctionId = param(req, 'id');
      const sellerId = req.userId!;

      const [auction] = await db
        .select()
        .from(auctions)
        .where(eq(auctions.id, auctionId))
        .limit(1);

      if (!auction) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Auction not found' });
        return;
      }

      if (auction.sellerId !== sellerId) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'Only the seller can cancel this auction' });
        return;
      }

      if (auction.status !== 'active') {
        res.status(400).json({ code: 'AUCTION_NOT_ACTIVE', message: 'Only active auctions can be cancelled' });
        return;
      }

      if (auction.currentBid !== null) {
        res.status(400).json({ code: 'BIDS_EXIST', message: 'Cannot cancel an auction that has bids' });
        return;
      }

      const [updated] = await db
        .update(auctions)
        .set({ status: 'cancelled' })
        .where(eq(auctions.id, auctionId))
        .returning();

      res.status(200).json(auctionJson(updated));
    } catch (err) {
      console.error('[auctions] cancel error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);
