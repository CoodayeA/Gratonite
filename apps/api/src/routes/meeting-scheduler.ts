/**
 * routes/meeting-scheduler.ts — "When are you free?" polls with timezone support.
 * Mounted at /guilds/:guildId/meetings
 */
import { Router, Request, Response } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/index';
import { meetingPolls, meetingVotes } from '../db/schema/meeting-scheduler';
import { guildMembers } from '../db/schema/guilds';
import { users } from '../db/schema/users';
import { requireAuth } from '../middleware/auth';

export const meetingSchedulerRouter = Router({ mergeParams: true });

// GET /guilds/:guildId/meetings — list meeting polls
meetingSchedulerRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;

  const polls = await db.select().from(meetingPolls)
    .where(eq(meetingPolls.guildId, guildId))
    .orderBy(desc(meetingPolls.createdAt));

  res.json(polls);
});

// POST /guilds/:guildId/meetings — create meeting poll
meetingSchedulerRouter.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;
  const { title, description, timeSlots, channelId } = req.body;

  if (!title || !Array.isArray(timeSlots) || timeSlots.length === 0) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'title and timeSlots required' }); return;
  }

  const [poll] = await db.insert(meetingPolls).values({
    guildId,
    channelId: channelId || guildId, // fallback
    title: String(title).slice(0, 200),
    description: description || null,
    timeSlots,
    createdBy: req.userId!,
  }).returning();

  res.status(201).json(poll);
});

// POST /guilds/:guildId/meetings/:pollId/vote — cast availability vote
meetingSchedulerRouter.post('/:pollId/vote', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { pollId } = req.params as Record<string, string>;
  const { selectedSlots, timezone } = req.body;

  if (!Array.isArray(selectedSlots)) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'selectedSlots required as array' }); return;
  }

  // Upsert vote
  const [existing] = await db.select().from(meetingVotes)
    .where(and(eq(meetingVotes.pollId, pollId), eq(meetingVotes.userId, req.userId!))).limit(1);

  if (existing) {
    await db.update(meetingVotes).set({ selectedSlots, timezone: timezone || null })
      .where(eq(meetingVotes.id, existing.id));
  } else {
    await db.insert(meetingVotes).values({
      pollId,
      userId: req.userId!,
      selectedSlots,
      timezone: timezone || null,
    });
  }

  res.json({ ok: true });
});

// GET /guilds/:guildId/meetings/:pollId — get poll with votes
meetingSchedulerRouter.get('/:pollId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { pollId } = req.params as Record<string, string>;

  const [poll] = await db.select().from(meetingPolls).where(eq(meetingPolls.id, pollId)).limit(1);
  if (!poll) { res.status(404).json({ code: 'NOT_FOUND' }); return; }

  const votes = await db.select({
    userId: meetingVotes.userId,
    selectedSlots: meetingVotes.selectedSlots,
    timezone: meetingVotes.timezone,
    username: users.username,
    displayName: users.displayName,
  }).from(meetingVotes)
    .innerJoin(users, eq(users.id, meetingVotes.userId))
    .where(eq(meetingVotes.pollId, pollId));

  res.json({ ...poll, votes });
});

// DELETE /guilds/:guildId/meetings/:pollId
meetingSchedulerRouter.delete('/:pollId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { pollId } = req.params as Record<string, string>;
  const [poll] = await db.select().from(meetingPolls).where(eq(meetingPolls.id, pollId)).limit(1);
  if (!poll) { res.status(404).json({ code: 'NOT_FOUND' }); return; }
  if (poll.createdBy !== req.userId!) { res.status(403).json({ code: 'FORBIDDEN' }); return; }

  await db.delete(meetingPolls).where(eq(meetingPolls.id, pollId));
  res.json({ ok: true });
});
