import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';

import { db } from '../db/index';
import { guildWelcomeScreens } from '../db/schema/guild-welcome-screens';
import { guilds } from '../db/schema/guilds';
import { requireAuth } from '../middleware/auth';

export const welcomeScreenRouter = Router({ mergeParams: true });

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

const blockSchema = z.object({
  type: z.enum(['welcome_message', 'channels', 'rules', 'links']),
  title: z.string().max(200).optional(),
  content: z.string().max(2000).optional(),
  channelIds: z.array(z.string().uuid()).max(10).optional(),
  links: z.array(z.object({
    label: z.string().max(100),
    url: z.string().url().max(500),
  })).max(10).optional(),
});

const updateSchema = z.object({
  enabled: z.boolean().optional(),
  description: z.string().max(500).optional(),
  blocks: z.array(blockSchema).max(20).optional(),
});

/**
 * GET /guilds/:guildId/welcome-screen — Get welcome screen config.
 */
welcomeScreenRouter.get('/', requireAuth, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;

  const [screen] = await db
    .select()
    .from(guildWelcomeScreens)
    .where(eq(guildWelcomeScreens.guildId, guildId))
    .limit(1);

  if (!screen) {
    res.json({ guildId, enabled: false, description: null, blocks: [] });
    return;
  }

  res.json({
    id: screen.id,
    guildId: screen.guildId,
    enabled: screen.enabled,
    description: screen.description,
    blocks: screen.blocks,
    updatedAt: screen.updatedAt.toISOString(),
  });
}));

/**
 * PUT /guilds/:guildId/welcome-screen — Create or update welcome screen.
 * Only guild owner or admin can update.
 */
welcomeScreenRouter.put('/', requireAuth, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;

  // Check that user is the guild owner
  const [guild] = await db.select({ ownerId: guilds.ownerId }).from(guilds).where(eq(guilds.id, guildId)).limit(1);
  if (!guild) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Guild not found' });
    return;
  }
  if (guild.ownerId !== req.userId) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Only the server owner can manage the welcome screen' });
    return;
  }

  const parseResult = updateSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Validation failed', details: parseResult.error.issues });
    return;
  }

  const data = parseResult.data;
  const now = new Date();

  // Upsert
  const [existing] = await db
    .select({ id: guildWelcomeScreens.id })
    .from(guildWelcomeScreens)
    .where(eq(guildWelcomeScreens.guildId, guildId))
    .limit(1);

  let result;
  if (existing) {
    [result] = await db
      .update(guildWelcomeScreens)
      .set({
        ...(data.enabled !== undefined && { enabled: data.enabled }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.blocks !== undefined && { blocks: data.blocks }),
        updatedAt: now,
      })
      .where(eq(guildWelcomeScreens.guildId, guildId))
      .returning();
  } else {
    [result] = await db
      .insert(guildWelcomeScreens)
      .values({
        guildId,
        enabled: data.enabled ?? false,
        description: data.description ?? null,
        blocks: data.blocks ?? [],
      })
      .returning();
  }

  res.json({
    id: result.id,
    guildId: result.guildId,
    enabled: result.enabled,
    description: result.description,
    blocks: result.blocks,
    updatedAt: result.updatedAt.toISOString(),
  });
}));

/**
 * DELETE /guilds/:guildId/welcome-screen — Delete welcome screen.
 */
welcomeScreenRouter.delete('/', requireAuth, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;

  const [guild] = await db.select({ ownerId: guilds.ownerId }).from(guilds).where(eq(guilds.id, guildId)).limit(1);
  if (!guild || guild.ownerId !== req.userId) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Only the server owner can manage the welcome screen' });
    return;
  }

  await db.delete(guildWelcomeScreens).where(eq(guildWelcomeScreens.guildId, guildId));
  res.json({ message: 'Welcome screen deleted' });
}));
