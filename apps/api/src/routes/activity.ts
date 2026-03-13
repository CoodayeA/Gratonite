import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { db } from '../db/index';
import { activityEvents } from '../db/schema/activity-feed';
import { relationships } from '../db/schema/relationships';
import { users } from '../db/schema/users';
import { requireAuth } from '../middleware/auth';

export const activityRouter = Router();

// GET /users/@me/feed — activity from friends + self
activityRouter.get('/users/@me/feed', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  try {
    // Get friend IDs — relationships uses requesterId/addresseeId columns
    // Only include FRIEND type rows to avoid showing activity from blocked/pending users
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
      .where(inArray(activityEvents.userId, friendIds))
      .orderBy(desc(activityEvents.createdAt))
      .limit(50);

    res.json(events);
  } catch (err) {
    logger.error('[activity] GET feed error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
