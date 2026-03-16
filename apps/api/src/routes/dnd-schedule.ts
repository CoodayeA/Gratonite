import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { eq } from 'drizzle-orm';
import { db } from '../db/index';
import { dndSchedules } from '../db/schema/dnd-schedules';
import { requireAuth } from '../middleware/auth';

export const dndScheduleRouter = Router();

// GET /users/@me/dnd-schedule — get current schedule
dndScheduleRouter.get('/users/@me/dnd-schedule', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [schedule] = await db.select()
      .from(dndSchedules)
      .where(eq(dndSchedules.userId, req.userId!))
      .limit(1);
    res.json(schedule || null);
  } catch (err) {
    logger.error('[dnd-schedule] GET error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// PUT /users/@me/dnd-schedule — set/update schedule
dndScheduleRouter.put('/users/@me/dnd-schedule', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { startTime, endTime, days, timezone, enabled } = req.body as {
      startTime: string;
      endTime: string;
      days?: number[];
      timezone?: string;
      enabled?: boolean;
    };

    if (!startTime || !endTime) {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'startTime and endTime are required' });
      return;
    }

    // Validate HH:mm format
    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'startTime and endTime must be in HH:mm format' });
      return;
    }

    if (days !== undefined && (!Array.isArray(days) || days.some((d) => typeof d !== 'number' || d < 0 || d > 6))) {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'days must be an array of numbers 0-6' });
      return;
    }

    const values: Record<string, any> = {
      userId: req.userId! as string,
      startTime,
      endTime,
    };
    if (days !== undefined) values.days = days;
    if (timezone !== undefined) values.timezone = timezone;
    if (enabled !== undefined) values.enabled = enabled;

    const [schedule] = await db.insert(dndSchedules)
      .values(values as any)
      .onConflictDoUpdate({
        target: [dndSchedules.userId],
        set: {
          startTime,
          endTime,
          ...(days !== undefined && { days }),
          ...(timezone !== undefined && { timezone }),
          ...(enabled !== undefined && { enabled }),
        },
      })
      .returning();

    res.json(schedule);
  } catch (err) {
    logger.error('[dnd-schedule] PUT error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// DELETE /users/@me/dnd-schedule — remove schedule
dndScheduleRouter.delete('/users/@me/dnd-schedule', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.delete(dndSchedules)
      .where(eq(dndSchedules.userId, req.userId!));
    res.json({ ok: true });
  } catch (err) {
    logger.error('[dnd-schedule] DELETE error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});
