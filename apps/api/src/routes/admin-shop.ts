/**
 * routes/admin-shop.ts — Admin endpoints for managing official shop items.
 *
 * All endpoints require the caller to have `admin.shop.manage` scope.
 * Non-admins or out-of-scope admins receive 403.
 *
 * Endpoints:
 *   GET    /admin/shop/items          — List all shop items (including unavailable)
 *   POST   /admin/shop/items          — Create a new shop item
 *   PATCH  /admin/shop/items/:id      — Update a shop item
 *   DELETE /admin/shop/items/:id      — Soft-delete (set available = false)
 *   POST   /admin/shop/seed           — Seed official launch items (idempotent by name)
 */

import { Router, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '../db/index';
import { shopItems } from '../db/schema/shop';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { ADMIN_SCOPES, hasAdminScope } from '../lib/admin-scopes';
import { seedCosmeticsCatalog } from '../seeds/cosmeticsCatalog';

export const adminShopRouter = Router();

// ---------------------------------------------------------------------------
// Admin gate middleware
// ---------------------------------------------------------------------------

async function requireAdmin(req: Request, res: Response, next: () => void): Promise<void> {
  if (!req.userId || !(await hasAdminScope(req.userId, ADMIN_SCOPES.SHOP_MANAGE))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Admin scope required: admin.shop.manage' });
    return;
  }

  next();
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const createItemSchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().optional(),
  price: z.number().int().min(0),
  category: z.string().max(64).optional(),
  imageUrl: z.string().url().max(512).optional(),
  rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary']).default('common'),
  type: z.enum(['avatar_frame', 'decoration', 'profile_effect', 'nameplate', 'soundboard']),
  assetUrl: z.string().url().max(512).optional(),
  assetConfig: z.record(z.string(), z.unknown()).optional(),
  duration: z.number().int().min(1).max(10).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  available: z.boolean().default(true),
});

const updateItemSchema = createItemSchema.partial();

// ---------------------------------------------------------------------------
// GET /admin/shop/items
// ---------------------------------------------------------------------------

