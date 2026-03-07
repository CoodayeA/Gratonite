import { Router, Request, Response } from 'express';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/index';
import { channelNotificationPrefs } from '../db/schema/channel-notification-prefs';
import { requireAuth } from '../middleware/auth';

export const channelNotifPrefsRouter = Router({ mergeParams: true });

/** GET /api/v1/channels/:channelId/notification-prefs */
channelNotifPrefsRouter.get('/notification-prefs', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { channelId } = req.params as Record<string, string>;

  const [pref] = await db
    .select()
    .from(channelNotificationPrefs)
    .where(and(
      eq(channelNotificationPrefs.userId, req.userId!),
      eq(channelNotificationPrefs.channelId, channelId),
    ))
    .limit(1);

  if (!pref) {
    res.json({ level: 'default', mutedUntil: null });
    return;
  }

  res.json(pref);
});

/** PUT /api/v1/channels/:channelId/notification-prefs */
channelNotifPrefsRouter.put('/notification-prefs', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { channelId } = req.params as Record<string, string>;
  const { level, mutedUntil } = req.body as { level: string; mutedUntil?: string | null };

  if (!['all', 'mentions', 'none', 'default'].includes(level)) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'level must be one of: all, mentions, none, default' });
    return;
  }

  const parsedMutedUntil = mutedUntil ? new Date(mutedUntil) : null;

  const [upserted] = await db
    .insert(channelNotificationPrefs)
    .values({
      userId: req.userId!,
      channelId,
      level,
      mutedUntil: parsedMutedUntil,
    })
    .onConflictDoUpdate({
      target: [channelNotificationPrefs.userId, channelNotificationPrefs.channelId],
      set: {
        level,
        mutedUntil: parsedMutedUntil,
      },
    })
    .returning();

  res.json(upserted);
});
