import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { eq } from 'drizzle-orm';
import { db } from '../db/index';
import { guildLogConfig } from '../db/schema/guild-log-config';
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
