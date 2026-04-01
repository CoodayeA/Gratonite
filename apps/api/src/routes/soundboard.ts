/**
 * routes/soundboard.ts — Custom soundboard for guilds (item 97)
 * Mounted at /api/v1/guilds/:guildId/soundboard
 */
import { Router, Request, Response } from 'express';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/index';
import { guildSoundboard } from '../db/schema/guild-soundboard';
import { guildMembers } from '../db/schema/guilds';
import { Permissions } from '../db/schema/roles';
import { requireAuth } from '../middleware/auth';
import { hasPermission } from './roles';
import { handleAppError } from '../lib/errors';

export const soundboardRouter = Router({ mergeParams: true });

/** GET / — List soundboard clips */
soundboardRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;

  try {
    const [membership] = await db.select({ id: guildMembers.id }).from(guildMembers)
      .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, req.userId!))).limit(1);
    if (!membership) { res.status(403).json({ code: 'FORBIDDEN', message: 'Not a guild member' }); return; }

    const clips = await db.select().from(guildSoundboard).where(eq(guildSoundboard.guildId, guildId));
    res.json(clips);
  } catch (err) {
    handleAppError(res, err, 'soundboard');
  }
});

/** POST / — Upload a sound clip */
soundboardRouter.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;

  if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission' }); return;
  }

  const { name, fileHash, emoji, volume } = req.body as {
    name: string; fileHash: string; emoji?: string; volume?: number;
  };

  if (!name || !fileHash) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'name and fileHash required' }); return;
  }

  try {
    const countResult = await db.select({ count: sql<number>`count(*)::int` })
      .from(guildSoundboard).where(eq(guildSoundboard.guildId, guildId));
    if ((countResult[0]?.count ?? 0) >= 50) {
      res.status(400).json({ code: 'LIMIT_REACHED', message: 'Max 50 soundboard clips per server' }); return;
    }

    const [clip] = await db.insert(guildSoundboard).values({
      guildId,
      name: name.trim().slice(0, 100),
      fileHash,
      uploadedBy: req.userId!,
      emoji: emoji?.slice(0, 10) || null,
      volume: Math.max(0, Math.min(2, volume ?? 1)),
    }).returning();

    res.status(201).json(clip);
  } catch (err) {
    handleAppError(res, err, 'soundboard');
  }
});

/** POST /:clipId/play — Increment play count */
soundboardRouter.post('/:clipId/play', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;
  const clipId = req.params.clipId as string;

  try {
    const [membership] = await db.select({ id: guildMembers.id }).from(guildMembers)
      .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, req.userId!))).limit(1);
    if (!membership) { res.status(403).json({ code: 'FORBIDDEN', message: 'Not a guild member' }); return; }

    const updated = await db.update(guildSoundboard)
      .set({ uses: sql`${guildSoundboard.uses} + 1` })
      .where(and(eq(guildSoundboard.id, clipId), eq(guildSoundboard.guildId, guildId)))
      .returning({ id: guildSoundboard.id });
    if (updated.length === 0) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Soundboard clip not found' });
      return;
    }
    res.json({ code: 'OK' });
  } catch (err) {
    handleAppError(res, err, 'soundboard');
  }
});

/** DELETE /:clipId — Delete a clip */
soundboardRouter.delete('/:clipId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;
  const clipId = req.params.clipId as string;

  if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission' }); return;
  }

  try {
    const deleted = await db.delete(guildSoundboard)
      .where(and(eq(guildSoundboard.id, clipId), eq(guildSoundboard.guildId, guildId)))
      .returning({ id: guildSoundboard.id });
    if (deleted.length === 0) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Soundboard clip not found' });
      return;
    }
    res.json({ code: 'OK' });
  } catch (err) {
    handleAppError(res, err, 'soundboard');
  }
});
