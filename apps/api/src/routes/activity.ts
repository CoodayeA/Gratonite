import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { eq, and, desc, lt, inArray } from 'drizzle-orm';
import { db } from '../db/index';
import { activityEvents } from '../db/schema/activity-feed';
import { relationships } from '../db/schema/relationships';
import { users } from '../db/schema/users';
import { requireAuth } from '../middleware/auth';

export const activityRouter = Router();

// Helper: record an activity event (fire-and-forget)
export async function recordActivity(userId: string, type: string, payload: Record<string, unknown> = {}) {
  try {
    await db.insert(activityEvents).values({ userId, type, payload });
  } catch (err) {
    logger.error('[activity] record error:', err);
  }
}

// GET /users/@me/feed — activity from friends + self, with cursor pagination + type filter
activityRouter.get('/users/@me/feed', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 50);
    const before = req.query.before as string | undefined;
    const typeFilter = req.query.type as string | undefined;

    // Get friend IDs — relationships uses requesterId/addresseeId columns
    const friends1 = await db
      .select({ otherId: relationships.addresseeId })
      .from(relationships)
      .where(and(eq(relationships.requesterId, userId), eq(relationships.type, 'FRIEND')))
      .limit(200);

    const friends2 = await db
      .select({ otherId: relationships.requesterId })
      .from(relationships)
      .where(and(eq(relationships.addresseeId, userId), eq(relationships.type, 'FRIEND')))
      .limit(200);

    const friendIds = [...new Set([
      userId,
      ...friends1.map(f => f.otherId),
      ...friends2.map(f => f.otherId),
    ])];

    const conditions = [inArray(activityEvents.userId, friendIds)];
    if (before) conditions.push(lt(activityEvents.createdAt, new Date(before)));
    if (typeFilter) conditions.push(eq(activityEvents.type, typeFilter));

    const events = await db.select({
      id: activityEvents.id,
      userId: activityEvents.userId,
      type: activityEvents.type,
      payload: activityEvents.payload,
      createdAt: activityEvents.createdAt,
      username: users.username,
      displayName: users.displayName,
      avatarHash: users.avatarHash,
    })
      .from(activityEvents)
      .innerJoin(users, eq(activityEvents.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(activityEvents.createdAt))
      .limit(limit);

    res.json(events);
  } catch (err) {
    logger.error('[activity] GET feed error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
