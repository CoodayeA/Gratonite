import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { eq, and, desc, sql, lt, gt } from 'drizzle-orm';
import { db } from '../db/index';
import { guildLogConfig } from '../db/schema/guild-log-config';
import { auditLog } from '../db/schema/audit';
import { users } from '../db/schema/users';
import { Permissions } from '../db/schema/roles';
import { requireAuth } from '../middleware/auth';
import { hasPermission } from './roles';

export const guildLogRouter = Router({ mergeParams: true });

const VALID_EVENTS = [
  'member_join', 'member_leave', 'ban', 'unban',
  'role_change', 'channel_create', 'channel_delete', 'message_delete',
];

// GET /guilds/:guildId/log-config
guildLogRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const guildId = req.params.guildId as string;

    if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission' });
      return;
    }

    const [config] = await db.select().from(guildLogConfig)
      .where(eq(guildLogConfig.guildId, guildId))
      .limit(1);

    res.json(config || { guildId, channelId: null, events: VALID_EVENTS });
  } catch (err) {
    logger.error('[guild-log] GET error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// PUT /guilds/:guildId/log-config
guildLogRouter.put('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const guildId = req.params.guildId as string;

    if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission' });
      return;
    }

    const { channelId, events } = req.body as { channelId: string; events: string[] };
    if (!channelId) {
      res.status(400).json({ code: 'BAD_REQUEST', message: 'channelId is required' });
      return;
    }

    const filteredEvents = Array.isArray(events) ? events.filter(e => VALID_EVENTS.includes(e)) : VALID_EVENTS;

    const [upserted] = await db.insert(guildLogConfig)
      .values({ guildId, channelId, events: filteredEvents })
      .onConflictDoUpdate({
        target: guildLogConfig.guildId,
        set: { channelId, events: filteredEvents },
      })
      .returning();

    res.json(upserted);
  } catch (err) {
    logger.error('[guild-log] PUT error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// GET /guilds/:guildId/log-config/entries — Fetch audit log entries (item 94)
guildLogRouter.get('/entries', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const guildId = req.params.guildId as string;

    if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission' });
      return;
    }

    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const actionFilter = typeof req.query.action === 'string' ? req.query.action : undefined;
    const before = typeof req.query.before === 'string' ? req.query.before : undefined;
    const after = typeof req.query.after === 'string' ? req.query.after : undefined;
    const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;

    const conditions = [eq(auditLog.guildId, guildId)];
    if (actionFilter) conditions.push(eq(auditLog.action, actionFilter));
    if (userId) conditions.push(eq(auditLog.userId, userId));
    if (before) {
      const d = new Date(before);
      if (!isNaN(d.getTime())) conditions.push(lt(auditLog.createdAt, d));
    }
    if (after) {
      const d = new Date(after);
      if (!isNaN(d.getTime())) conditions.push(gt(auditLog.createdAt, d));
    }

    const entries = await db.select({
      id: auditLog.id,
      guildId: auditLog.guildId,
      userId: auditLog.userId,
      action: auditLog.action,
      targetId: auditLog.targetId,
      targetType: auditLog.targetType,
      changes: auditLog.changes,
      reason: auditLog.reason,
      createdAt: auditLog.createdAt,
      username: users.username,
      displayName: users.displayName,
    })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.userId))
      .where(and(...conditions))
      .orderBy(desc(auditLog.createdAt))
      .limit(limit);

    // Get distinct action types for filtering UI
    const actionTypes = await db.select({ action: auditLog.action, count: sql<number>`count(*)::int` })
      .from(auditLog).where(eq(auditLog.guildId, guildId))
      .groupBy(auditLog.action);

    res.json({
      entries: entries.map(e => ({
        ...e,
        actorName: e.displayName || e.username || 'Unknown',
      })),
      actionTypes: actionTypes.map(a => ({ action: a.action, count: a.count })),
      total: entries.length,
    });
  } catch (err) {
    logger.error('[guild-log] GET entries error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});
