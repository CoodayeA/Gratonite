import { Router, Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index';
import { watchParties, watchPartyMembers } from '../db/schema/watch-parties';
import { guildMembers } from '../db/schema/guilds';
import { channels } from '../db/schema/channels';
import { users } from '../db/schema/users';
import { requireAuth } from '../middleware/auth';

export const watchPartiesRouter = Router({ mergeParams: true });

/** GET /channels/:channelId/watch-party — get active party in channel */
watchPartiesRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const channelId = req.params.channelId as string;

  const [channel] = await db.select({ id: channels.id, guildId: channels.guildId }).from(channels)
    .where(eq(channels.id, channelId)).limit(1);
  if (!channel || !channel.guildId) { res.status(404).json({ code: 'NOT_FOUND' }); return; }

  const [member] = await db.select({ id: guildMembers.id }).from(guildMembers)
    .where(and(eq(guildMembers.guildId, channel.guildId), eq(guildMembers.userId, req.userId!))).limit(1);
  if (!member) { res.status(403).json({ code: 'FORBIDDEN' }); return; }

  const [party] = await db.select().from(watchParties)
    .where(and(eq(watchParties.channelId, channelId), eq(watchParties.isActive, true)))
    .limit(1);

  if (!party) { res.json({ party: null, members: [] }); return; }

  const members = await db
    .select({
      id: watchPartyMembers.id,
      userId: watchPartyMembers.userId,
      joinedAt: watchPartyMembers.joinedAt,
      username: users.username,
      displayName: users.displayName,
      avatarHash: users.avatarHash,
    })
    .from(watchPartyMembers)
    .innerJoin(users, eq(users.id, watchPartyMembers.userId))
    .where(eq(watchPartyMembers.partyId, party.id));

  res.json({ party, members });
});

/** POST /channels/:channelId/watch-party — create a watch party */
watchPartiesRouter.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const channelId = req.params.channelId as string;

  const [channel] = await db.select({ id: channels.id, guildId: channels.guildId }).from(channels)
    .where(eq(channels.id, channelId)).limit(1);
  if (!channel || !channel.guildId) { res.status(404).json({ code: 'NOT_FOUND' }); return; }

  const [member] = await db.select({ id: guildMembers.id }).from(guildMembers)
    .where(and(eq(guildMembers.guildId, channel.guildId), eq(guildMembers.userId, req.userId!))).limit(1);
  if (!member) { res.status(403).json({ code: 'FORBIDDEN' }); return; }

  const { title, videoUrl } = req.body;
  if (!title || !videoUrl) { res.status(400).json({ code: 'BAD_REQUEST', message: 'title and videoUrl are required' }); return; }

  // End any existing active party in this channel
  await db.update(watchParties)
    .set({ isActive: false, endedAt: new Date() })
    .where(and(eq(watchParties.channelId, channelId), eq(watchParties.isActive, true)));

  const [party] = await db.insert(watchParties).values({
    channelId,
    hostId: req.userId!,
    title: String(title).slice(0, 200),
    videoUrl: String(videoUrl).slice(0, 2000),
  }).returning();

  // Auto-join host
  await db.insert(watchPartyMembers).values({
    partyId: party.id,
    userId: req.userId!,
  });

  res.status(201).json(party);
});

/** POST /channels/:channelId/watch-party/:partyId/join — join a party */
watchPartiesRouter.post('/:partyId/join', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const partyId = req.params.partyId as string;

  const [party] = await db.select().from(watchParties)
    .where(and(eq(watchParties.id, partyId), eq(watchParties.isActive, true))).limit(1);
  if (!party) { res.status(404).json({ code: 'NOT_FOUND' }); return; }

  // Verify guild membership
  const [channel] = await db.select({ guildId: channels.guildId }).from(channels)
    .where(eq(channels.id, party.channelId)).limit(1);
  if (!channel?.guildId) { res.status(404).json({ code: 'NOT_FOUND' }); return; }

  const [member] = await db.select({ id: guildMembers.id }).from(guildMembers)
    .where(and(eq(guildMembers.guildId, channel.guildId), eq(guildMembers.userId, req.userId!))).limit(1);
  if (!member) { res.status(403).json({ code: 'FORBIDDEN' }); return; }

  await db.insert(watchPartyMembers).values({
    partyId,
    userId: req.userId!,
  }).onConflictDoNothing();

  res.json({ ok: true });
});

/** POST /channels/:channelId/watch-party/:partyId/leave — leave a party */
watchPartiesRouter.post('/:partyId/leave', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const partyId = req.params.partyId as string;

  await db.delete(watchPartyMembers)
    .where(and(eq(watchPartyMembers.partyId, partyId), eq(watchPartyMembers.userId, req.userId!)));

  res.json({ ok: true });
});

/** POST /channels/:channelId/watch-party/:partyId/end — end a party (host only) */
watchPartiesRouter.post('/:partyId/end', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const partyId = req.params.partyId as string;

  const [party] = await db.select().from(watchParties)
    .where(and(eq(watchParties.id, partyId), eq(watchParties.isActive, true))).limit(1);
  if (!party) { res.status(404).json({ code: 'NOT_FOUND' }); return; }

  if (party.hostId !== req.userId!) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Only the host can end the party' }); return;
  }

  await db.update(watchParties)
    .set({ isActive: false, endedAt: new Date() })
    .where(eq(watchParties.id, partyId));

  res.json({ ok: true });
});

/** PATCH /channels/:channelId/watch-party/:partyId/sync — update playback state (host only) */
watchPartiesRouter.patch('/:partyId/sync', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const partyId = req.params.partyId as string;

  const [party] = await db.select().from(watchParties)
    .where(and(eq(watchParties.id, partyId), eq(watchParties.isActive, true))).limit(1);
  if (!party) { res.status(404).json({ code: 'NOT_FOUND' }); return; }

  if (party.hostId !== req.userId!) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Only the host can sync playback' }); return;
  }

  const { currentTime, isPlaying } = req.body;
  const updates: Partial<{ currentTime: number; isPlaying: boolean }> = {};
  if (typeof currentTime === 'number') updates.currentTime = Math.max(0, Math.floor(currentTime));
  if (typeof isPlaying === 'boolean') updates.isPlaying = isPlaying;

  if (Object.keys(updates).length === 0) { res.status(400).json({ code: 'BAD_REQUEST' }); return; }

  const [updated] = await db.update(watchParties).set(updates).where(eq(watchParties.id, partyId)).returning();
  res.json(updated);
});
