import { Router, Request, Response } from 'express';
import { eq, and, asc, sql } from 'drizzle-orm';
import { db } from '../db/index';
import { playlists, playlistTracks, playlistVotes } from '../db/schema/playlists';
import { guildMembers } from '../db/schema/guilds';
import { channels } from '../db/schema/channels';
import { users } from '../db/schema/users';
import { requireAuth } from '../middleware/auth';

export const playlistsRouter = Router({ mergeParams: true });

/** GET /channels/:channelId/playlists — list playlists for channel */
playlistsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const channelId = req.params.channelId as string;

  const [channel] = await db.select({ id: channels.id, guildId: channels.guildId }).from(channels)
    .where(eq(channels.id, channelId)).limit(1);
  if (!channel || !channel.guildId) { res.status(404).json({ code: 'NOT_FOUND' }); return; }

  const [member] = await db.select({ id: guildMembers.id }).from(guildMembers)
    .where(and(eq(guildMembers.guildId, channel.guildId), eq(guildMembers.userId, req.userId!))).limit(1);
  if (!member) { res.status(403).json({ code: 'FORBIDDEN' }); return; }

  const rows = await db.select().from(playlists)
    .where(and(eq(playlists.channelId, channelId), eq(playlists.isActive, true)));

  res.json(rows);
});

/** POST /channels/:channelId/playlists — create a playlist */
playlistsRouter.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const channelId = req.params.channelId as string;

  const [channel] = await db.select({ id: channels.id, guildId: channels.guildId }).from(channels)
    .where(eq(channels.id, channelId)).limit(1);
  if (!channel || !channel.guildId) { res.status(404).json({ code: 'NOT_FOUND' }); return; }

  const [member] = await db.select({ id: guildMembers.id }).from(guildMembers)
    .where(and(eq(guildMembers.guildId, channel.guildId), eq(guildMembers.userId, req.userId!))).limit(1);
  if (!member) { res.status(403).json({ code: 'FORBIDDEN' }); return; }

  const { name } = req.body;
  if (!name) { res.status(400).json({ code: 'BAD_REQUEST', message: 'name is required' }); return; }

  const [row] = await db.insert(playlists).values({
    channelId,
    name: String(name).slice(0, 100),
    createdBy: req.userId!,
  }).returning();

  res.status(201).json(row);
});

/** GET /channels/:channelId/playlists/:playlistId/tracks — get tracks */
playlistsRouter.get('/:playlistId/tracks', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const playlistId = req.params.playlistId as string;

  const [playlist] = await db.select().from(playlists).where(eq(playlists.id, playlistId)).limit(1);
  if (!playlist) { res.status(404).json({ code: 'NOT_FOUND' }); return; }

  const tracks = await db
    .select({
      id: playlistTracks.id,
      playlistId: playlistTracks.playlistId,
      url: playlistTracks.url,
      title: playlistTracks.title,
      artist: playlistTracks.artist,
      thumbnail: playlistTracks.thumbnail,
      duration: playlistTracks.duration,
      addedBy: playlistTracks.addedBy,
      position: playlistTracks.position,
      played: playlistTracks.played,
      skipped: playlistTracks.skipped,
      createdAt: playlistTracks.createdAt,
      addedByUsername: users.username,
      addedByDisplayName: users.displayName,
    })
    .from(playlistTracks)
    .innerJoin(users, eq(users.id, playlistTracks.addedBy))
    .where(eq(playlistTracks.playlistId, playlistId))
    .orderBy(asc(playlistTracks.position));

  // Get vote counts per track
  const trackIds = tracks.map(t => t.id);
  let voteMap: Record<string, { skip: number; keep: number }> = {};
  if (trackIds.length > 0) {
    const votes = await db
      .select({
        trackId: playlistVotes.trackId,
        vote: playlistVotes.vote,
        count: sql<number>`count(*)::int`,
      })
      .from(playlistVotes)
      .where(sql`${playlistVotes.trackId} = ANY(${trackIds})`)
      .groupBy(playlistVotes.trackId, playlistVotes.vote);

    for (const v of votes) {
      if (!voteMap[v.trackId]) voteMap[v.trackId] = { skip: 0, keep: 0 };
      if (v.vote === 'skip') voteMap[v.trackId].skip = v.count;
      else voteMap[v.trackId].keep = v.count;
    }
  }

  const result = tracks.map(t => ({
    ...t,
    votes: voteMap[t.id] || { skip: 0, keep: 0 },
  }));

  res.json({ tracks: result, currentTrackId: playlist.currentTrackId });
});

