import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { eq, and, gte, lte, isNull } from 'drizzle-orm';
import { db } from '../db/index';
import { scheduledMessages } from '../db/schema/scheduled-messages';
import { channels } from '../db/schema/channels';
import { guilds } from '../db/schema/guilds';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { z } from 'zod';

export const scheduleCalendarRouter = Router();

const rescheduleSchema = z.object({
  scheduledAt: z.string().datetime(),
});

// GET /users/@me/scheduled-messages/calendar — get all scheduled messages for date range
scheduleCalendarRouter.get('/calendar', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const start = req.query.start as string | undefined;
    const end = req.query.end as string | undefined;

    const conditions = [
      eq(scheduledMessages.authorId, req.userId!),
      isNull(scheduledMessages.sentAt),
      isNull(scheduledMessages.cancelledAt),
    ];

    if (start) conditions.push(gte(scheduledMessages.scheduledAt, new Date(start)));
    if (end) conditions.push(lte(scheduledMessages.scheduledAt, new Date(end)));

    const results = await db.select({
      id: scheduledMessages.id,
      channelId: scheduledMessages.channelId,
      channelName: channels.name,
      guildId: channels.guildId,
      guildName: guilds.name,
      content: scheduledMessages.content,
      scheduledAt: scheduledMessages.scheduledAt,
      createdAt: scheduledMessages.createdAt,
    })
      .from(scheduledMessages)
      .innerJoin(channels, eq(scheduledMessages.channelId, channels.id))
      .leftJoin(guilds, eq(channels.guildId, guilds.id))
      .where(and(...conditions))
      .orderBy(scheduledMessages.scheduledAt);

    res.json(results);
  } catch (err) {
    logger.error('[schedule-calendar] GET error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// PATCH /users/@me/scheduled-messages/:id/reschedule — change scheduledAt time
scheduleCalendarRouter.patch('/:id/reschedule', requireAuth, validate(rescheduleSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const messageId = req.params.id as string;
    const { scheduledAt } = req.body;

    const newTime = new Date(scheduledAt);
    if (newTime <= new Date()) {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Scheduled time must be in the future' });
      return;
    }

    const [updated] = await db.update(scheduledMessages)
      .set({ scheduledAt: newTime })
      .where(and(
        eq(scheduledMessages.id, messageId),
        eq(scheduledMessages.authorId, req.userId!),
        isNull(scheduledMessages.sentAt),
        isNull(scheduledMessages.cancelledAt),
      ))
      .returning();

    if (!updated) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Scheduled message not found' });
      return;
    }

    res.json(updated);
  } catch (err) {
    logger.error('[schedule-calendar] PATCH reschedule error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});
