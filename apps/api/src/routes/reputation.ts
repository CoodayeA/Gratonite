/**
 * routes/reputation.ts — Upvote/downvote messages to build reputation.
 * Mounted at /
 */
import { Router, Request, Response } from 'express';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/index';
import { messageUpvotes } from '../db/schema/reputation';
import { messages } from '../db/schema/messages';
import { users } from '../db/schema/users';
import { requireAuth } from '../middleware/auth';

export const reputationRouter = Router();

// POST /channels/:channelId/messages/:messageId/upvote — upvote a message
reputationRouter.post('/channels/:channelId/messages/:messageId/upvote', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { messageId } = req.params as Record<string, string>;
  const value = req.body.value === -1 ? -1 : 1;

  // Get message author
  const [msg] = await db.select({ authorId: messages.authorId }).from(messages)
    .where(eq(messages.id, messageId)).limit(1);
  if (!msg || !msg.authorId) { res.status(404).json({ code: 'NOT_FOUND' }); return; }
  if (msg.authorId === req.userId!) { res.status(400).json({ code: 'BAD_REQUEST', message: 'Cannot upvote own message' }); return; }

  // Check existing vote
  const [existing] = await db.select().from(messageUpvotes)
    .where(and(eq(messageUpvotes.messageId, messageId), eq(messageUpvotes.userId, req.userId!))).limit(1);

  if (existing) {
    if (existing.value === value) {
      // Remove vote (toggle off)
      await db.delete(messageUpvotes).where(eq(messageUpvotes.id, existing.id));
    } else {
      // Change vote direction
      await db.update(messageUpvotes).set({ value }).where(eq(messageUpvotes.id, existing.id));
    }
  } else {
    await db.insert(messageUpvotes).values({
      messageId,
      userId: req.userId!,
      authorId: msg.authorId,
      value,
    });
  }

  // Get updated counts
  const [counts] = await db.select({
    upvotes: sql<number>`coalesce(sum(case when value = 1 then 1 else 0 end), 0)::int`,
    downvotes: sql<number>`coalesce(sum(case when value = -1 then 1 else 0 end), 0)::int`,
  }).from(messageUpvotes)
    .where(eq(messageUpvotes.messageId, messageId));

  res.json({
    messageId,
    upvotes: counts?.upvotes || 0,
    downvotes: counts?.downvotes || 0,
    score: (counts?.upvotes || 0) - (counts?.downvotes || 0),
  });
});

// GET /users/:userId/reputation — get user's reputation score
reputationRouter.get('/users/:userId/reputation', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.params.userId as string;

  const [stats] = await db.select({
    upvotes: sql<number>`coalesce(sum(case when value = 1 then 1 else 0 end), 0)::int`,
    downvotes: sql<number>`coalesce(sum(case when value = -1 then 1 else 0 end), 0)::int`,
  }).from(messageUpvotes)
    .where(eq(messageUpvotes.authorId, userId));

  const upvotes = stats?.upvotes || 0;
  const downvotes = stats?.downvotes || 0;

  res.json({
    userId,
    upvotes,
    downvotes,
    reputation: upvotes - downvotes,
  });
});
