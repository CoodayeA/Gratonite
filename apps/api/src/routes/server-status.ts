import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { eq, and, desc, sql, gte } from 'drizzle-orm';
import { db } from '../db/index';
import { botHeartbeats, webhookStatusHistory } from '../db/schema/server-status';
import { users } from '../db/schema/users';
import { guildMembers } from '../db/schema/guilds';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { z } from 'zod';

export const serverStatusRouter = Router({ mergeParams: true });

const heartbeatSchema = z.object({
  status: z.enum(['online', 'degraded', 'offline']).optional(),
  metadata: z.record(z.string(), z.any()).nullable().optional(),
});

// GET /guilds/:guildId/status — get status of all bots and webhooks
serverStatusRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const guildId = req.params.guildId as string;

    // Verify guild membership
    const [membership] = await db.select({ id: guildMembers.id })
      .from(guildMembers)
      .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, req.userId!)))
      .limit(1);

    if (!membership) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Not a member of this guild' });
      return;
    }

    // Get bot heartbeats with user info
    const bots = await db.select({
      id: botHeartbeats.id,
      botId: botHeartbeats.botId,
      lastPingAt: botHeartbeats.lastPingAt,
      status: botHeartbeats.status,
      metadata: botHeartbeats.metadata,
      botUsername: users.username,
      botDisplayName: users.displayName,
      botAvatarHash: users.avatarHash,
    })
      .from(botHeartbeats)
      .innerJoin(users, eq(botHeartbeats.botId, users.id))
      .where(eq(botHeartbeats.guildId, guildId));

    // Get recent webhook status (latest per webhook)
    const webhooks = await db.select({
      webhookId: webhookStatusHistory.webhookId,
      status: webhookStatusHistory.status,
      statusCode: webhookStatusHistory.statusCode,
      responseTime: webhookStatusHistory.responseTime,
      checkedAt: webhookStatusHistory.checkedAt,
    })
      .from(webhookStatusHistory)
      .where(eq(webhookStatusHistory.guildId, guildId))
      .orderBy(desc(webhookStatusHistory.checkedAt))
      .limit(50);

    // Deduplicate to latest per webhook
    const latestPerWebhook = new Map<string, typeof webhooks[0]>();
    for (const wh of webhooks) {
      if (!latestPerWebhook.has(wh.webhookId)) {
        latestPerWebhook.set(wh.webhookId, wh);
      }
    }

    // Calculate uptime percentage per webhook (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const uptimeStats = await db.select({
      webhookId: webhookStatusHistory.webhookId,
      total: sql<number>`COUNT(*)`,
      successes: sql<number>`COUNT(*) FILTER (WHERE ${webhookStatusHistory.status} = 'success')`,
    })
      .from(webhookStatusHistory)
      .where(and(
        eq(webhookStatusHistory.guildId, guildId),
        gte(webhookStatusHistory.checkedAt, sevenDaysAgo),
      ))
      .groupBy(webhookStatusHistory.webhookId);

    const uptimeMap = new Map<string, number>();
    for (const stat of uptimeStats) {
      uptimeMap.set(stat.webhookId, Number(stat.total) > 0 ? (Number(stat.successes) / Number(stat.total)) * 100 : 100);
    }

    const webhookResults = Array.from(latestPerWebhook.values()).map(wh => ({
      ...wh,
      uptimePercent: Math.round((uptimeMap.get(wh.webhookId) || 100) * 100) / 100,
    }));

    res.json({ bots, webhooks: webhookResults });
  } catch (err) {
    logger.error('[server-status] GET error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// GET /guilds/:guildId/status/history — get status history (7 days)
serverStatusRouter.get('/history', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const guildId = req.params.guildId as string;

    const [membership] = await db.select({ id: guildMembers.id })
      .from(guildMembers)
      .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, req.userId!)))
      .limit(1);

    if (!membership) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Not a member of this guild' });
      return;
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const history = await db.select()
      .from(webhookStatusHistory)
      .where(and(
        eq(webhookStatusHistory.guildId, guildId),
        gte(webhookStatusHistory.checkedAt, sevenDaysAgo),
      ))
      .orderBy(desc(webhookStatusHistory.checkedAt))
      .limit(500);

    res.json(history);
  } catch (err) {
    logger.error('[server-status] GET history error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// POST /guilds/:guildId/status/heartbeat — bot sends heartbeat
serverStatusRouter.post('/heartbeat', requireAuth, validate(heartbeatSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const guildId = req.params.guildId as string;
    const status = req.body.status || 'online';
    const metadata = req.body.metadata || null;

    const [heartbeat] = await db.insert(botHeartbeats)
      .values({
        guildId,
        botId: req.userId!,
        lastPingAt: new Date(),
        status,
        metadata,
      })
      .onConflictDoUpdate({
        target: [botHeartbeats.guildId, botHeartbeats.botId],
        set: {
          lastPingAt: new Date(),
          status,
          metadata,
        },
      })
      .returning();

    res.json(heartbeat);
  } catch (err) {
    logger.error('[server-status] POST heartbeat error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});
