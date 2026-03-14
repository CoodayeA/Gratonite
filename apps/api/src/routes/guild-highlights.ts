/**
 * routes/guild-highlights.ts — Community highlights / weekly digest (item 103)
 * Mounted at /api/v1/guilds/:guildId/highlights
 */
import { Router, Request, Response } from 'express';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db/index';
import { guildHighlights } from '../db/schema/guild-highlights';
import { messages } from '../db/schema/messages';
import { channels } from '../db/schema/channels';
import { users } from '../db/schema/users';
import { guildMembers } from '../db/schema/guilds';
import { requireAuth } from '../middleware/auth';

export const guildHighlightsRouter = Router({ mergeParams: true });

/** GET / — Get highlights (latest weeks) */
guildHighlightsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;
  const limit = Math.min(Number(req.query.limit) || 4, 12);

  const highlights = await db.select().from(guildHighlights)
    .where(eq(guildHighlights.guildId, guildId))
    .orderBy(desc(guildHighlights.weekStart))
    .limit(limit);

  res.json(highlights);
});

/** POST /generate — Generate highlights for current week */
guildHighlightsRouter.post('/generate', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  // Get guild channel IDs
  const guildChannels = await db.select({ id: channels.id }).from(channels).where(eq(channels.guildId, guildId));
  const channelIds = guildChannels.map(c => c.id);

  if (channelIds.length === 0) {
    res.json({ guildId, weekStart: weekStartStr, topMessages: [], activeMembers: [], messageCount: 0, memberCount: 0 });
    return;
  }

  // Get message count this week
  const [{ count: messageCount }] = await db.select({ count: sql<number>`count(*)::int` })
    .from(messages)
    .where(sql`${messages.channelId} = ANY(${channelIds}) AND ${messages.createdAt} >= ${weekStart}`);

  // Get most active members this week
  const activeMembers = await db.select({
    authorId: messages.authorId,
    username: users.username,
    displayName: users.displayName,
    count: sql<number>`count(*)::int`,
  })
    .from(messages)
    .leftJoin(users, eq(users.id, messages.authorId))
    .where(sql`${messages.channelId} = ANY(${channelIds}) AND ${messages.createdAt} >= ${weekStart} AND ${messages.authorId} IS NOT NULL`)
    .groupBy(messages.authorId, users.username, users.displayName)
    .orderBy(sql`count(*) DESC`)
    .limit(5);

  // Get member count
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

  // Upsert
  const [highlight] = await db.insert(guildHighlights)
    .values(data)
    .onConflictDoUpdate({
      target: [guildHighlights.guildId, guildHighlights.weekStart],
      set: { topMessages: data.topMessages, activeMembers: data.activeMembers, messageCount: data.messageCount, memberCount: data.memberCount },
    })
    .returning();

  res.json(highlight);
});
