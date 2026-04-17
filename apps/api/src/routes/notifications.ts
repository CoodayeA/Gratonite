import { Router, Request, Response } from 'express';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { db } from '../db/index';
import { notifications } from '../db/schema/notifications';
import { channels } from '../db/schema/channels';
import { guilds } from '../db/schema/guilds';
import { requireAuth } from '../middleware/auth';
import { evaluateNotificationTrust, getStoredNotificationTrust } from '../lib/notificationTrustMatrix';

export const notificationsRouter = Router();

/** GET /api/v1/notifications */
notificationsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const limit = Math.min(Number(req.query.limit) || 50, 100);

  const notifs = await db.select().from(notifications)
    .where(eq(notifications.userId, req.userId!))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  // Collect unique guild/channel ids to resolve names in single queries.
  const guildIds = new Set<string>();
  const channelIds = new Set<string>();
  for (const n of notifs) {
    const d = (n.data ?? {}) as Record<string, unknown>;
    const gid = d.guildId as string | undefined;
    const cid = d.channelId as string | undefined;
    if (gid) guildIds.add(gid);
    if (cid) channelIds.add(cid);
  }

  let guildNameMap: Record<string, string> = {};
  if (guildIds.size > 0) {
    const guildRows = await db.select({ id: guilds.id, name: guilds.name })
      .from(guilds)
      .where(inArray(guilds.id, [...guildIds]));
    guildNameMap = Object.fromEntries(guildRows.map(g => [g.id, g.name]));
  }

  let channelNameMap: Record<string, string> = {};
  if (channelIds.size > 0) {
    const channelRows = await db.select({ id: channels.id, name: channels.name })
      .from(channels)
      .where(inArray(channels.id, [...channelIds]));
    channelNameMap = Object.fromEntries(channelRows.map((channel) => [channel.id, channel.name]));
  }

  // Flatten the data JSONB into top-level fields for the frontend
  const mapped = notifs.map(n => {
    const d = (n.data ?? {}) as Record<string, unknown>;
    const guildId = (d.guildId as string) ?? null;
    const channelId = (d.channelId as string) ?? null;
    return {
      id: n.id,
      type: n.type,
      senderId: (d.senderId as string) ?? null,
      senderName: (d.senderName as string) ?? null,
      channelId,
      channelName: channelId ? (channelNameMap[channelId] ?? null) : null,
      guildId,
      guildName: guildId ? (guildNameMap[guildId] ?? null) : null,
      messageId: (d.messageId as string) ?? null,
      content: n.title,
      preview: n.body ?? null,
      read: n.read,
      createdAt: n.createdAt,
      trustSummary: getStoredNotificationTrust(d)?.summary ?? null,
    };
  });

  res.json(mapped);
});

/** GET /api/v1/notifications/:id/explanation */
notificationsRouter.get('/:id/explanation', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as Record<string, string>;
  const [notification] = await db.select().from(notifications)
    .where(and(eq(notifications.id, id), eq(notifications.userId, req.userId!)))
    .limit(1);

  if (!notification) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Notification not found' });
    return;
  }

  const data = (notification.data ?? {}) as Record<string, unknown>;
  const stored = getStoredNotificationTrust(data);
  if (stored) {
    res.json(stored);
    return;
  }

  const { explanation } = await evaluateNotificationTrust({
    userId: req.userId!,
    type: notification.type,
    data,
  });
  res.json(explanation);
});

/** GET /api/v1/notifications/unread-count */
notificationsRouter.get('/unread-count', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const unread = await db.select({ id: notifications.id }).from(notifications)
    .where(and(eq(notifications.userId, req.userId!), eq(notifications.read, false)));

  res.json({ count: unread.length });
});

/** POST /api/v1/notifications/mark-all-read */
notificationsRouter.post('/mark-all-read', requireAuth, async (req: Request, res: Response): Promise<void> => {
  await db.update(notifications).set({ read: true })
    .where(and(eq(notifications.userId, req.userId!), eq(notifications.read, false)));
  res.json({ code: 'OK' });
});

/** POST /api/v1/notifications/read-all — alias (frontend compat) */
notificationsRouter.post('/read-all', requireAuth, async (req: Request, res: Response): Promise<void> => {
  await db.update(notifications).set({ read: true })
    .where(and(eq(notifications.userId, req.userId!), eq(notifications.read, false)));
  res.json({ code: 'OK' });
});

/** PATCH /api/v1/notifications/:id/read */
notificationsRouter.patch('/:id/read', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as Record<string, string>;
  await db.update(notifications).set({ read: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, req.userId!)));
  res.json({ code: 'OK' });
});

/** POST /api/v1/notifications/:id/read — alias for PATCH (frontend compat) */
notificationsRouter.post('/:id/read', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as Record<string, string>;
  await db.update(notifications).set({ read: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, req.userId!)));
  res.json({ code: 'OK' });
});

/** DELETE /api/v1/notifications — clear all for current user */
notificationsRouter.delete('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  await db.delete(notifications).where(eq(notifications.userId, req.userId!));
  res.json({ code: 'OK' });
});

/** DELETE /api/v1/notifications/:id */
notificationsRouter.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as Record<string, string>;
  await db.delete(notifications).where(and(eq(notifications.id, id), eq(notifications.userId, req.userId!)));
  res.json({ code: 'OK' });
});
