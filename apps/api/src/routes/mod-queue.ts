/**
 * routes/mod-queue.ts — Community moderation tools (item 109)
 * Mounted at /api/v1/guilds/:guildId/mod-queue
 */
import { Router, Request, Response } from 'express';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db/index';
import { modQueue } from '../db/schema/mod-queue';
import { users } from '../db/schema/users';
import { guildMembers } from '../db/schema/guilds';
import { Permissions } from '../db/schema/roles';
import { requireAuth } from '../middleware/auth';
import { hasPermission } from './roles';

export const modQueueRouter = Router({ mergeParams: true });

/** GET / — List mod queue items */
modQueueRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;
  if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission' }); return;
  }

  const status = typeof req.query.status === 'string' ? req.query.status : 'pending';
  const limit = Math.min(Number(req.query.limit) || 50, 100);

  const items = await db.select({
    id: modQueue.id,
    guildId: modQueue.guildId,
    type: modQueue.type,
    targetId: modQueue.targetId,
    content: modQueue.content,
    reporterId: modQueue.reporterId,
    status: modQueue.status,
    resolvedBy: modQueue.resolvedBy,
    resolvedAt: modQueue.resolvedAt,
    createdAt: modQueue.createdAt,
    reporterUsername: users.username,
  })
    .from(modQueue)
    .leftJoin(users, eq(users.id, modQueue.reporterId))
    .where(and(eq(modQueue.guildId, guildId), eq(modQueue.status, status)))
    .orderBy(desc(modQueue.createdAt))
    .limit(limit);

  // Count by status
  const counts = await db.select({
    status: modQueue.status,
    count: sql<number>`count(*)::int`,
  }).from(modQueue).where(eq(modQueue.guildId, guildId)).groupBy(modQueue.status);

  res.json({ items, counts: Object.fromEntries(counts.map(c => [c.status, c.count])) });
});

/** POST / — Add item to mod queue */
modQueueRouter.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;

  // Verify reporter is a guild member
  const [membership] = await db.select({ id: guildMembers.id }).from(guildMembers)
    .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, req.userId!))).limit(1);
  if (!membership) { res.status(403).json({ code: 'FORBIDDEN', message: 'Not a guild member' }); return; }

  const { type, targetId, content } = req.body as { type: string; targetId?: string; content?: string };

  if (!type || !['message', 'user', 'spam', 'word_filter'].includes(type)) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'Invalid type' }); return;
  }

  const [item] = await db.insert(modQueue).values({
    guildId,
    type,
    targetId: targetId || null,
    content: content || null,
    reporterId: req.userId!,
  }).returning();

  res.status(201).json(item);
});

/** PATCH /:itemId — Resolve mod queue item */
modQueueRouter.patch('/:itemId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;
  const itemId = req.params.itemId as string;

  if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission' }); return;
  }

  const { status } = req.body as { status: 'approved' | 'rejected' };
  if (!['approved', 'rejected'].includes(status)) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'status must be approved or rejected' }); return;
  }

  const [updated] = await db.update(modQueue)
    .set({ status, resolvedBy: req.userId!, resolvedAt: new Date() })
    .where(and(eq(modQueue.id, itemId), eq(modQueue.guildId, guildId)))
    .returning();

  if (!updated) { res.status(404).json({ code: 'NOT_FOUND' }); return; }
  res.json(updated);
});
