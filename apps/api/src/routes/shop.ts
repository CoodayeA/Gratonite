/**
 * routes/shop.ts — Express router for shop endpoints.
 *
 * Endpoints:
 *   GET  /shop/items      — List all available shop items
 *   GET  /shop/inventory  — Get the authenticated user's inventory
 *   POST /shop/purchase   — Purchase an item (body: { itemId })
 */

import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { eq, and, sql, gte } from 'drizzle-orm';

import { db } from '../db/index';
import { shopItems, userInventory, userSoundboard, shopPurchaseRequests } from '../db/schema/shop';
import { userWallets } from '../db/schema/economy';
import { economyLedger } from '../db/schema/economy';
import { requireAuth } from '../middleware/auth';
import { cacheControl } from '../middleware/cache';

export const shopRouter = Router();

async function getInventoryVersion(userId: string): Promise<number> {
  const [inventoryCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userInventory)
    .where(eq(userInventory.userId, userId));
  const [soundboardCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userSoundboard)
    .where(eq(userSoundboard.userId, userId));

  return (inventoryCount?.count ?? 0) + (soundboardCount?.count ?? 0);
}

// ---------------------------------------------------------------------------
// GET /shop/items — List available shop items
// ---------------------------------------------------------------------------

shopRouter.get(
  '/items',
  requireAuth,
  cacheControl(300),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const items = await db
        .select()
        .from(shopItems)
        .where(eq(shopItems.available, true));

      res.status(200).json(items.map((i) => ({
        id: i.id,
        name: i.name,
        description: i.description,
        price: i.price,
        category: i.category,
        imageUrl: i.imageUrl,
        rarity: i.rarity,
        available: i.available,
        type: i.type,
        assetUrl: i.assetUrl,
        assetConfig: i.assetConfig,
        duration: i.duration,
        metadata: i.metadata,
        createdAt: i.createdAt.toISOString(),
      })));
    } catch (err) {
      logger.error('[shop] getItems error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /shop/inventory — Get user's inventory
// ---------------------------------------------------------------------------

shopRouter.get(
  '/inventory',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const rows = await db
        .select({
          id: userInventory.id,
          userId: userInventory.userId,
          itemId: userInventory.itemId,
          acquiredAt: userInventory.acquiredAt,
          itemName: shopItems.name,
          itemDescription: shopItems.description,
          itemCategory: shopItems.category,
          itemImageUrl: shopItems.imageUrl,
          itemRarity: shopItems.rarity,
        })
        .from(userInventory)
        .innerJoin(shopItems, eq(shopItems.id, userInventory.itemId))
        .where(eq(userInventory.userId, req.userId!));

      res.status(200).json(rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        itemId: r.itemId,
        acquiredAt: r.acquiredAt.toISOString(),
        item: {
          name: r.itemName,
          description: r.itemDescription,
          category: r.itemCategory,
          imageUrl: r.itemImageUrl,
          rarity: r.itemRarity,
        },
      })));
    } catch (err) {
      logger.error('[shop] getInventory error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /shop/purchase — Purchase an item
// ---------------------------------------------------------------------------

shopRouter.post(
  '/purchase',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { itemId, idempotencyKey } = req.body as { itemId?: string; idempotencyKey?: string };
      if (!itemId) {
        res.status(400).json({ code: 'BAD_REQUEST', message: 'itemId is required' });
        return;
      }
      const userId = req.userId!;

      if (idempotencyKey && idempotencyKey.length > 128) {
        res.status(400).json({ code: 'BAD_REQUEST', message: 'idempotencyKey must be <= 128 characters' });
        return;
      }

      if (idempotencyKey) {
        const [existingRequest] = await db
          .select({ responseJson: shopPurchaseRequests.responseJson, itemId: shopPurchaseRequests.itemId })
          .from(shopPurchaseRequests)
          .where(and(eq(shopPurchaseRequests.userId, userId), eq(shopPurchaseRequests.idempotencyKey, idempotencyKey)))
          .limit(1);
        if (existingRequest) {
          if (existingRequest.itemId !== itemId) {
            res.status(409).json({ code: 'IDEMPOTENCY_CONFLICT', message: 'idempotencyKey already used for a different item' });
            return;
          }
          res.status(200).json(existingRequest.responseJson);
          return;
        }
      }

      // Fetch item
      const [item] = await db
        .select()
        .from(shopItems)
        .where(and(eq(shopItems.id, itemId), eq(shopItems.available, true)))
        .limit(1);

      if (!item) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Item not found or unavailable' });
        return;
      }

      // Soundboard items are single-owned. Reject duplicate purchase attempts
      // before any wallet mutation so users are never charged on conflict.
      if (item.type === 'soundboard') {
        const [alreadyOwned] = await db
          .select({ id: userSoundboard.id })
          .from(userSoundboard)
          .where(and(eq(userSoundboard.userId, userId), eq(userSoundboard.itemId, item.id)))
          .limit(1);
        if (alreadyOwned) {
          res.status(400).json({ code: 'ALREADY_OWNED', message: 'You already own this sound' });
          return;
        }
      }

      // Ensure wallet exists
      let [wallet] = await db
        .select()
        .from(userWallets)
        .where(eq(userWallets.userId, userId))
        .limit(1);

      if (!wallet) {
        const [created] = await db
          .insert(userWallets)
          .values({ userId, balance: 1000, lifetimeEarned: 1000 })
          .returning();
        wallet = created;
      }

      // Atomic balance deduct: only succeeds if balance >= price (prevents double-spend)
      const [updatedWallet] = await db
        .update(userWallets)
        .set({
          balance: sql`${userWallets.balance} - ${item.price}`,
          lifetimeSpent: sql`${userWallets.lifetimeSpent} + ${item.price}`,
          updatedAt: new Date(),
        })
        .where(and(eq(userWallets.userId, userId), gte(userWallets.balance, item.price)))
        .returning();

      if (!updatedWallet) {
        res.status(400).json({ code: 'INSUFFICIENT_BALANCE', message: 'Not enough currency' });
        return;
      }

      // Create inventory entry — soundboard items go to user_soundboard
      const isSoundboard = item.type === 'soundboard';

      let inventoryRow: { id: string; userId: string; itemId: string; acquiredAt: Date };

      if (isSoundboard) {
        const [row] = await db
          .insert(userSoundboard)
          .values({ userId, itemId: item.id })
          .onConflictDoNothing()
          .returning();
        if (!row) {
          res.status(400).json({ code: 'ALREADY_OWNED', message: 'You already own this sound' });
          return;
        }
        inventoryRow = row;
      } else {
        const [row] = await db
          .insert(userInventory)
          .values({ userId, itemId: item.id })
          .returning();
        inventoryRow = row;
      }

      // Create ledger entry
      const [ledgerEntry] = await db
        .insert(economyLedger)
        .values({
          userId,
          direction: 'spend',
          amount: item.price,
          source: 'shop_purchase',
          description: `Purchased ${item.name}`,
          contextKey: item.id,
        })
        .returning();

      const inventoryVersion = await getInventoryVersion(userId);
      const responseBody = {
        inventory: {
          id: inventoryRow.id,
          userId: inventoryRow.userId,
          itemId: inventoryRow.itemId,
          acquiredAt: inventoryRow.acquiredAt.toISOString(),
        },
        wallet: {
          userId: updatedWallet.userId,
          balance: updatedWallet.balance,
          lifetimeEarned: updatedWallet.lifetimeEarned,
          lifetimeSpent: updatedWallet.lifetimeSpent,
          updatedAt: updatedWallet.updatedAt.toISOString(),
        },
        ledgerEntry: {
          id: ledgerEntry.id,
          userId: ledgerEntry.userId,
          direction: ledgerEntry.direction,
          amount: ledgerEntry.amount,
          source: ledgerEntry.source,
          description: ledgerEntry.description,
          contextKey: ledgerEntry.contextKey,
          createdAt: ledgerEntry.createdAt.toISOString(),
        },
        inventoryVersion,
      };

      if (idempotencyKey) {
        await db.insert(shopPurchaseRequests).values({
          userId,
          idempotencyKey,
          itemId,
          responseJson: responseBody,
        });
      }

      console.info(JSON.stringify({
        event: 'purchase_success',
        route: '/shop/purchase',
        userId,
        itemId,
        amount: item.price,
        inventoryVersion,
      }));
      res.status(200).json(responseBody);
    } catch (err) {
      logger.error(JSON.stringify({
        event: 'purchase_fail',
        route: '/shop/purchase',
        message: err instanceof Error ? err.message : 'unknown',
      }));
      logger.error('[shop] purchase error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /shop/items/:id/equip — Equip a shop item (visual types only)
// ---------------------------------------------------------------------------

shopRouter.patch(
  '/items/:id/equip',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id: _itemId } = req.params; const itemId = _itemId as string;

      // Verify ownership
      const [owned] = await db
        .select()
        .from(userInventory)
        .innerJoin(shopItems, eq(shopItems.id, userInventory.itemId))
        .where(and(eq(userInventory.userId, req.userId!), eq(userInventory.itemId, itemId)))
        .limit(1);

      if (!owned) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'You do not own this item' });
        return;
      }

      const item = owned.shop_items;

      // Soundboard items are not equippable
      if (item.type === 'soundboard') {
        res.status(400).json({ code: 'NOT_EQUIPPABLE', message: 'Soundboard items cannot be equipped' });
        return;
      }

      // Unequip any other item of the same type for this user
      if (item.type) {
        const sameTypeOwned = await db
          .select({ invId: userInventory.id })
          .from(userInventory)
          .innerJoin(shopItems, eq(shopItems.id, userInventory.itemId))
          .where(
            and(
              eq(userInventory.userId, req.userId!),
              eq(shopItems.type, item.type),
              eq(userInventory.equipped, true),
            ),
          );

        for (const row of sameTypeOwned) {
          await db.update(userInventory).set({ equipped: false }).where(eq(userInventory.id, row.invId));
        }
      }

      // Equip this item
      const [updated] = await db
        .update(userInventory)
        .set({ equipped: true })
        .where(and(eq(userInventory.userId, req.userId!), eq(userInventory.itemId, itemId)))
        .returning();

      console.info(JSON.stringify({
        event: 'equip_success',
        route: '/shop/items/:id/equip',
        userId: req.userId!,
        itemId: updated.itemId,
        type: item.type,
      }));
      res.status(200).json({
        itemId: updated.itemId,
        equipped: updated.equipped,
        type: item.type,
        name: item.name,
        assetConfig: item.assetConfig,
      });
    } catch (err) {
      logger.error(JSON.stringify({
        event: 'equip_fail',
        route: '/shop/items/:id/equip',
        message: err instanceof Error ? err.message : 'unknown',
      }));
      logger.error('[shop] equip error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /shop/items/:id/equip — Unequip a shop item
// ---------------------------------------------------------------------------

shopRouter.delete(
  '/items/:id/equip',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id: _itemId } = req.params; const itemId = _itemId as string;

      const [owned] = await db
        .select({ id: userInventory.id })
        .from(userInventory)
        .where(and(eq(userInventory.userId, req.userId!), eq(userInventory.itemId, itemId)))
        .limit(1);

      if (!owned) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'You do not own this item' });
        return;
      }

      await db.update(userInventory).set({ equipped: false }).where(eq(userInventory.id, owned.id));
      res.status(204).send();
    } catch (err) {
      logger.error('[shop] unequip error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);
