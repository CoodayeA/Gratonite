import { Router, Request, Response } from 'express';
import { eq, and, lte, gte } from 'drizzle-orm';
import { db } from '../db/index';
import { seasonalEvents, userEventProgress } from '../db/schema/seasonal-events';
import { requireAuth } from '../middleware/auth';

export const seasonalEventsRouter = Router();

// GET /events/active — list currently active seasonal events
seasonalEventsRouter.get('/events/active', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const active = await db.select().from(seasonalEvents)
      .where(and(lte(seasonalEvents.startAt, now), gte(seasonalEvents.endAt, now)));
    res.json(active);
  } catch (err) {
    console.error('[seasonal-events] GET active error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /events/:eventId/progress
seasonalEventsRouter.get('/events/:eventId/progress', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const eventId = req.params.eventId as string;
  try {
    const [progress] = await db.select().from(userEventProgress)
      .where(and(eq(userEventProgress.userId, userId), eq(userEventProgress.eventId, eventId)));
    res.json(progress ?? { userId, eventId, points: 0, claimedRewards: [] });
  } catch (err) {
    console.error('[seasonal-events] GET progress error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /events/:eventId/claim
seasonalEventsRouter.post('/events/:eventId/claim', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const eventId = req.params.eventId as string;
  const { milestoneId } = req.body ?? {};
  try {
    const [event] = await db.select().from(seasonalEvents).where(eq(seasonalEvents.id, eventId)).limit(1);
    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    const now = new Date();
    if (now < event.startAt || now > event.endAt) {
      res.status(400).json({ error: 'Event is not active' });
      return;
    }

    if (!milestoneId) {
      res.status(400).json({ error: 'milestoneId is required' });
      return;
    }

    const [progress] = await db.select().from(userEventProgress)
      .where(and(eq(userEventProgress.userId, userId), eq(userEventProgress.eventId, eventId)));

    const currentRewards = (progress?.claimedRewards ?? []) as string[];

    if (currentRewards.includes(milestoneId)) {
      res.status(400).json({ error: 'Milestone already claimed' });
      return;
    }

    const updatedRewards = [...currentRewards, milestoneId];

    if (progress) {
      await db.update(userEventProgress)
        .set({ claimedRewards: updatedRewards })
        .where(and(eq(userEventProgress.userId, userId), eq(userEventProgress.eventId, eventId)));
    } else {
      await db.insert(userEventProgress).values({
        userId,
        eventId,
        points: 0,
        claimedRewards: updatedRewards,
      });
    }

    res.json({ userId, eventId, points: progress?.points ?? 0, claimedRewards: updatedRewards });
  } catch (err) {
    console.error('[seasonal-events] POST claim error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
