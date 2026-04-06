import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { eq, and, desc, sql, lt } from 'drizzle-orm';
import { db } from '../db/index';
import { requireAuth } from '../middleware/auth';
import { hasPermission } from './roles';
import { Permissions } from '../db/schema/roles';
import { confessionChannels, confessions } from '../db/schema/confessions';
import { guilds } from '../db/schema/guilds';
import { auditLog } from '../db/schema/audit';

export const confessionsRouter = Router({ mergeParams: true });

// POST /guilds/:guildId/confession-channels — designate a channel
confessionsRouter.post('/guilds/:guildId/confession-channels', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params as Record<string, string>;
    if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_CHANNELS))) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_CHANNELS permission'  }); return;
    }

    const { channelId } = req.body;
    if (!channelId) { res.status(400).json({ code: 'BAD_REQUEST', message: 'channelId is required'  }); return; }

    const [row] = await db.insert(confessionChannels).values({
      channelId,
      guildId,
    }).onConflictDoUpdate({
      target: confessionChannels.channelId,
      set: { enabled: true },
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    logger.error('[confessions] POST channel error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error'  });
  }
});

// DELETE /guilds/:guildId/confession-channels/:channelId — undesignate
confessionsRouter.delete('/guilds/:guildId/confession-channels/:channelId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId, channelId } = req.params as Record<string, string>;
    if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_CHANNELS))) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_CHANNELS permission'  }); return;
    }

    const [deleted] = await db.delete(confessionChannels).where(and(eq(confessionChannels.channelId, channelId), eq(confessionChannels.guildId, guildId))).returning();
    if (!deleted) { res.status(404).json({ code: 'NOT_FOUND', message: 'Confession channel not found'  }); return; }
    res.json({ success: true });
  } catch (err) {
    logger.error('[confessions] DELETE channel error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error'  });
  }
});

// GET /channels/:channelId/confessions — list confessions (paginated, newest first)
confessionsRouter.get('/channels/:channelId/confessions', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelId } = req.params as Record<string, string>;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const before = req.query.before as string | undefined;

    const condition = before
      ? and(eq(confessions.channelId, channelId), lt(confessions.createdAt, new Date(before)))
      : eq(confessions.channelId, channelId);

    const rows = await db.select({
      id: confessions.id,
      channelId: confessions.channelId,
      guildId: confessions.guildId,
      anonLabel: confessions.anonLabel,
      content: confessions.content,
      createdAt: confessions.createdAt,
    }).from(confessions)
      .where(condition)
      .orderBy(desc(confessions.createdAt))
      .limit(limit);

    res.json(rows);
  } catch (err) {
    logger.error('[confessions] GET list error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error'  });
  }
});

// POST /channels/:channelId/confessions — post confession
confessionsRouter.post('/channels/:channelId/confessions', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelId } = req.params as Record<string, string>;
    const userId = req.userId!;
    const { content } = req.body;
    if (!content || !content.trim()) { res.status(400).json({ code: 'BAD_REQUEST', message: 'content is required'  }); return; }

    // Verify this is a confession channel
    const [cc] = await db.select().from(confessionChannels).where(and(eq(confessionChannels.channelId, channelId), eq(confessionChannels.enabled, true))).limit(1);
    if (!cc) { res.status(400).json({ code: 'BAD_REQUEST', message: 'This channel is not a confession board'  }); return; }

    const anonLabel = `Anonymous #${Math.floor(1000 + Math.random() * 9000)}`;

    const [confession] = await db.insert(confessions).values({
      channelId,
      guildId: cc.guildId,
      authorId: userId,
      anonLabel,
      content: content.trim(),
    }).returning();

    // Return without authorId
    res.status(201).json({
      id: confession.id,
      channelId: confession.channelId,
      guildId: confession.guildId,
      anonLabel: confession.anonLabel,
      content: confession.content,
      createdAt: confession.createdAt,
    });
  } catch (err) {
    logger.error('[confessions] POST error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error'  });
  }
});

// POST /guilds/:guildId/confessions/:id/reveal — admin reveal author
confessionsRouter.post('/guilds/:guildId/confessions/:id/reveal', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId, id } = req.params as Record<string, string>;
    const userId = req.userId!;

    // Check guild owner or ADMINISTRATOR
    const [guild] = await db.select().from(guilds).where(eq(guilds.id, guildId)).limit(1);
    if (!guild) { res.status(404).json({ code: 'NOT_FOUND', message: 'Guild not found'  }); return; }

    const isOwner = guild.ownerId === userId;
    const isAdmin = await hasPermission(userId, guildId, Permissions.ADMINISTRATOR);
    if (!isOwner && !isAdmin) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Only guild owner or administrators can reveal authors'  }); return;
    }

    const [confession] = await db.select().from(confessions).where(and(eq(confessions.id, id), eq(confessions.guildId, guildId))).limit(1);
    if (!confession) { res.status(404).json({ code: 'NOT_FOUND', message: 'Confession not found'  }); return; }

    // Log in audit
    await db.insert(auditLog).values({
      guildId,
      userId,
      action: 'CONFESSION_REVEAL',
      targetId: confession.authorId,
      targetType: 'confession',
      changes: { confessionId: id },
    });

    res.json({ authorId: confession.authorId });
  } catch (err) {
    logger.error('[confessions] POST reveal error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error'  });
  }
});
