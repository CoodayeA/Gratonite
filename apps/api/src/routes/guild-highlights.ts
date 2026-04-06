/**
 * routes/guild-highlights.ts — Community highlights / weekly digest (item 103)
 * Mounted at /api/v1/guilds/:guildId/highlights
 */
import { Router, Request, Response } from 'express';
import { eq, and, desc, sql, inArray, gte } from 'drizzle-orm';
import { db } from '../db/index';
import { guildHighlights } from '../db/schema/guild-highlights';
import { messages } from '../db/schema/messages';
import { channels } from '../db/schema/channels';
import { users } from '../db/schema/users';
import { guildMembers } from '../db/schema/guilds';
import { requireAuth } from '../middleware/auth';
import { handleAppError, normalizeError } from '../lib/errors';

export const guildHighlightsRouter = Router({ mergeParams: true });

/** GET / — Get highlights (latest weeks) */
guildHighlightsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;
  const limit = Math.min(Number(req.query.limit) || 4, 12);

  try {
    const highlights = await db.select().from(guildHighlights)
      .where(eq(guildHighlights.guildId, guildId))
      .orderBy(desc(guildHighlights.weekStart))
      .limit(limit);

    res.json(highlights);
  } catch (err) {
    const normalized = normalizeError(err);
    if (normalized.code === 'FEATURE_UNAVAILABLE') {
      res.json([]);
      return;
    }
    handleAppError(res, err, 'guild-highlights');
  }
});

/** POST /generate — Generate highlights for current week */
guildHighlightsRouter.post('/generate', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;
  try {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekStartStr = weekStart.toISOString().slice(0, 10);

    const guildChannels = await db.select({ id: channels.id }).from(channels).where(eq(channels.guildId, guildId));
    const channelIds = guildChannels.map(c => c.id);

    if (channelIds.length === 0) {
      res.json({ guildId, weekStart: weekStartStr, topMessages: [], activeMembers: [], messageCount: 0, memberCount: 0 });
      return;
    }

    const messageWhere = and(inArray(messages.channelId, channelIds), gte(messages.createdAt, weekStart));

    const [{ count: messageCount }] = await db.select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(messageWhere);

    const activeMembers = await db.select({
      authorId: messages.authorId,
      username: users.username,
      displayName: users.displayName,
      count: sql<number>`count(*)::int`,
    })
      .from(messages)
      .leftJoin(users, eq(users.id, messages.authorId))
      .where(and(messageWhere, sql`${messages.authorId} IS NOT NULL`))
      .groupBy(messages.authorId, users.username, users.displayName)
      .orderBy(sql`count(*) DESC`)
      .limit(5);

    const [{ count: memberCount }] = await db.select({ count: sql<number>`count(*)::int` })
      .from(guildMembers).where(eq(guildMembers.guildId, guildId));

    const data = {
      guildId,
      weekStart: weekStartStr,
      topMessages: [],
      activeMembers: activeMembers.map(m => ({
        userId: m.authorId, username: m.username, displayName: m.displayName, messageCount: m.count,
      })),
      messageCount: messageCount ?? 0,
      memberCount: memberCount ?? 0,
    };

    const [highlight] = await db.insert(guildHighlights)
      .values(data)
      .onConflictDoUpdate({
        target: [guildHighlights.guildId, guildHighlights.weekStart],
        set: { topMessages: data.topMessages, activeMembers: data.activeMembers, messageCount: data.messageCount, memberCount: data.memberCount },
      })
      .returning();

    res.json(highlight);
  } catch (err) {
    handleAppError(res, err, 'guild-highlights');
  }
});

/** DELETE /:highlightId — Remove a highlight */
guildHighlightsRouter.delete('/:highlightId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId, highlightId } = req.params as Record<string, string>;

  try {
    const deleted = await db.delete(guildHighlights)
      .where(and(eq(guildHighlights.id, highlightId), eq(guildHighlights.guildId, guildId)))
      .returning({ id: guildHighlights.id });

    if (deleted.length === 0) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Highlight not found' });
      return;
    }

    res.json({ code: 'OK', message: 'Highlight deleted' });
  } catch (err) {
    handleAppError(res, err, 'guild-highlights');
  }
});
