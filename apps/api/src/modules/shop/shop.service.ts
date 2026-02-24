import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import {
  shopItems,
  userInventory,
  shopPurchases,
  gratonitesBalances,
} from '@gratonite/db';
import type { AppContext } from '../../lib/context.js';
import { generateId } from '../../lib/snowflake.js';
import { createGratonitesService } from '../gratonites/gratonites.service.js';

export function createShopService(ctx: AppContext) {
  const gratonitesService = createGratonitesService(ctx);

  // Get all active shop items
  async function getItems(category?: string) {
    const query = ctx.db
      .select()
      .from(shopItems)
      .where(and(
        eq(shopItems.isActive, true),
        category ? eq(shopItems.category, category) : undefined
      ))
      .orderBy(shopItems.sortOrder, shopItems.name);
    
    return query;
  }

  // Get featured items
  async function getFeaturedItems() {
    return ctx.db
      .select()
      .from(shopItems)
      .where(and(
        eq(shopItems.isActive, true),
        eq(shopItems.isFeatured, true)
      ))
      .orderBy(shopItems.sortOrder)
      .limit(6);
  }

  // Get user's inventory
  async function getInventory(userId: string) {
    const items = await ctx.db
      .select({
        inventory: userInventory,
        item: shopItems,
      })
      .from(userInventory)
      .innerJoin(shopItems, eq(userInventory.itemId, shopItems.id))
      .where(eq(userInventory.userId, userId))
      .orderBy(desc(userInventory.purchasedAt));
    
    return items.map(({ inventory, item }) => ({
      ...inventory,
      item,
    }));
  }

  // Check if user owns an item
  async function ownsItem(userId: string, itemId: string) {
    const [existing] = await ctx.db
      .select({ id: userInventory.id })
      .from(userInventory)
      .where(and(
        eq(userInventory.userId, userId),
        eq(userInventory.itemId, itemId)
      ))
      .limit(1);
    
    return !!existing;
  }

  // Purchase an item
  async function purchaseItem(userId: string, itemId: string) {
    // Get item details
    const [item] = await ctx.db
      .select()
      .from(shopItems)
      .where(and(
        eq(shopItems.id, itemId),
        eq(shopItems.isActive, true)
      ))
      .limit(1);
    
    if (!item) {
      throw new Error('ITEM_NOT_FOUND');
    }

    // Check if already owned
    const alreadyOwned = await ownsItem(userId, itemId);
    if (alreadyOwned) {
      throw new Error('ALREADY_OWNED');
    }

    // Check balance
    const balance = await gratonitesService.getBalance(userId);
    if (balance.balance < item.price) {
      throw new Error('INSUFFICIENT_FUNDS');
    }

    // Perform purchase in transaction
    const result = await ctx.db.transaction(async (tx) => {
      // Deduct from balance
      await tx
        .update(gratonitesBalances)
        .set({
          balance: sql`${gratonitesBalances.balance} - ${item.price}`,
          lifetimeSpent: sql`${gratonitesBalances.lifetimeSpent} + ${item.price}`,
          updatedAt: new Date(),
        })
        .where(eq(gratonitesBalances.userId, userId));

      // Add to inventory
      const inventoryId = generateId();
      await tx.insert(userInventory).values({
        id: inventoryId,
        userId,
        itemId,
      });

      // Record purchase
      const purchaseId = generateId();
      await tx.insert(shopPurchases).values({
        id: purchaseId,
        userId,
        itemId,
        price: item.price,
        currency: 'gratonites',
      });

      return { inventoryId, purchaseId };
    });

    return {
      success: true,
      item,
      inventoryId: result.inventoryId,
    };
  }

  // Equip/unequip an item
  async function setEquipped(userId: string, itemId: string, equipped: boolean) {
    const [inventory] = await ctx.db
      .select()
      .from(userInventory)
      .where(and(
        eq(userInventory.userId, userId),
        eq(userInventory.itemId, itemId)
      ))
      .limit(1);
    
    if (!inventory) {
      throw new Error('ITEM_NOT_OWNED');
    }

    // Get item type
    const [item] = await ctx.db
      .select({ type: shopItems.type })
      .from(shopItems)
      .where(eq(shopItems.id, itemId))
      .limit(1);

    await ctx.db.transaction(async (tx) => {
      if (equipped) {
        // Unequip other items of same type
        const sameTypeItems = await tx
          .select({ itemId: userInventory.itemId })
          .from(userInventory)
          .innerJoin(shopItems, eq(userInventory.itemId, shopItems.id))
          .where(and(
            eq(userInventory.userId, userId),
            eq(userInventory.isEquipped, true),
            eq(shopItems.type, item.type)
          ));
        
        for (const { itemId: otherItemId } of sameTypeItems) {
          await tx
            .update(userInventory)
            .set({ isEquipped: false, equippedAt: null })
            .where(and(
              eq(userInventory.userId, userId),
              eq(userInventory.itemId, otherItemId)
            ));
        }

        // Equip this item
        await tx
          .update(userInventory)
          .set({ isEquipped: true, equippedAt: new Date() })
          .where(and(
            eq(userInventory.userId, userId),
            eq(userInventory.itemId, itemId)
          ));
      } else {
        // Unequip this item
        await tx
          .update(userInventory)
          .set({ isEquipped: false, equippedAt: null })
          .where(and(
            eq(userInventory.userId, userId),
            eq(userInventory.itemId, itemId)
          ));
      }
    });

    return { success: true, equipped };
  }

  // Get purchase history
  async function getPurchaseHistory(userId: string, limit = 20) {
    const purchases = await ctx.db
      .select({
        purchase: shopPurchases,
        item: shopItems,
      })
      .from(shopPurchases)
      .innerJoin(shopItems, eq(shopPurchases.itemId, shopItems.id))
      .where(eq(shopPurchases.userId, userId))
      .orderBy(desc(shopPurchases.purchasedAt))
      .limit(limit);
    
    return purchases.map(({ purchase, item }) => ({
      ...purchase,
      item,
    }));
  }

  return {
    getItems,
    getFeaturedItems,
    getInventory,
    ownsItem,
    purchaseItem,
    setEquipped,
    getPurchaseHistory,
  };
}
