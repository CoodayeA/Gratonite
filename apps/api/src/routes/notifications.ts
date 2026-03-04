import { Router, Request, Response } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/index';
import { notifications } from '../db/schema/notifications';
import { requireAuth } from '../middleware/auth';

export const notificationsRouter = Router();

/** GET /api/v1/notifications */
notificationsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const limit = Math.min(Number(req.query.limit) || 50, 100);

  const notifs = await db.select().from(notifications)
    .where(eq(notifications.userId, req.userId!))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  // Flatten the data JSONB into top-level fields for the frontend
  const mapped = notifs.map(n => {
    const d = (n.data ?? {}) as Record<string, unknown>;
    return {
      id: n.id,
      type: n.type,
      senderId: (d.senderId as string) ?? null,
      senderName: (d.senderName as string) ?? null,
      channelId: (d.channelId as string) ?? null,
      guildId: (d.guildId as string) ?? null,
      content: n.title,
      preview: n.body ?? null,
      read: n.read,
      createdAt: n.createdAt,
    };
  });

  res.json(mapped);
});

/** GET /api/v1/notifications/unread-count */
notificationsRouter.get('/unread-count', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const unread = await db.select({ id: notifications.id }).from(notifications)
    .where(and(eq(notifications.userId, req.userId!), eq(notifications.read, false)));

  res.json({ count: unread.length });
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

/** DELETE /api/v1/notifications/:id */
notificationsRouter.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as Record<string, string>;
  await db.delete(notifications).where(and(eq(notifications.id, id), eq(notifications.userId, req.userId!)));
  res.json({ code: 'OK' });
});
