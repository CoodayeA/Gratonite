import { Router, Request, Response } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/index';
import { starboardConfig, starboardEntries } from '../db/schema/starboard';
import { messages } from '../db/schema/messages';
import { users } from '../db/schema/users';
import { Permissions } from '../db/schema/roles';
import { requireAuth } from '../middleware/auth';
import { hasPermission } from './roles';

export const starboardRouter = Router({ mergeParams: true });

// GET /guilds/:guildId/starboard/config — get config
starboardRouter.get('/config', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId } = req.params as Record<string, string>;

  const [config] = await db.select().from(starboardConfig)
    .where(eq(starboardConfig.guildId, guildId))
    .limit(1);

  res.json(config || null);
});

// PUT /guilds/:guildId/starboard/config — set config
starboardRouter.put('/config', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId } = req.params as Record<string, string>;

  if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission' });
    return;
  }

  const { targetChannelId, emoji, threshold, enabled } = req.body as {
    targetChannelId?: string;
    emoji?: string;
    threshold?: number;
    enabled?: boolean;
  };

  const [config] = await db.insert(starboardConfig).values({
    guildId,
    targetChannelId: targetChannelId || null,
    emoji: emoji || '⭐',
    threshold: threshold ?? 5,
    enabled: enabled ?? true,
  }).onConflictDoUpdate({
    target: starboardConfig.guildId,
    set: {
      ...(targetChannelId !== undefined && { targetChannelId }),
      ...(emoji !== undefined && { emoji }),
      ...(threshold !== undefined && { threshold }),
      ...(enabled !== undefined && { enabled }),
    },
  }).returning();

  res.json(config);
});

// GET /guilds/:guildId/starboard — list starboard entries (paginated)
starboardRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId } = req.params as Record<string, string>;
  const limit = Math.min(Number(req.query.limit) || 25, 50);
  const offset = Math.min(Number(req.query.offset) || 0, 10000);

  const rows = await db.select({
    id: starboardEntries.id,
    originalMessageId: starboardEntries.originalMessageId,
    starboardMessageId: starboardEntries.starboardMessageId,
    starCount: starboardEntries.starCount,
    createdAt: starboardEntries.createdAt,
    messageContent: messages.content,
    messageAuthorId: messages.authorId,
    authorUsername: users.username,
    authorDisplayName: users.displayName,
  })
    .from(starboardEntries)
    .leftJoin(messages, eq(starboardEntries.originalMessageId, messages.id))
    .leftJoin(users, eq(messages.authorId, users.id))
    .where(eq(starboardEntries.guildId, guildId))
    .orderBy(desc(starboardEntries.starCount))
    .limit(limit)
    .offset(offset);

  res.json(rows);
});

// POST /guilds/:guildId/starboard/check — check if message should be starboarded
starboardRouter.post('/check', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId } = req.params as Record<string, string>;
  const { messageId, reactionCount } = req.body as { messageId: string; reactionCount: number };

  if (!messageId || reactionCount === undefined) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'messageId and reactionCount are required'  });
    return;
  }

  const [config] = await db.select().from(starboardConfig)
    .where(eq(starboardConfig.guildId, guildId))
    .limit(1);

  if (!config || !config.enabled) {
    res.json({ starboarded: false, reason: 'Starboard not enabled' });
    return;
  }

  if (reactionCount < config.threshold) {
    res.json({ starboarded: false, reason: 'Below threshold' });
    return;
  }

  // Upsert starboard entry
  const [existing] = await db.select().from(starboardEntries)
    .where(eq(starboardEntries.originalMessageId, messageId))
    .limit(1);

  if (existing) {
    await db.update(starboardEntries)
      .set({ starCount: reactionCount })
      .where(eq(starboardEntries.id, existing.id));
    res.json({ starboarded: true, entryId: existing.id, updated: true });
  } else {
    const [entry] = await db.insert(starboardEntries).values({
      guildId,
      originalMessageId: messageId,
      starCount: reactionCount,
    }).returning();
    res.json({ starboarded: true, entryId: entry.id, updated: false });
  }
});
