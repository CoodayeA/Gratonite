import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { eq, and, desc, lt, sql } from 'drizzle-orm';
import { db } from '../db/index';
import { guildTimelineEvents } from '../db/schema/guild-timeline';
import { Permissions } from '../db/schema/roles';
import { requireAuth } from '../middleware/auth';
import { hasPermission } from './roles';

export const timelineRouter = Router({ mergeParams: true });

/** GET /guilds/:guildId/timeline — get timeline events (paginated, newest first) */
timelineRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params as Record<string, string>;
    const before = req.query.before as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    let query = db.select()
      .from(guildTimelineEvents)
      .where(
        before
          ? and(eq(guildTimelineEvents.guildId, guildId), lt(guildTimelineEvents.createdAt, new Date(before)))
          : eq(guildTimelineEvents.guildId, guildId)
      )
      .orderBy(desc(guildTimelineEvents.createdAt))
      .limit(limit);

    const events = await query;
    res.json(events);
  } catch (err) {
    logger.error('[timeline] GET error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error'  });
  }
});

/** POST /guilds/:guildId/timeline — add custom event (requires MANAGE_GUILD) */
timelineRouter.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { guildId } = req.params as Record<string, string>;

    if (!(await hasPermission(userId, guildId, Permissions.MANAGE_GUILD))) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission' });
      return;
    }

    const { title, description, iconUrl } = req.body as {
      title: string;
      description?: string;
      iconUrl?: string;
    };

    if (!title || typeof title !== 'string') {
      res.status(400).json({ code: 'BAD_REQUEST', message: 'title is required'  });
      return;
    }

    const [event] = await db.insert(guildTimelineEvents).values({
      guildId,
      eventType: 'custom',
      title,
      description: description ?? null,
      iconUrl: iconUrl ?? null,
      createdBy: userId,
    }).returning();

    res.status(201).json(event);
  } catch (err) {
    logger.error('[timeline] POST error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error'  });
  }
});

/** DELETE /guilds/:guildId/timeline/:id — delete event (requires MANAGE_GUILD) */
timelineRouter.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { guildId, id } = req.params as Record<string, string>;

    if (!(await hasPermission(userId, guildId, Permissions.MANAGE_GUILD))) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission' });
      return;
    }

    const [deleted] = await db.delete(guildTimelineEvents)
      .where(and(
        eq(guildTimelineEvents.id, id),
        eq(guildTimelineEvents.guildId, guildId),
      ))
      .returning();

    if (!deleted) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Timeline event not found'  });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    logger.error('[timeline] DELETE error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error'  });
  }
});