/** POST /channels/:channelId/playlists/:playlistId/tracks — add a track */
playlistsRouter.post('/:playlistId/tracks', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const channelId = req.params.channelId as string;
  const playlistId = req.params.playlistId as string;

  const [playlist] = await db.select().from(playlists).where(eq(playlists.id, playlistId)).limit(1);
  if (!playlist || playlist.channelId !== channelId) { res.status(404).json({ code: 'NOT_FOUND' }); return; }

  const [channel] = await db.select({ guildId: channels.guildId }).from(channels)
    .where(eq(channels.id, channelId)).limit(1);
  if (!channel?.guildId) { res.status(404).json({ code: 'NOT_FOUND' }); return; }

  const [member] = await db.select({ id: guildMembers.id }).from(guildMembers)
    .where(and(eq(guildMembers.guildId, channel.guildId), eq(guildMembers.userId, req.userId!))).limit(1);
  if (!member) { res.status(403).json({ code: 'FORBIDDEN' }); return; }

  const { url, title, artist, thumbnail, duration } = req.body;
  if (!url || !title) { res.status(400).json({ code: 'BAD_REQUEST', message: 'url and title are required' }); return; }

  // Get next position
  const existing = await db.select({ position: playlistTracks.position }).from(playlistTracks)
    .where(eq(playlistTracks.playlistId, playlistId))
    .orderBy(asc(playlistTracks.position));
  const nextPos = existing.length > 0 ? existing[existing.length - 1].position + 1 : 0;

  const [track] = await db.insert(playlistTracks).values({
    playlistId,
    url: String(url).slice(0, 2000),
    title: String(title).slice(0, 200),
    artist: artist ? String(artist).slice(0, 100) : null,
    thumbnail: thumbnail ? String(thumbnail).slice(0, 2000) : null,
    duration: Math.max(0, Number(duration) || 0),
    addedBy: req.userId!,
    position: nextPos,
  }).returning();

  res.status(201).json(track);
});

/** DELETE /channels/:channelId/playlists/:playlistId/tracks/:trackId — remove a track */
playlistsRouter.delete('/:playlistId/tracks/:trackId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const trackId = req.params.trackId as string;

  const [track] = await db.select().from(playlistTracks).where(eq(playlistTracks.id, trackId)).limit(1);
  if (!track) { res.status(404).json({ code: 'NOT_FOUND' }); return; }

  // Allow only track adder or guild admin
  if (track.addedBy !== req.userId!) {
    const [playlist] = await db.select({ channelId: playlists.channelId }).from(playlists)
      .where(eq(playlists.id, track.playlistId)).limit(1);
    if (!playlist) { res.status(404).json({ code: 'NOT_FOUND' }); return; }
  }

  await db.delete(playlistTracks).where(eq(playlistTracks.id, trackId));
  res.json({ ok: true });
});

/** POST /channels/:channelId/playlists/:playlistId/tracks/:trackId/vote — vote on a track */
playlistsRouter.post('/:playlistId/tracks/:trackId/vote', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const trackId = req.params.trackId as string;
  const { vote } = req.body;

  if (!vote || !['skip', 'keep'].includes(vote)) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'vote must be "skip" or "keep"' }); return;
  }

  const [track] = await db.select().from(playlistTracks).where(eq(playlistTracks.id, trackId)).limit(1);
  if (!track) { res.status(404).json({ code: 'NOT_FOUND' }); return; }

  await db.insert(playlistVotes).values({
    trackId,
    userId: req.userId!,
    vote,
  }).onConflictDoUpdate({
    target: [playlistVotes.trackId, playlistVotes.userId],
    set: { vote, createdAt: new Date() },
  });

  // Get updated vote counts
  const votes = await db
    .select({
      vote: playlistVotes.vote,
      count: sql<number>`count(*)::int`,
    })
    .from(playlistVotes)
    .where(eq(playlistVotes.trackId, trackId))
    .groupBy(playlistVotes.vote);

  const counts = { skip: 0, keep: 0 };
  for (const v of votes) {
    if (v.vote === 'skip') counts.skip = v.count;
    else counts.keep = v.count;
  }

  // Auto-skip if enough votes (3+ skip votes and skip > keep)
  if (counts.skip >= 3 && counts.skip > counts.keep) {
    await db.update(playlistTracks).set({ skipped: true }).where(eq(playlistTracks.id, trackId));
  }

  res.json({ votes: counts, skipped: counts.skip >= 3 && counts.skip > counts.keep });
});

/** POST /channels/:channelId/playlists/:playlistId/next — advance to next track */
playlistsRouter.post('/:playlistId/next', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const playlistId = req.params.playlistId as string;

  const [playlist] = await db.select().from(playlists).where(eq(playlists.id, playlistId)).limit(1);
  if (!playlist) { res.status(404).json({ code: 'NOT_FOUND' }); return; }

  // Mark current track as played
  if (playlist.currentTrackId) {
    await db.update(playlistTracks)
      .set({ played: true })
      .where(eq(playlistTracks.id, playlist.currentTrackId));
  }

  // Get next unplayed/unskipped track
  const [next] = await db.select().from(playlistTracks)
    .where(and(
      eq(playlistTracks.playlistId, playlistId),
      eq(playlistTracks.played, false),
      eq(playlistTracks.skipped, false),
    ))
    .orderBy(asc(playlistTracks.position))
    .limit(1);

  if (next) {
    await db.update(playlists).set({ currentTrackId: next.id }).where(eq(playlists.id, playlistId));
  } else {
    await db.update(playlists).set({ currentTrackId: null }).where(eq(playlists.id, playlistId));
  }

  res.json({ next: next || null });
});
