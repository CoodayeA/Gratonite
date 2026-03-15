/**
 * routes/cosmetics.ts — Express router for cosmetics endpoints.
 *
 * Endpoints:
 *   GET    /cosmetics/marketplace          — Browse published cosmetics
 *   GET    /cosmetics/mine                 — List cosmetics created by the authed user
 *   GET    /cosmetics/creator/:creatorId   — List cosmetics by a specific creator
 *   POST   /cosmetics                      — Create a new cosmetic (creator)
 *   GET    /cosmetics/:id                  — Get a single cosmetic
 *   PATCH  /cosmetics/:id                  — Update a cosmetic (creator)
 *   DELETE /cosmetics/:id                  — Delete a cosmetic (creator)
 *   POST   /cosmetics/:id/upload           — Upload asset file for a cosmetic
 *   PATCH  /cosmetics/:id/submit           — Submit cosmetic for review
 *   POST   /cosmetics/:id/purchase         — Purchase a cosmetic
 *   PATCH  /cosmetics/:id/equip            — Equip a cosmetic
 *   DELETE /cosmetics/:id/equip            — Unequip a cosmetic
 *   GET    /cosmetics/:id/stats            — Creator stats for a cosmetic
 *
 * Admin endpoints (mounted on the same router for simplicity):
 *   GET    /admin/cosmetics/pending        — List cosmetics pending review
 *   PATCH  /admin/cosmetics/:id/approve    — Approve a cosmetic
 *   PATCH  /admin/cosmetics/:id/reject     — Reject a cosmetic (body: { reason })
 */

import path from 'path';
import { logger } from '../lib/logger';
import fs from 'fs';
import { randomUUID } from 'crypto';

import { Router, Request, Response, NextFunction } from 'express';
import { eq, and, desc, sql } from 'drizzle-orm';
import multer from 'multer';
import { z } from 'zod';

import { db } from '../db/index';
import { cosmetics, userCosmetics } from '../db/schema/cosmetics';
import { userWallets, economyLedger } from '../db/schema/economy';
import { users } from '../db/schema/users';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { ADMIN_SCOPES, hasAdminScope } from '../lib/admin-scopes';

export const cosmeticsRouter = Router();

// ---------------------------------------------------------------------------
// Multer — memory storage; validation happens in route handler
// ---------------------------------------------------------------------------

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB max (images); sound check is tighter in handler
  fileFilter: (_req, file, cb) => {
    const allAllowed = new Set([...IMAGE_MIME_TYPES, ...SOUND_MIME_TYPES]);
    if (allAllowed.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed. Accepted: PNG, GIF, WebP images or MP3, OGG, WAV audio.'));
    }
  },
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const IMAGE_MIME_TYPES = new Set(['image/png', 'image/gif', 'image/webp']);
const SOUND_MIME_TYPES = new Set(['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/x-wav']);
const IMAGE_COSMETIC_TYPES = new Set(['avatar_frame', 'decoration', 'nameplate', 'profile_effect']);
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_SOUND_BYTES = 1 * 1024 * 1024; // 1 MB

