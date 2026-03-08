import { Router, Request, Response } from 'express';
import { eq, and, asc, isNull } from 'drizzle-orm';
import { db } from '../db/index';
import { musicRoomSettings, musicQueue } from '../db/schema/music-rooms';
import { guildMembers } from '../db/schema/guilds';
import { channels } from '../db/schema/channels';
import { Permissions } from '../db/schema/roles';
import { requireAuth } from '../middleware/auth';
import { hasPermission } from './roles';

export const musicRoomsRouter = Router({ mergeParams: true });

/** GET /channels/:channelId/music — get room settings + current queue */
musicRoomsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const channelId = req.params.channelId as string;

  const [channel] = await db.select({ id: channels.id, guildId: channels.guildId }).from(channels)
    .where(eq(channels.id, channelId)).limit(1);
  if (!channel || !channel.guildId) { res.status(404).json({ code: 'NOT_FOUND' }); return; }

  const [member] = await db.select({ id: guildMembers.id }).from(guildMembers)
    .where(and(eq(guildMembers.guildId, channel.guildId), eq(guildMembers.userId, req.userId!))).limit(1);
  if (!member) { res.status(403).json({ code: 'FORBIDDEN' }); return; }

  const [settings] = await db.select().from(musicRoomSettings)
    .where(eq(musicRoomSettings.channelId, channelId)).limit(1);

  const queue = await db.select().from(musicQueue)
    .where(and(eq(musicQueue.channelId, channelId), isNull(musicQueue.playedAt)))
    .orderBy(asc(musicQueue.position));

  res.json({ settings: settings || { channelId, mode: 'freeQueue', currentDjId: null, volume: 80 }, queue });
});

/** PUT /channels/:channelId/music/settings — update settings */
musicRoomsRouter.put('/settings', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const channelId = req.params.channelId as string;

  const [channel] = await db.select({ id: channels.id, guildId: channels.guildId }).from(channels)
    .where(eq(channels.id, channelId)).limit(1);
  if (!channel || !channel.guildId) { res.status(404).json({ code: 'NOT_FOUND' }); return; }

  if (!(await hasPermission(req.userId!, channel.guildId, Permissions.MANAGE_CHANNELS))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_CHANNELS permission' }); return;
  }

  const { mode, volume } = req.body;
  const values: Record<string, unknown> = { channelId };
  if (mode) values.mode = mode;
  if (volume !== undefined) values.volume = Math.max(0, Math.min(100, Number(volume)));

  const [row] = await db.insert(musicRoomSettings).values(values as any)
    .onConflictDoUpdate({
      target: musicRoomSettings.channelId,
      set: { ...(mode && { mode }), ...(volume !== undefined && { volume: values.volume as number }) },
    }).returning();

  res.json(row);
});

/** POST /channels/:channelId/music/queue — add track */
musicRoomsRouter.post('/queue', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const channelId = req.params.channelId as string;

  const [channel] = await db.select({ id: channels.id, guildId: channels.guildId }).from(channels)
    .where(eq(channels.id, channelId)).limit(1);
  if (!channel || !channel.guildId) { res.status(404).json({ code: 'NOT_FOUND' }); return; }

  const [member] = await db.select({ id: guildMembers.id }).from(guildMembers)
    .where(and(eq(guildMembers.guildId, channel.guildId), eq(guildMembers.userId, req.userId!))).limit(1);
  if (!member) { res.status(403).json({ code: 'FORBIDDEN' }); return; }

  const { url, title, thumbnail, duration } = req.body;
  if (!url || !title) { res.status(400).json({ code: 'BAD_REQUEST', message: 'url and title are required' }); return; }

  // Get next position
  const existing = await db.select().from(musicQueue)
    .where(and(eq(musicQueue.channelId, channelId), isNull(musicQueue.playedAt)))
    .orderBy(asc(musicQueue.position));
  const nextPos = existing.length > 0 ? (existing[existing.length - 1].position + 1) : 0;

  const [track] = await db.insert(musicQueue).values({
    channelId,
    url,
    title,
    thumbnail: thumbnail || null,
    duration: duration || 0,
    addedBy: req.userId!,
    position: nextPos,
  }).returning();

  res.status(201).json(track);
});

/** DELETE /channels/:channelId/music/queue/:id — remove track */
musicRoomsRouter.delete('/queue/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const trackId = req.params.id as string;

  const [track] = await db.select().from(musicQueue).where(eq(musicQueue.id, trackId)).limit(1);
  if (!track) { res.status(404).json({ code: 'NOT_FOUND' }); return; }

  if (track.addedBy !== req.userId!) {
    const [channel] = await db.select({ guildId: channels.guildId }).from(channels)
      .where(eq(channels.id, track.channelId)).limit(1);
    if (!channel?.guildId || !(await hasPermission(req.userId!, channel.guildId, Permissions.MANAGE_CHANNELS))) {
      res.status(403).json({ code: 'FORBIDDEN' }); return;
    }
  }

  await db.delete(musicQueue).where(eq(musicQueue.id, trackId));
  res.json({ ok: true });
});

/** POST /channels/:channelId/music/skip — vote to skip */
musicRoomsRouter.post('/skip', requireAuth, async (_req: Request, res: Response): Promise<void> => {
  // Skip votes are handled client-side via socket for real-time counting
  res.json({ ok: true, message: 'Skip vote registered' });
});

/** POST /channels/:channelId/music/next — advance to next track */
musicRoomsRouter.post('/next', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const channelId = req.params.channelId as string;

  const [settings] = await db.select().from(musicRoomSettings)
    .where(eq(musicRoomSettings.channelId, channelId)).limit(1);

  if (settings?.mode === 'djRotation' && settings.currentDjId !== req.userId!) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Only the current DJ can advance tracks' }); return;
  }

  // Mark current track as played
  const queue = await db.select().from(musicQueue)
    .where(and(eq(musicQueue.channelId, channelId), isNull(musicQueue.playedAt)))
    .orderBy(asc(musicQueue.position)).limit(1);

  if (queue.length > 0) {
    await db.update(musicQueue).set({ playedAt: new Date() }).where(eq(musicQueue.id, queue[0].id));
  }

  // Get next track
  const [next] = await db.select().from(musicQueue)
    .where(and(eq(musicQueue.channelId, channelId), isNull(musicQueue.playedAt)))
    .orderBy(asc(musicQueue.position)).limit(1);

  res.json({ next: next || null });
});