adminShopRouter.get(
  '/items',
  requireAuth,
  requireAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const items = await db.select().from(shopItems);
      res.status(200).json(items);
    } catch (err) {
      console.error('[admin-shop] list error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /admin/shop/items
// ---------------------------------------------------------------------------

adminShopRouter.post(
  '/items',
  requireAuth,
  requireAdmin,
  validate(createItemSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body as z.infer<typeof createItemSchema>;

      const [item] = await db
        .insert(shopItems)
        .values({
          name: body.name,
          description: body.description ?? null,
          price: body.price,
          category: body.category ?? null,
          imageUrl: body.imageUrl ?? null,
          rarity: body.rarity,
          type: body.type,
          assetUrl: body.assetUrl ?? null,
          assetConfig: body.assetConfig ?? null,
          duration: body.duration ?? null,
          metadata: body.metadata ?? null,
          available: body.available,
        })
        .returning();

      res.status(201).json(item);
    } catch (err) {
      console.error('[admin-shop] create error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /admin/shop/items/:id
// ---------------------------------------------------------------------------

adminShopRouter.patch(
  '/items/:id',
  requireAuth,
  requireAdmin,
  validate(updateItemSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id: _id } = req.params; const id = _id as string;
      const body = req.body as z.infer<typeof updateItemSchema>;

      const [existing] = await db
        .select({ id: shopItems.id })
        .from(shopItems)
        .where(eq(shopItems.id, id))
        .limit(1);

      if (!existing) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Item not found' });
        return;
      }

      const updates: Partial<typeof shopItems.$inferInsert> = {};
      if (body.name !== undefined) updates.name = body.name;
      if (body.description !== undefined) updates.description = body.description;
      if (body.price !== undefined) updates.price = body.price;
      if (body.category !== undefined) updates.category = body.category;
      if (body.imageUrl !== undefined) updates.imageUrl = body.imageUrl;
      if (body.rarity !== undefined) updates.rarity = body.rarity;
      if (body.type !== undefined) updates.type = body.type;
      if (body.assetUrl !== undefined) updates.assetUrl = body.assetUrl;
      if (body.assetConfig !== undefined) updates.assetConfig = body.assetConfig;
      if (body.duration !== undefined) updates.duration = body.duration;
      if (body.metadata !== undefined) updates.metadata = body.metadata;
      if (body.available !== undefined) updates.available = body.available;

      if (Object.keys(updates).length === 0) {
        res.status(400).json({ code: 'VALIDATION_ERROR', message: 'No fields to update' });
        return;
      }

      const [updated] = await db
        .update(shopItems)
        .set(updates)
        .where(eq(shopItems.id, id))
        .returning();

      res.status(200).json(updated);
    } catch (err) {
      console.error('[admin-shop] update error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /admin/shop/items/:id — soft delete
// ---------------------------------------------------------------------------

adminShopRouter.delete(
  '/items/:id',
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id: _id } = req.params; const id = _id as string;

      const [existing] = await db
        .select({ id: shopItems.id })
        .from(shopItems)
        .where(eq(shopItems.id, id))
        .limit(1);

      if (!existing) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Item not found' });
        return;
      }

      await db
        .update(shopItems)
        .set({ available: false })
        .where(eq(shopItems.id, id));

      res.status(200).json({ code: 'OK', message: 'Item removed from shop' });
    } catch (err) {
      console.error('[admin-shop] delete error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /admin/shop/seed — Seed official launch items (idempotent by name)
// ---------------------------------------------------------------------------

const LAUNCH_ITEMS: Array<typeof shopItems.$inferInsert> = [
  // Avatar Frames
  {
    name: 'Neon Pulse Frame',
    description: 'A vibrant animated frame with pulsing neon lights around your avatar.',
    price: 800,
    category: 'Frames',
    rarity: 'rare',
    type: 'avatar_frame',
    available: true,
    assetConfig: {
      frameStyle: 'neon',
      glowColor: '#38bdf8',
      borderStyle: 'animated',
      borderWidth: 4,
      colors: ['#00f5ff', '#ff00ff'],
      animation: 'pulse',
    },
  },
  {
    name: 'Sakura Blossom Frame',
    description: 'Delicate pink cherry blossom petals drift around your profile picture.',
    price: 600,
    category: 'Frames',
    rarity: 'uncommon',
    type: 'avatar_frame',
    available: true,
    assetConfig: {
      frameStyle: 'neon',
      glowColor: '#f9a8d4',
      borderStyle: 'animated',
      borderWidth: 3,
      colors: ['#ffb7c5', '#ff8fa3'],
      animation: 'drift',
    },
  },
  {
    name: 'Dark Matter Frame',
    description: 'A swirling dark energy effect that warps space around your avatar.',
    price: 1200,
    category: 'Frames',
    rarity: 'epic',
    type: 'avatar_frame',
    available: true,
    assetConfig: {
      frameStyle: 'neon',
      glowColor: '#7c3aed',
      borderStyle: 'animated',
      borderWidth: 6,
      colors: ['#1a0033', '#6b00cc'],
      animation: 'swirl',
    },
  },
  {
    name: 'Arctic Wave Frame',
    description: 'Cool icy waves with frost crystals that slowly rotate around your picture.',
    price: 500,
    category: 'Frames',
    rarity: 'uncommon',
    type: 'avatar_frame',
    available: true,
    assetConfig: {
      frameStyle: 'glass',
      glowColor: '#bae6fd',
      borderStyle: 'animated',
      borderWidth: 3,
      colors: ['#a8d8ea', '#ffffff'],
      animation: 'rotate',
    },
  },

  // Decorations
  {
    name: 'Golden Crown',
    description: 'A gleaming golden crown badge displayed at the top of your avatar.',
    price: 700,
    category: 'Decorations',
    rarity: 'rare',
    type: 'decoration',
    available: true,
    assetConfig: {
      shape: 'crown',
      fill: '#ffd700',
      border: '#b8860b',
      position: 'top-right',
      size: 'medium',
      animation: 'none',
    },
  },
  {
    name: 'Electric Bolt',
    description: 'A crackling lightning bolt that pulses with energy beside your avatar.',
    price: 400,
    category: 'Decorations',
    rarity: 'uncommon',
    type: 'decoration',
    available: true,
    assetConfig: {
      shape: 'star',
      fill: '#ffe500',
      border: '#ff8c00',
      position: 'top-left',
      size: 'small',
      animation: 'pulse',
    },
  },
  {
    name: 'Eternal Flame',
    description: 'An animated flame that flickers with a warm orange glow.',
    price: 450,
    category: 'Decorations',
    rarity: 'uncommon',
    type: 'decoration',
    available: true,
    assetConfig: {
      shape: 'flame',
      fill: '#ff4500',
      border: '#ff6b00',
      position: 'bottom-right',
      size: 'medium',
      animation: 'bounce',
    },
  },
  {
    name: 'Crystal Star',
    description: 'A multi-faceted crystal star that slowly spins and catches the light.',
    price: 2000,
    category: 'Decorations',
    rarity: 'legendary',
    type: 'decoration',
    available: true,
    assetConfig: {
      shape: 'star',
      fill: '#e0f7ff',
      border: '#9eceff',
      position: 'top-right',
      size: 'large',
      animation: 'spin',
    },
  },

  // Profile Effects
  {
    name: 'Aurora Borealis',
    description: 'Sweeping ribbons of green, teal, and violet shimmer across your profile.',
    price: 1500,
    category: 'Effects',
    rarity: 'epic',
    type: 'profile_effect',
    available: true,
    assetConfig: {
      effectType: 'aurora',
      animationType: 'aurora',
      colors: ['#00ff87', '#00b4d8', '#9b5de5'],
      speed: 'slow',
      intensity: 'normal',
    },
  },
  {
    name: 'Neon Rain',
    description: 'Colourful neon particles rain down across your profile page.',
    price: 900,
    category: 'Effects',
    rarity: 'rare',
    type: 'profile_effect',
    available: true,
    assetConfig: {
      effectType: 'particles',
      animationType: 'particles',
      colors: ['#ff00ff', '#00f5ff', '#ff6b00'],
      speed: 'medium',
      intensity: 'normal',
    },
  },
  {
    name: 'Stardust Shimmer',
    description: 'Tiny golden stars drift and shimmer gently across your profile background.',
    price: 300,
    category: 'Effects',
    rarity: 'common',
    type: 'profile_effect',
    available: true,
    assetConfig: {
      effectType: 'stars',
      animationType: 'shimmer',
      colors: ['#ffd700', '#fff8e1'],
      speed: 'slow',
      intensity: 'subtle',
    },
  },

  // Nameplates
  {
    name: 'Gradient Gold Nameplate',
    description: 'Your display name rendered in bold text on a rich gold-to-amber gradient.',
    price: 600,
    category: 'Nameplates',
    rarity: 'rare',
    type: 'nameplate',
    available: true,
    assetConfig: {
      nameplateStyle: 'gold',
      font: 'Inter',
      size: 14,
      weight: '700',
      textColor: '#1a1a1a',
      background: 'linear-gradient(90deg, #ffd700, #ff8c00)',
      shape: 'pill',
      icon: null,
    },
  },
  {
    name: 'Cyberpunk Nameplate',
    description: 'Glitch-styled nameplate with a dark background and electric cyan text.',
    price: 750,
    category: 'Nameplates',
    rarity: 'rare',
    type: 'nameplate',
    available: true,
    assetConfig: {
      nameplateStyle: 'glitch',
      font: 'monospace',
      size: 13,
      weight: '600',
      textColor: '#00f5ff',
      background: '#0d0d1a',
      shape: 'rectangle',
      icon: null,
    },
  },
  {
    name: 'Sakura Nameplate',
    description: 'A soft pink pill-shaped nameplate with a floral accent icon.',
    price: 350,
    category: 'Nameplates',
    rarity: 'uncommon',
    type: 'nameplate',
    available: true,
    assetConfig: {
      nameplateStyle: 'rainbow',
      font: 'Inter',
      size: 13,
      weight: '500',
      textColor: '#5c0a2e',
      background: 'linear-gradient(90deg, #ffd6e7, #ffafcc)',
      shape: 'pill',
      icon: 'flower',
    },
  },
  {
    name: 'Midnight Nameplate',
    description: 'Deep navy nameplate with a subtle underline and silver text — clean and minimal.',
    price: 250,
    category: 'Nameplates',
    rarity: 'common',
    type: 'nameplate',
    available: true,
    assetConfig: {
      nameplateStyle: 'ice',
      font: 'Inter',
      size: 13,
      weight: '500',
      textColor: '#c0cfe8',
      background: '#0f1b30',
      shape: 'underline-only',
      icon: null,
    },
  },

  // Soundboard
  {
    name: 'Air Horn',
    description: 'The classic deafening air horn blast. Use responsibly.',
    price: 150,
    category: 'Soundboard',
    rarity: 'common',
    type: 'soundboard',
    available: true,
    duration: 2,
    metadata: { loop: false, category: 'meme' },
  },
  {
    name: 'Ba Dum Tss',
    description: 'Classic rimshot for your best (or worst) jokes.',
    price: 150,
    category: 'Soundboard',
    rarity: 'common',
    type: 'soundboard',
    available: true,
    duration: 3,
    metadata: { loop: false, category: 'meme' },
  },
  {
    name: 'Vine Boom',
    description: 'The legendary bass drop that punctuates every surprising moment.',
    price: 200,
    category: 'Soundboard',
    rarity: 'uncommon',
    type: 'soundboard',
    available: true,
    duration: 2,
    metadata: { loop: false, category: 'meme' },
  },
  {
    name: 'Sad Trombone',
    description: 'Wah wah waaaah. For those defeats that deserve ceremony.',
    price: 150,
    category: 'Soundboard',
    rarity: 'common',
    type: 'soundboard',
    available: true,
    duration: 4,
    metadata: { loop: false, category: 'meme' },
  },
  {
    name: 'Applause',
    description: 'A full crowd burst into applause. You definitely earned it.',
    price: 200,
    category: 'Soundboard',
    rarity: 'uncommon',
    type: 'soundboard',
    available: true,
    duration: 5,
    metadata: { loop: false, category: 'reaction' },
  },
];

adminShopRouter.post(
  '/seed',
  requireAuth,
  requireAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      // Seed LAUNCH_ITEMS idempotent by name
      let launchInserted = 0;
      let launchUpdated = 0;
      for (const item of LAUNCH_ITEMS) {
        const [existing] = await db
          .select({ id: shopItems.id })
          .from(shopItems)
          .where(eq(shopItems.name, item.name!))
          .limit(1);
        if (!existing) {
          await db.insert(shopItems).values(item);
          launchInserted += 1;
        } else {
          await db.update(shopItems).set(item).where(eq(shopItems.id, existing.id));
          launchUpdated += 1;
        }
      }

      // Seed 100 catalog items
      const catalogResults = await seedCosmeticsCatalog();
      const catalogInserted = catalogResults.filter((r) => r.action === 'inserted').length;
      const catalogUpdated = catalogResults.filter((r) => r.action === 'updated').length;

      res.status(200).json({
        message: `Seed complete. Launch: ${launchInserted} inserted, ${launchUpdated} updated. Catalog: ${catalogInserted} inserted, ${catalogUpdated} updated.`,
        launchInserted,
        launchUpdated,
        catalogResults,
      });
    } catch (err) {
      console.error('[admin-shop] seed error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);