const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
};

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const rejectSchema = z.object({
  reason: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cosmeticJson(c: typeof cosmetics.$inferSelect) {
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    description: c.description,
    price: c.price,
    previewImageUrl: c.previewImageUrl,
    assetUrl: c.assetUrl,
    assetConfig: c.assetConfig,
    rarity: c.rarity,
    creatorId: c.creatorId,
    isPublished: c.isPublished,
    status: c.status,
    rejectionReason: c.rejectionReason,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

async function getOrCreateWallet(userId: string) {
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

  return wallet;
}

function param(req: Request, key: string): string {
  const v = req.params[key];
  return typeof v === 'string' ? v : Array.isArray(v) ? v[0] : '';
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Admin gate (used in admin sub-routes below)
// ---------------------------------------------------------------------------

async function assertAdmin(req: Request, res: Response): Promise<boolean> {
  if (!(await hasAdminScope(req.userId!, ADMIN_SCOPES.COSMETICS_MODERATE))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Admin scope required: admin.cosmetics.moderate' });
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// GET /cosmetics/marketplace
// ---------------------------------------------------------------------------

cosmeticsRouter.get(
  '/marketplace',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const type = req.query.type as string | undefined;
      const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 50, 1), 100);
      const offset = Math.max(parseInt(req.query.offset as string, 10) || 0, 0);

      const conditions = [eq(cosmetics.isPublished, true)];
      if (type) conditions.push(eq(cosmetics.type, type));

      const rows = await db
        .select()
        .from(cosmetics)
        .where(and(...conditions))
        .orderBy(desc(cosmetics.createdAt))
        .limit(limit)
        .offset(offset);

      res.status(200).json(rows.map(cosmeticJson));
    } catch (err) {
      logger.error('[cosmetics] marketplace error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /cosmetics/mine
// ---------------------------------------------------------------------------

cosmeticsRouter.get(
  '/mine',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const rows = await db
        .select()
        .from(cosmetics)
        .where(eq(cosmetics.creatorId, req.userId!))
        .orderBy(desc(cosmetics.createdAt));

      res.status(200).json(rows.map(cosmeticJson));
    } catch (err) {
      logger.error('[cosmetics] mine error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /cosmetics/creator/:creatorId
// ---------------------------------------------------------------------------

cosmeticsRouter.get(
  '/creator/:creatorId',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const creatorId = param(req, 'creatorId');
      const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 50, 1), 100);
      const offset = Math.max(parseInt(req.query.offset as string, 10) || 0, 0);

      const rows = await db
        .select()
        .from(cosmetics)
        .where(and(eq(cosmetics.creatorId, creatorId), eq(cosmetics.isPublished, true)))
        .orderBy(desc(cosmetics.createdAt))
        .limit(limit)
        .offset(offset);

      res.status(200).json(rows.map(cosmeticJson));
    } catch (err) {
      logger.error('[cosmetics] creator error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// Admin: GET /admin/cosmetics/pending
// IMPORTANT: must be before /:id routes to avoid "admin" being treated as an id
// ---------------------------------------------------------------------------

cosmeticsRouter.get(
  '/admin/cosmetics/pending',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!(await assertAdmin(req, res))) return;

      const rows = await db
        .select({
          cosmetic: cosmetics,
          creator: {
            id: users.id,
            username: users.username,
            displayName: users.displayName,
          },
        })
        .from(cosmetics)
        .leftJoin(users, eq(users.id, cosmetics.creatorId))
        .where(eq(cosmetics.status, 'pending_review'))
        .orderBy(desc(cosmetics.createdAt));

      res.status(200).json(
        rows.map((r) => ({ ...cosmeticJson(r.cosmetic), creator: r.creator })),
      );
    } catch (err) {
      logger.error('[cosmetics] admin pending error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// Admin: PATCH /admin/cosmetics/:id/approve
// ---------------------------------------------------------------------------

cosmeticsRouter.patch(
  '/admin/cosmetics/:id/approve',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!(await assertAdmin(req, res))) return;

      const cosmeticId = param(req, 'id');
      const [existing] = await db
        .select()
        .from(cosmetics)
        .where(eq(cosmetics.id, cosmeticId))
        .limit(1);

      if (!existing) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Cosmetic not found' });
        return;
      }

      const [updated] = await db
        .update(cosmetics)
        .set({ isPublished: true, status: 'approved', updatedAt: new Date() })
        .where(eq(cosmetics.id, cosmeticId))
        .returning();

      res.status(200).json(cosmeticJson(updated));
    } catch (err) {
      logger.error('[cosmetics] admin approve error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// Admin: PATCH /admin/cosmetics/:id/reject
// ---------------------------------------------------------------------------

cosmeticsRouter.patch(
  '/admin/cosmetics/:id/reject',
  requireAuth,
  validate(rejectSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!(await assertAdmin(req, res))) return;

      const cosmeticId = param(req, 'id');
      const { reason } = req.body as z.infer<typeof rejectSchema>;

      const [existing] = await db
        .select()
        .from(cosmetics)
        .where(eq(cosmetics.id, cosmeticId))
        .limit(1);

      if (!existing) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Cosmetic not found' });
        return;
      }

      const [updated] = await db
        .update(cosmetics)
        .set({ status: 'rejected', rejectionReason: reason, updatedAt: new Date() })
        .where(eq(cosmetics.id, cosmeticId))
        .returning();

      res.status(200).json(cosmeticJson(updated));
    } catch (err) {
      logger.error('[cosmetics] admin reject error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /cosmetics — Create cosmetic
// ---------------------------------------------------------------------------

cosmeticsRouter.post(
  '/',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, description, type, previewImageUrl, assetUrl, price } = req.body as {
        name?: string;
        description?: string;
        type?: string;
        previewImageUrl?: string;
        assetUrl?: string;
        price?: number;
      };

      if (!name || !type) {
        res.status(400).json({ code: 'BAD_REQUEST', message: 'name and type are required' });
        return;
      }

      const [row] = await db
        .insert(cosmetics)
        .values({
          name,
          type,
          description: description ?? null,
          previewImageUrl: previewImageUrl ?? null,
          assetUrl: assetUrl ?? null,
          price: price ?? 0,
          creatorId: req.userId!,
          isPublished: false,
        })
        .returning();

      res.status(201).json(cosmeticJson(row));
    } catch (err) {
      logger.error('[cosmetics] create error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /cosmetics/:id
// ---------------------------------------------------------------------------

cosmeticsRouter.get(
  '/:id',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = param(req, 'id');
      const [row] = await db.select().from(cosmetics).where(eq(cosmetics.id, id)).limit(1);

      if (!row) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Cosmetic not found' });
        return;
      }

      res.status(200).json(cosmeticJson(row));
    } catch (err) {
      logger.error('[cosmetics] get error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /cosmetics/:id — Update cosmetic
// ---------------------------------------------------------------------------

cosmeticsRouter.patch(
  '/:id',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = param(req, 'id');
      const [existing] = await db
        .select()
        .from(cosmetics)
        .where(and(eq(cosmetics.id, id), eq(cosmetics.creatorId, req.userId!)))
        .limit(1);

      if (!existing) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Cosmetic not found or not owned by you' });
        return;
      }

      const { name, description, previewImageUrl, assetUrl, assetConfig, price, isPublished } = req.body as {
        name?: string;
        description?: string;
        previewImageUrl?: string;
        assetUrl?: string;
        assetConfig?: Record<string, unknown>;
        price?: number;
        isPublished?: boolean;
      };

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (previewImageUrl !== undefined) updates.previewImageUrl = previewImageUrl;
      if (assetUrl !== undefined) updates.assetUrl = assetUrl;
      if (assetConfig !== undefined) updates.assetConfig = assetConfig;
      if (price !== undefined) updates.price = price;
      if (isPublished !== undefined) updates.isPublished = isPublished;

      const [updated] = await db
        .update(cosmetics)
        .set(updates)
        .where(eq(cosmetics.id, id))
        .returning();

      res.status(200).json(cosmeticJson(updated));
    } catch (err) {
      logger.error('[cosmetics] update error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /cosmetics/:id
// ---------------------------------------------------------------------------

cosmeticsRouter.delete(
  '/:id',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = param(req, 'id');
      const [existing] = await db
        .select()
        .from(cosmetics)
        .where(and(eq(cosmetics.id, id), eq(cosmetics.creatorId, req.userId!)))
        .limit(1);

      if (!existing) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Cosmetic not found or not owned by you' });
        return;
      }

      await db.delete(cosmetics).where(eq(cosmetics.id, id));
      res.status(204).send();
    } catch (err) {
      logger.error('[cosmetics] delete error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /cosmetics/:id/upload — Upload asset file
// ---------------------------------------------------------------------------

cosmeticsRouter.post(
  '/:id/upload',
  requireAuth,
  (req: Request, res: Response, next: NextFunction) => {
    upload.single('file')(req, res, (err: any) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({ code: 'FILE_TOO_LARGE', message: 'File exceeds the 2 MB size limit.' });
        } else {
          res.status(400).json({ code: 'VALIDATION_ERROR', message: err.message });
        }
        return;
      }
      next();
    });
  },
  async (req: Request, res: Response): Promise<void> => {
    try {
      const cosmeticId = param(req, 'id');

      const [existing] = await db
        .select()
        .from(cosmetics)
        .where(and(eq(cosmetics.id, cosmeticId), eq(cosmetics.creatorId, req.userId!)))
        .limit(1);

      if (!existing) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Cosmetic not found or not owned by you' });
        return;
      }

      if (!req.file) {
        res.status(400).json({ code: 'BAD_REQUEST', message: 'No file uploaded' });
        return;
      }

      const { buffer, mimetype, size } = req.file;
      const isImageCosmetic = IMAGE_COSMETIC_TYPES.has(existing.type);
      const isSoundboard = existing.type === 'soundboard';

      if (isImageCosmetic) {
        if (!IMAGE_MIME_TYPES.has(mimetype)) {
          res.status(400).json({ code: 'INVALID_FILE_TYPE', message: 'Image cosmetics accept PNG, GIF, or WEBP only' });
          return;
        }
        if (size > MAX_IMAGE_BYTES) {
          res.status(400).json({ code: 'FILE_TOO_LARGE', message: 'Image file must be 2 MB or smaller' });
          return;
        }
      } else if (isSoundboard) {
        if (!SOUND_MIME_TYPES.has(mimetype)) {
          res.status(400).json({ code: 'INVALID_FILE_TYPE', message: 'Soundboard cosmetics accept MP3, OGG, or WAV only' });
          return;
        }
        if (size > MAX_SOUND_BYTES) {
          res.status(400).json({ code: 'FILE_TOO_LARGE', message: 'Sound file must be 1 MB or smaller' });
          return;
        }
      } else {
        res.status(400).json({ code: 'UNSUPPORTED_COSMETIC_TYPE', message: `File upload not supported for cosmetic type: ${existing.type}` });
        return;
      }

      const ext = MIME_TO_EXT[mimetype] ?? 'bin';
      const filename = `${randomUUID()}.${ext}`;
      const projectRoot = path.resolve(__dirname, '../../');
      const storageDir = isImageCosmetic
        ? path.join(projectRoot, 'uploads', 'cosmetics')
        : path.join(projectRoot, 'uploads', 'sounds');
      const assetUrl = isImageCosmetic
        ? `/uploads/cosmetics/${filename}`
        : `/uploads/sounds/${filename}`;

      ensureDir(storageDir);
      fs.writeFileSync(path.join(storageDir, filename), buffer);

      const [updated] = await db
        .update(cosmetics)
        .set({ assetUrl, updatedAt: new Date() })
        .where(eq(cosmetics.id, cosmeticId))
        .returning();

      res.status(200).json({ assetUrl: updated.assetUrl });
    } catch (err) {
      logger.error('[cosmetics] upload error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /cosmetics/:id/submit — Submit for review
// ---------------------------------------------------------------------------

cosmeticsRouter.patch(
  '/:id/submit',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const cosmeticId = param(req, 'id');

      const [existing] = await db
        .select()
        .from(cosmetics)
        .where(and(eq(cosmetics.id, cosmeticId), eq(cosmetics.creatorId, req.userId!)))
        .limit(1);

      if (!existing) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Cosmetic not found or not owned by you' });
        return;
      }

      if (!existing.assetUrl && !existing.assetConfig) {
        res.status(400).json({
          code: 'NO_ASSET',
          message: 'Cosmetic must have an assetUrl or assetConfig before submitting for review',
        });
        return;
      }

      if (existing.status !== 'draft') {
        res.status(400).json({
          code: 'INVALID_STATUS',
          message: `Cannot submit a cosmetic that is already in '${existing.status}' status`,
        });
        return;
      }

      const [updated] = await db
        .update(cosmetics)
        .set({ status: 'pending_review', updatedAt: new Date() })
        .where(eq(cosmetics.id, cosmeticId))
        .returning();

      res.status(200).json(cosmeticJson(updated));
    } catch (err) {
      logger.error('[cosmetics] submit error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /cosmetics/:id/purchase
// ---------------------------------------------------------------------------

cosmeticsRouter.post(
  '/:id/purchase',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const cosmeticId = param(req, 'id');

      const [item] = await db
        .select()
        .from(cosmetics)
        .where(and(eq(cosmetics.id, cosmeticId), eq(cosmetics.isPublished, true)))
        .limit(1);

      if (!item) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Cosmetic not found or not published' });
        return;
      }

      const [alreadyOwned] = await db
        .select()
        .from(userCosmetics)
        .where(and(eq(userCosmetics.userId, req.userId!), eq(userCosmetics.cosmeticId, cosmeticId)))
        .limit(1);

      if (alreadyOwned) {
        res.status(400).json({ code: 'ALREADY_OWNED', message: 'You already own this cosmetic' });
        return;
      }

      const wallet = await getOrCreateWallet(req.userId!);

      if (wallet.balance < item.price) {
        res.status(400).json({ code: 'INSUFFICIENT_BALANCE', message: 'Not enough currency' });
        return;
      }

      const [updatedWallet] = await db
        .update(userWallets)
        .set({
          balance: wallet.balance - item.price,
          lifetimeSpent: wallet.lifetimeSpent + item.price,
          updatedAt: new Date(),
        })
        .where(eq(userWallets.userId, req.userId!))
        .returning();

      const [uc] = await db
        .insert(userCosmetics)
        .values({ userId: req.userId!, cosmeticId })
        .returning();

      await db.insert(economyLedger).values({
        userId: req.userId!,
        direction: 'spend',
        amount: item.price,
        source: 'creator_item_purchase',
        description: `Purchased cosmetic: ${item.name}`,
        contextKey: cosmeticId,
      });

      res.status(200).json({
        cosmetic: cosmeticJson(item),
        owned: true,
        equipped: uc.equipped,
        wallet: {
          userId: updatedWallet.userId,
          balance: updatedWallet.balance,
          lifetimeEarned: updatedWallet.lifetimeEarned,
          lifetimeSpent: updatedWallet.lifetimeSpent,
          updatedAt: updatedWallet.updatedAt.toISOString(),
        },
      });
    } catch (err) {
      logger.error('[cosmetics] purchase error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /cosmetics/:id/equip
// ---------------------------------------------------------------------------

cosmeticsRouter.patch(
  '/:id/equip',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const cosmeticId = param(req, 'id');

      const [uc] = await db
        .select()
        .from(userCosmetics)
        .where(and(eq(userCosmetics.userId, req.userId!), eq(userCosmetics.cosmeticId, cosmeticId)))
        .limit(1);

      if (!uc) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'You do not own this cosmetic' });
        return;
      }

      const [cosmeticRow] = await db
        .select()
        .from(cosmetics)
        .where(eq(cosmetics.id, cosmeticId))
        .limit(1);

      if (!cosmeticRow) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Cosmetic not found' });
        return;
      }

      // Unequip any other cosmetic of the same type
      const userOwnedOfType = await db
        .select({ ucId: userCosmetics.id })
        .from(userCosmetics)
        .innerJoin(cosmetics, eq(cosmetics.id, userCosmetics.cosmeticId))
        .where(
          and(
            eq(userCosmetics.userId, req.userId!),
            eq(cosmetics.type, cosmeticRow.type),
            eq(userCosmetics.equipped, true),
          ),
        );

      for (const row of userOwnedOfType) {
        await db.update(userCosmetics).set({ equipped: false }).where(eq(userCosmetics.id, row.ucId));
      }

      const [updated] = await db
        .update(userCosmetics)
        .set({ equipped: true })
        .where(eq(userCosmetics.id, uc.id))
        .returning();

      res.status(200).json({
        cosmeticId: updated.cosmeticId,
        equipped: updated.equipped,
        type: cosmeticRow.type,
        name: cosmeticRow.name,
      });
    } catch (err) {
      logger.error('[cosmetics] equip error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /cosmetics/:id/equip
// ---------------------------------------------------------------------------

cosmeticsRouter.delete(
  '/:id/equip',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const cosmeticId = param(req, 'id');

      const [uc] = await db
        .select()
        .from(userCosmetics)
        .where(and(eq(userCosmetics.userId, req.userId!), eq(userCosmetics.cosmeticId, cosmeticId)))
        .limit(1);

      if (!uc) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'You do not own this cosmetic' });
        return;
      }

      await db.update(userCosmetics).set({ equipped: false }).where(eq(userCosmetics.id, uc.id));
      res.status(204).send();
    } catch (err) {
      logger.error('[cosmetics] unequip error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /cosmetics/:id/stats
// ---------------------------------------------------------------------------

cosmeticsRouter.get(
  '/:id/stats',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const cosmeticId = param(req, 'id');

      const [item] = await db.select().from(cosmetics).where(eq(cosmetics.id, cosmeticId)).limit(1);

      if (!item) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Cosmetic not found' });
        return;
      }

      const [salesRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(userCosmetics)
        .where(eq(userCosmetics.cosmeticId, cosmeticId));

      const totalSales = salesRow?.count ?? 0;

      res.status(200).json({
        cosmeticId: item.id,
        totalSales,
        totalRevenueGratonites: totalSales * item.price,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      });
    } catch (err) {
      logger.error('[cosmetics] stats error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);
