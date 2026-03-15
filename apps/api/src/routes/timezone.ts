/**
 * routes/timezone.ts — User timezone display on profile.
 * Mounted at /users
 */
import { Router, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index';
import { userSettings } from '../db/schema/settings';
import { requireAuth } from '../middleware/auth';
import { logger } from '../lib/logger';

export const timezoneRouter = Router();

// GET /users/@me/timezone — get current user's timezone
timezoneRouter.get('/@me/timezone', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const [settings] = await db.select().from(userSettings)
    .where(eq(userSettings.userId, req.userId!)).limit(1);

  const prefs = (settings?.themePreferences as Record<string, unknown>) || {};
  res.json({ timezone: (prefs.timezone as string) || null });
});

// PATCH /users/@me/timezone — set timezone
timezoneRouter.patch('/@me/timezone', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { timezone } = req.body;
  if (!timezone || typeof timezone !== 'string') {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'timezone string required' }); return;
  }

  // Validate timezone
  try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }); } catch (err) {
    logger.debug({ msg: 'invalid timezone provided', err });
    res.status(400).json({ code: 'BAD_REQUEST', message: 'Invalid timezone' }); return;
  }

  const [existing] = await db.select().from(userSettings)
    .where(eq(userSettings.userId, req.userId!)).limit(1);

  if (existing) {
    const prefs = (existing.themePreferences as Record<string, unknown>) || {};
    prefs.timezone = timezone;
    await db.update(userSettings).set({ themePreferences: prefs, updatedAt: new Date() })
      .where(eq(userSettings.id, existing.id));
  } else {
    await db.insert(userSettings).values({
      userId: req.userId!,
      themePreferences: { timezone },
    });
  }

  res.json({ timezone });
});

// GET /users/:userId/timezone — get another user's timezone
timezoneRouter.get('/:userId/timezone', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.params.userId as string;
  const [settings] = await db.select().from(userSettings)
    .where(eq(userSettings.userId, userId)).limit(1);

  const prefs = (settings?.themePreferences as Record<string, unknown>) || {};
  const tz = (prefs.timezone as string) || null;

  let localTime: string | null = null;
  if (tz) {
    try {
      localTime = new Date().toLocaleTimeString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: true });
    } catch (err) { logger.debug({ msg: 'failed to format local time', err }); }
  }

  res.json({ timezone: tz, localTime });
});
