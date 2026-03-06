/**
 * routes/polls.ts — Express router for channel polls.
 *
 * Channel-scoped endpoints mounted at /api/v1/channels/:channelId/polls
 * Global endpoints mounted at /api/v1/polls
 *
 * Endpoints:
 *   POST   /channels/:channelId/polls        — Create a poll with options
 *   GET    /channels/:channelId/polls         — List polls in a channel
 *   GET    /polls/:pollId                     — Get poll with results
 *   PUT    /polls/:pollId/vote/:optionId      — Cast a vote
 *   DELETE /polls/:pollId/vote                — Remove vote(s)
 *   POST   /polls/:pollId/expire              — End a poll early (creator only)
 *   GET    /polls/:pollId/answers/:optionId/voters — Get voters for an option
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';

import { db } from '../db/index';
import { polls, pollOptions, pollVotes } from '../db/schema/polls';
import { users } from '../db/schema/users';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { getIO } from '../lib/socket-io';

// Channel-scoped router (mounted at /channels/:channelId/polls)
export const channelPollsRouter = Router({ mergeParams: true });

// Global router (mounted at /polls)
export const pollsRouter = Router({ mergeParams: true });

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const createPollSchema = z.object({
  question: z.string().min(1).max(500),
  options: z.array(z.string().min(1).max(255)).min(2).max(25),
  duration: z.number().int().positive().max(60 * 24 * 30).optional(), // minutes, max 30 days
  multiselect: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Helper: build poll response with vote counts
// ---------------------------------------------------------------------------

async function buildPollResponse(pollId: string, userId?: string) {
  // Get poll
  const [poll] = await db
    .select({
      id: polls.id,
      channelId: polls.channelId,
      question: polls.question,
      multipleChoice: polls.multipleChoice,
      expiresAt: polls.expiresAt,
      creatorId: polls.creatorId,
      createdAt: polls.createdAt,
      creatorUsername: users.username,
      creatorDisplayName: users.displayName,
    })
    .from(polls)
    .leftJoin(users, eq(users.id, polls.creatorId))
    .where(eq(polls.id, pollId))
    .limit(1);

  if (!poll) return null;

  // Get options
  const options = await db
    .select()
    .from(pollOptions)
    .where(eq(pollOptions.pollId, pollId))
    .orderBy(pollOptions.position);

  // Get vote counts per option
  const voteCounts = await db
    .select({
      optionId: pollVotes.optionId,
      count: sql<number>`count(*)::int`,
    })
    .from(pollVotes)
    .where(eq(pollVotes.pollId, pollId))
    .groupBy(pollVotes.optionId);

  const countMap = new Map(voteCounts.map(v => [v.optionId, v.count]));

  // Get total unique voters
  const [{ totalVoters }] = await db
    .select({ totalVoters: sql<number>`count(distinct ${pollVotes.userId})::int` })
    .from(pollVotes)
    .where(eq(pollVotes.pollId, pollId));

  // Check if current user voted
  let userVotes: string[] = [];
  if (userId) {
    const votes = await db
      .select({ optionId: pollVotes.optionId })
      .from(pollVotes)
      .where(and(eq(pollVotes.pollId, pollId), eq(pollVotes.userId, userId)));
    userVotes = votes.map(v => v.optionId);
  }

  return {
    id: poll.id,
    channelId: poll.channelId,
    question: poll.question,
    multipleChoice: poll.multipleChoice,
    expiresAt: poll.expiresAt,
    creatorId: poll.creatorId,
    creatorName: poll.creatorDisplayName ?? poll.creatorUsername ?? 'Unknown',
    createdAt: poll.createdAt,
    totalVoters,
    myVotes: userVotes,
    options: options.map(o => ({
      id: o.id,
      text: o.text,
      position: o.position,
      voteCount: countMap.get(o.id) ?? 0,
    })),
  };
}

// ---------------------------------------------------------------------------
// POST /channels/:channelId/polls — Create poll
// ---------------------------------------------------------------------------

channelPollsRouter.post('/', requireAuth, validate(createPollSchema), async (req: Request, res: Response): Promise<void> => {
  const { channelId } = req.params as Record<string, string>;
  const { question, options, duration, multiselect } = req.body;

  const expiresAt = duration ? new Date(Date.now() + duration * 60_000) : null;

  const [poll] = await db
    .insert(polls)
    .values({
      channelId,
      question,
      multipleChoice: multiselect ?? false,
      expiresAt,
      creatorId: req.userId!,
    })
    .returning();

  // Insert options
  const optionRows = (options as string[]).map((text: string, i: number) => ({
    pollId: poll.id,
    text,
    position: i,
  }));

  await db.insert(pollOptions).values(optionRows);

  const result = await buildPollResponse(poll.id, req.userId);

  // Fetch author info for the socket payload
  const [author] = await db
    .select({ id: users.id, username: users.username, displayName: users.displayName, avatarHash: users.avatarHash })
    .from(users)
    .where(eq(users.id, req.userId!))
    .limit(1);

  // Broadcast to all channel subscribers so other users see the poll instantly
  try {
    getIO().to(`channel:${channelId}`).emit('MESSAGE_CREATE', {
      id: `poll:${poll.id}`,
      channelId,
      authorId: req.userId!,
      author: author ?? null,
      content: '',
      attachments: [],
      embeds: [],
      edited: false,
      createdAt: poll.createdAt,
      expiresAt: null,
      replyToId: null,
      pollData: result,
    });
  } catch {
    // Non-fatal if socket not available
  }

  res.status(201).json(result);
});

// ---------------------------------------------------------------------------
// GET /channels/:channelId/polls — List polls
// ---------------------------------------------------------------------------

channelPollsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { channelId } = req.params as Record<string, string>;

  const rows = await db
    .select({ id: polls.id })
    .from(polls)
    .where(eq(polls.channelId, channelId))
    .orderBy(desc(polls.createdAt));

  const results = await Promise.all(rows.map(r => buildPollResponse(r.id, req.userId)));
  res.json(results.filter(Boolean));
});

// ---------------------------------------------------------------------------
// GET /polls/:pollId — Get poll with results
// ---------------------------------------------------------------------------

pollsRouter.get('/:pollId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { pollId } = req.params as Record<string, string>;
  const result = await buildPollResponse(pollId, req.userId);
  if (!result) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Poll not found' });
    return;
  }
  res.json(result);
});

// ---------------------------------------------------------------------------
// PUT /polls/:pollId/vote/:optionId — Cast a vote
// ---------------------------------------------------------------------------

pollsRouter.put('/:pollId/vote/:optionId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { pollId, optionId } = req.params as Record<string, string>;

  // Verify poll exists and not expired
  const [poll] = await db
    .select({ id: polls.id, multipleChoice: polls.multipleChoice, expiresAt: polls.expiresAt })
    .from(polls)
    .where(eq(polls.id, pollId))
    .limit(1);

  if (!poll) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Poll not found' });
    return;
  }
  if (poll.expiresAt && poll.expiresAt < new Date()) {
    res.status(400).json({ code: 'POLL_EXPIRED', message: 'This poll has expired' });
    return;
  }

  // Verify option belongs to poll
  const [option] = await db
    .select({ id: pollOptions.id })
    .from(pollOptions)
    .where(and(eq(pollOptions.id, optionId), eq(pollOptions.pollId, pollId)))
    .limit(1);

  if (!option) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Option not found' });
    return;
  }

  // For single-choice polls, remove existing vote first
  if (!poll.multipleChoice) {
    await db
      .delete(pollVotes)
      .where(and(eq(pollVotes.pollId, pollId), eq(pollVotes.userId, req.userId!)));
  }

  // Insert vote
  await db
    .insert(pollVotes)
    .values({ pollId, optionId, userId: req.userId! })
    .onConflictDoNothing();

  const result = await buildPollResponse(pollId, req.userId);
  res.json(result);
});

// ---------------------------------------------------------------------------
// DELETE /polls/:pollId/vote — Remove all votes
// ---------------------------------------------------------------------------

pollsRouter.delete('/:pollId/vote', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { pollId } = req.params as Record<string, string>;

  await db
    .delete(pollVotes)
    .where(and(eq(pollVotes.pollId, pollId), eq(pollVotes.userId, req.userId!)));

  const result = await buildPollResponse(pollId, req.userId);
  if (!result) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Poll not found' });
    return;
  }
  res.json(result);
});

// ---------------------------------------------------------------------------
// POST /polls/:pollId/expire — End poll early (creator only)
// ---------------------------------------------------------------------------

pollsRouter.post('/:pollId/expire', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { pollId } = req.params as Record<string, string>;

  const [poll] = await db
    .select({ id: polls.id, creatorId: polls.creatorId })
    .from(polls)
    .where(eq(polls.id, pollId))
    .limit(1);

  if (!poll) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Poll not found' });
    return;
  }
  if (poll.creatorId !== req.userId) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Only the poll creator can end this poll' });
    return;
  }

  await db
    .update(polls)
    .set({ expiresAt: new Date() })
    .where(eq(polls.id, pollId));

  const result = await buildPollResponse(pollId, req.userId);
  res.json(result);
});

// ---------------------------------------------------------------------------
// GET /polls/:pollId/answers/:optionId/voters — Get voters for an option
// ---------------------------------------------------------------------------

pollsRouter.get('/:pollId/answers/:optionId/voters', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { pollId, optionId } = req.params as Record<string, string>;

  const voters = await db
    .select({
      userId: pollVotes.userId,
      username: users.username,
      displayName: users.displayName,
      avatarHash: users.avatarHash,
    })
    .from(pollVotes)
    .leftJoin(users, eq(users.id, pollVotes.userId))
    .where(and(eq(pollVotes.pollId, pollId), eq(pollVotes.optionId, optionId)));

  res.json(voters.map(v => ({
    id: v.userId,
    username: v.username,
    displayName: v.displayName,
    avatarHash: v.avatarHash,
  })));
});

// Also support POST /polls/:pollId/answers for frontend compatibility
pollsRouter.post('/:pollId/answers', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { pollId } = req.params as Record<string, string>;
  const { optionIds } = req.body as { optionIds?: string[] };

  if (!optionIds || !Array.isArray(optionIds) || optionIds.length === 0) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'optionIds array required' });
    return;
  }

  // Verify poll exists and not expired
  const [poll] = await db
    .select({ id: polls.id, multipleChoice: polls.multipleChoice, expiresAt: polls.expiresAt })
    .from(polls)
    .where(eq(polls.id, pollId))
    .limit(1);

  if (!poll) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Poll not found' });
    return;
  }
  if (poll.expiresAt && poll.expiresAt < new Date()) {
    res.status(400).json({ code: 'POLL_EXPIRED', message: 'This poll has expired' });
    return;
  }

  // For single-choice, only use first option
  const idsToVote = poll.multipleChoice ? optionIds : [optionIds[0]];

  // Remove existing votes
  await db
    .delete(pollVotes)
    .where(and(eq(pollVotes.pollId, pollId), eq(pollVotes.userId, req.userId!)));

  // Verify options belong to poll
  const validOptions = await db
    .select({ id: pollOptions.id })
    .from(pollOptions)
    .where(and(eq(pollOptions.pollId, pollId), inArray(pollOptions.id, idsToVote)));

  const validIds = new Set(validOptions.map(o => o.id));

  // Insert votes
  const votes = idsToVote
    .filter(id => validIds.has(id))
    .map(optionId => ({ pollId, optionId, userId: req.userId! }));

  if (votes.length > 0) {
    await db.insert(pollVotes).values(votes).onConflictDoNothing();
  }

  const result = await buildPollResponse(pollId, req.userId);
  res.json(result);
});

// DELETE /polls/:pollId/answers/@me — Remove votes (frontend compat)
pollsRouter.delete('/:pollId/answers/@me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { pollId } = req.params as Record<string, string>;

  await db
    .delete(pollVotes)
    .where(and(eq(pollVotes.pollId, pollId), eq(pollVotes.userId, req.userId!)));

  res.json({ code: 'OK' });
});
