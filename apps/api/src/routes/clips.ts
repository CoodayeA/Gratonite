import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/index';
import { clips } from '../db/schema/clips';
import { guildMembers } from '../db/schema/guilds';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';

export const clipsRouter = Router({ mergeParams: true });

const createClipSchema = z.object({
  title: z.string().min(1).max(200),
  channelId: z.string().uuid().optional(),
  fileId: z.string().uuid().optional(),
  duration: z.number().int().positive().optional(),
});

/** GET /guilds/:guildId/clips */
clipsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;
  const limit = Math.min(Number(req.query.limit) || 50, 100);

  const rows = await db
    .select()
    .from(clips)
    .where(eq(clips.guildId, guildId))
    .orderBy(desc(clips.createdAt))
    .limit(limit);

  res.json(rows);
});

/** POST /guilds/:guildId/clips */
clipsRouter.post('/', requireAuth, validate(createClipSchema), async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;
  const userId = req.userId!;

  // Verify user is a member of the guild
  const [member] = await db
    .select({ id: guildMembers.id })
    .from(guildMembers)
    .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, userId)))
    .limit(1);

  if (!member) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'You are not a member of this guild' });
    return;
  }

  const { title, channelId, fileId, duration } = req.body;

  const [clip] = await db.insert(clips).values({
    userId,
    guildId,
    channelId: channelId || null,
    title,
    fileId: fileId || null,
    duration: duration || null,
  }).returning();

  res.status(201).json(clip);
});

/** GET /clips/:clipId */
clipsRouter.get('/:clipId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const clipId = req.params.clipId as string;

  const [clip] = await db
    .select()
    .from(clips)
    .where(eq(clips.id, clipId))
    .limit(1);

  if (!clip) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Clip not found' });
    return;
  }

  res.json(clip);
});

/** DELETE /clips/:clipId */
clipsRouter.delete('/:clipId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const clipId = req.params.clipId as string;
  const userId = req.userId!;

  const [clip] = await db
    .select()
    .from(clips)
    .where(eq(clips.id, clipId))
    .limit(1);

  if (!clip) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Clip not found' });
    return;
  }

  if (clip.userId !== userId) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'You can only delete your own clips' });
    return;
  }

  await db.delete(clips).where(eq(clips.id, clipId));

  res.json({ ok: true });
});
