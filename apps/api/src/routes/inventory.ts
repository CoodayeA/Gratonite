/**
 * routes/inventory.ts — Unified inventory endpoint.
 *
 * Merges shop items (from user_inventory + shop_items) and creator cosmetics
 * (from user_cosmetics + cosmetics) into a single response so the frontend
 * can render one inventory view across both systems.
 *
 * Endpoints:
 *   GET /inventory — Returns all owned items (shop + cosmetics)
 */

import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { eq, and } from 'drizzle-orm';

import { db } from '../db/index';
import { shopItems, userInventory, userSoundboard } from '../db/schema/shop';
import { cosmetics, userCosmetics } from '../db/schema/cosmetics';
import { requireAuth } from '../middleware/auth';

export const inventoryRouter = Router();

// ---------------------------------------------------------------------------
// GET /inventory
// ---------------------------------------------------------------------------

inventoryRouter.get(
  '/',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.userId!;

      // Fetch shop items from user_inventory
      const shopRows = await db
        .select({
          id: userInventory.id,
          itemId: userInventory.itemId,
          equipped: userInventory.equipped,
          acquiredAt: userInventory.acquiredAt,
          name: shopItems.name,
          description: shopItems.description,
          type: shopItems.type,
          rarity: shopItems.rarity,
          imageUrl: shopItems.imageUrl,
          assetUrl: shopItems.assetUrl,
          assetConfig: shopItems.assetConfig,
          duration: shopItems.duration,
          metadata: shopItems.metadata,
        })
        .from(userInventory)
        .innerJoin(shopItems, eq(shopItems.id, userInventory.itemId))
        .where(eq(userInventory.userId, userId));

      // Fetch soundboard items from user_soundboard
      const soundboardRows = await db
        .select({
          id: userSoundboard.id,
          itemId: userSoundboard.itemId,
          acquiredAt: userSoundboard.acquiredAt,
          name: shopItems.name,
          description: shopItems.description,
          type: shopItems.type,
          rarity: shopItems.rarity,
          imageUrl: shopItems.imageUrl,
          assetUrl: shopItems.assetUrl,
          assetConfig: shopItems.assetConfig,
          duration: shopItems.duration,
          metadata: shopItems.metadata,
        })
        .from(userSoundboard)
        .innerJoin(shopItems, eq(shopItems.id, userSoundboard.itemId))
        .where(eq(userSoundboard.userId, userId));

      // Fetch creator cosmetics from user_cosmetics
      const cosmeticRows = await db
        .select({
          id: userCosmetics.id,
          cosmeticId: userCosmetics.cosmeticId,
          equipped: userCosmetics.equipped,
          acquiredAt: userCosmetics.acquiredAt,
          name: cosmetics.name,
          description: cosmetics.description,
          type: cosmetics.type,
          rarity: cosmetics.rarity,
          imageUrl: cosmetics.previewImageUrl,
          assetUrl: cosmetics.assetUrl,
          assetConfig: cosmetics.assetConfig,
        })
        .from(userCosmetics)
        .innerJoin(cosmetics, eq(cosmetics.id, userCosmetics.cosmeticId))
        .where(
          and(
            eq(userCosmetics.userId, userId),
            eq(cosmetics.isPublished, true),
          ),
        );

      // Build unified item list
      const items = [
        ...shopRows.map((r) => ({
          id: r.id,
          itemId: r.itemId,
          source: 'shop' as const,
          name: r.name,
          description: r.description,
          type: r.type,
          rarity: r.rarity,
          imageUrl: r.imageUrl,
          assetUrl: r.assetUrl,
          assetConfig: r.assetConfig,
          duration: r.duration,
          metadata: r.metadata,
          equipped: r.equipped,
          acquiredAt: r.acquiredAt.toISOString(),
        })),
        ...soundboardRows.map((r) => ({
          id: r.id,
          itemId: r.itemId,
          source: 'shop' as const,
          name: r.name,
          description: r.description,
          type: r.type,
          rarity: r.rarity,
          imageUrl: r.imageUrl,
          assetUrl: r.assetUrl,
          assetConfig: r.assetConfig,
          duration: r.duration,
          metadata: r.metadata,
          equipped: false,
          acquiredAt: r.acquiredAt.toISOString(),
        })),
        ...cosmeticRows.map((r) => ({
          id: r.id,
          itemId: r.cosmeticId,
          source: 'cosmetics' as const,
          name: r.name,
          description: r.description,
          type: r.type,
          rarity: r.rarity,
          imageUrl: r.imageUrl,
          assetUrl: r.assetUrl,
          assetConfig: r.assetConfig,
          duration: null,
          metadata: null,
          equipped: r.equipped,
          acquiredAt: r.acquiredAt.toISOString(),
        })),
      ];

      // Aggregate by source + itemId so quantity is explicit and inventory is canonical.
      const aggregated = new Map<string, typeof items[number] & { quantity: number }>();
      for (const item of items) {
        const key = `${item.source}:${item.itemId}`;
        const existing = aggregated.get(key);
        if (!existing) {
          aggregated.set(key, { ...item, quantity: 1 });
          continue;
        }
        existing.quantity += 1;
        if (item.equipped) existing.equipped = true;
        if (item.acquiredAt > existing.acquiredAt) existing.acquiredAt = item.acquiredAt;
      }
      const normalizedItems = [...aggregated.values()];
      normalizedItems.sort((a, b) => (a.acquiredAt > b.acquiredAt ? -1 : 1));

      res.status(200).json({ items: normalizedItems });
    } catch (err) {
      logger.error('[inventory] get error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);
