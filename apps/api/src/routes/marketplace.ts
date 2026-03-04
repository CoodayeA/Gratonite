import { Router, Request, Response } from 'express';
import { z } from 'zod';

import { db } from '../db/index';
import { cosmetics } from '../db/schema/cosmetics';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';

export const marketplaceRouter = Router();

const createListingSchema = z.object({
  name: z.string().min(2).max(128),
  description: z.string().max(1000).optional(),
  type: z.enum(['avatar_frame', 'decoration', 'profile_effect', 'nameplate', 'name_plate', 'soundboard']),
  price: z.number().int().min(0),
  previewImageUrl: z.string().max(2000).optional(),
  assetUrl: z.string().max(2000).optional(),
  category: z.string().max(64).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).superRefine((value, ctx) => {
  if (value.type === 'soundboard' && value.price < 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['price'],
      message: 'Soundboard listings require a minimum price of 100.',
    });
  }
  if (value.type === 'soundboard' && !value.assetUrl && !value.previewImageUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['assetUrl'],
      message: 'Soundboard listings must include assetUrl or previewImageUrl.',
    });
  }
});

marketplaceRouter.post(
  '/listings',
  requireAuth,
  validate(createListingSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body as z.infer<typeof createListingSchema>;
      const normalizedType = body.type === 'name_plate' ? 'nameplate' : body.type;
      const [created] = await db
        .insert(cosmetics)
        .values({
          creatorId: req.userId!,
          name: body.name.trim(),
          description: body.description ?? null,
          type: normalizedType,
          price: body.price,
          previewImageUrl: body.previewImageUrl ?? null,
          assetUrl: body.assetUrl ?? null,
          assetConfig: body.metadata ?? (body.category ? { category: body.category } : null),
          status: 'pending_review',
          isPublished: false,
        })
        .returning({ id: cosmetics.id, createdAt: cosmetics.createdAt });

      res.status(201).json({
        listingId: created.id,
        createdAt: created.createdAt.toISOString(),
      });
    } catch (err) {
      console.error('[marketplace] create listing error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);
