import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index';
import { stickers } from '../db/schema/stickers';
import { guildMembers } from '../db/schema/guilds';
import { Permissions } from '../db/schema/roles';
import { requireAuth } from '../middleware/auth';
import { hasPermission } from './roles';

export const stickersRouter = Router({ mergeParams: true });

const uuidSchema = z.string().uuid();

// GET /default — platform sticker packs (future)
stickersRouter.get('/default', (_req: Request, res: Response) => {
  res.json([]);
});

// GET /guilds/:guildId or GET / (when mounted at /guilds/:guildId/stickers)
stickersRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId } = req.params as Record<string, string>;
  if (!guildId) { res.json([]); return; }
  if (!uuidSchema.safeParse(guildId).success) {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: 'guildId must be a valid UUID' }); return;
  }

  // Verify membership
  const [member] = await db
    .select({ id: guildMembers.id })
    .from(guildMembers)
    .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, req.userId!)))
    .limit(1);
  if (!member) { res.status(403).json({ code: 'FORBIDDEN', message: 'Not a guild member' }); return; }

  const rows = await db.select().from(stickers).where(eq(stickers.guildId, guildId));
  res.json(rows);
});

// POST / — create sticker
stickersRouter.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId } = req.params as Record<string, string>;
  if (!guildId) { res.status(400).json({ code: 'BAD_REQUEST', message: 'guildId required'  }); return; }

  if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_EMOJIS))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_EMOJIS permission' }); return;
  }

  const { name, assetUrl, description, tags } = req.body as {
    name?: string; assetUrl?: string; description?: string; tags?: string[];
  };
  if (!name || !assetUrl) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'name and assetUrl are required'  }); return;
  }

  const [sticker] = await db.insert(stickers).values({
    guildId,
    name,
    assetUrl,
    description: description || null,
    tags: tags || [],
    creatorId: req.userId!,
  }).returning();

  res.status(201).json(sticker);
});

// DELETE /:stickerId — delete sticker
stickersRouter.delete('/:stickerId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId, stickerId } = req.params as Record<string, string>;
  if (!guildId) { res.status(400).json({ code: 'BAD_REQUEST', message: 'guildId required'  }); return; }

  if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_EMOJIS))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_EMOJIS permission' }); return;
  }

  const [sticker] = await db.select().from(stickers)
    .where(and(eq(stickers.id, stickerId), eq(stickers.guildId, guildId)))
    .limit(1);
  if (!sticker) { res.status(404).json({ code: 'NOT_FOUND', message: 'Sticker not found' }); return; }

  await db.delete(stickers).where(eq(stickers.id, stickerId));
  res.json({ code: 'OK', message: 'Sticker deleted' });
});

// PATCH /:stickerId — update sticker name or description
stickersRouter.patch('/:stickerId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId, stickerId } = req.params as Record<string, string>;
  if (!guildId) { res.status(400).json({ code: 'BAD_REQUEST', message: 'guildId required'  }); return; }

  if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_EMOJIS))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_EMOJIS permission' }); return;
  }

  const { name, description, tags } = req.body as { name?: string; description?: string; tags?: string[] };
  if (!name && description === undefined && !tags) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'Provide at least one field to update' }); return;
  }

  const updates: Record<string, unknown> = {};
  if (name) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (tags) updates.tags = tags;

  const [updated] = await db.update(stickers)
    .set(updates)
    .where(and(eq(stickers.id, stickerId), eq(stickers.guildId, guildId)))
    .returning();

  if (!updated) { res.status(404).json({ code: 'NOT_FOUND', message: 'Sticker not found' }); return; }
  res.json(updated);
});
