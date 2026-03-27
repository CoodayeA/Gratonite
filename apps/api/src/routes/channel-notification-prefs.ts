import { Router, Request, Response } from 'express';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index';
import { channelNotificationPrefs } from '../db/schema/channel-notification-prefs';
import { requireAuth } from '../middleware/auth';

export const channelNotifPrefsRouter = Router({ mergeParams: true });
export const channelNotifPrefsBulkRouter = Router();

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

/** GET /api/v1/channels/notification-prefs/bulk?channelIds=a,b,c */
channelNotifPrefsBulkRouter.get('/channels/notification-prefs/bulk', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const raw = String(req.query.channelIds ?? '').trim();
  const channelIds = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 500);

  if (channelIds.length === 0) {
    res.json({});
    return;
  }

  const rows = await db
    .select()
    .from(channelNotificationPrefs)
    .where(and(
      eq(channelNotificationPrefs.userId, req.userId!),
      inArray(channelNotificationPrefs.channelId, channelIds),
    ));

  const out: Record<string, { level: string; mutedUntil: string | null }> = {};
  for (const id of channelIds) {
    out[id] = { level: 'default', mutedUntil: null };
  }
  for (const row of rows) {
    out[row.channelId] = {
      level: row.level,
      mutedUntil: row.mutedUntil ? row.mutedUntil.toISOString() : null,
    };
  }

  res.json(out);
});
