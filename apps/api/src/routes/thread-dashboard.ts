import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { eq, and, desc, sql, isNull, count } from 'drizzle-orm';
import { db } from '../db/index';
import { channels } from '../db/schema/channels';
import { messages } from '../db/schema/messages';
import { users } from '../db/schema/users';
import { guildMembers } from '../db/schema/guilds';
import { requireAuth } from '../middleware/auth';

export const threadDashboardRouter = Router({ mergeParams: true });

// GET /guilds/:guildId/threads/dashboard — aggregate all active threads
threadDashboardRouter.get('/dashboard', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const guildId = req.params.guildId as string;
    const sort = (req.query.sort as string) || 'recent';
    const channelFilter = req.query.channel as string | undefined;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;

    // Verify guild membership
    const [membership] = await db.select({ id: guildMembers.id })
      .from(guildMembers)
      .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, req.userId!)))
      .limit(1);

    if (!membership) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Not a member of this guild' });
      return;
    }

    // Get threads (channels with parentId set, which are thread channels)
    const conditions = [
      eq(channels.guildId, guildId),
      sql`${channels.parentId} IS NOT NULL`,
      sql`${channels.type} IN ('thread', 'public_thread', 'private_thread')`,
    ];
    if (channelFilter) {
      conditions.push(eq(channels.parentId, channelFilter));
    }

    // Subquery for message count per thread
    const msgCountSub = db.select({
      channelId: messages.channelId,
      msgCount: count(messages.id).as('msg_count'),
      lastMessageAt: sql<string>`MAX(${messages.createdAt})`.as('last_message_at'),
    })
      .from(messages)
      .groupBy(messages.channelId)
      .as('msg_stats');

    let orderBy;
    switch (sort) {
      case 'active':
        orderBy = desc(sql`${msgCountSub.lastMessageAt}`);
        break;
      case 'popular':
        orderBy = desc(sql`${msgCountSub.msgCount}`);
        break;
      case 'recent':
      default:
        orderBy = desc(channels.createdAt);
        break;
    }

    // Get parent channel names
    const parentChannels = db.select({
      id: channels.id,
      name: channels.name,
    }).from(channels).as('parent_channels');

    const threads = await db.select({
      id: channels.id,
      name: channels.name,
      channelId: channels.parentId,
      channelName: parentChannels.name,
      createdAt: channels.createdAt,
      messageCount: sql<number>`COALESCE(${msgCountSub.msgCount}, 0)`,
      lastMessageAt: sql<string>`${msgCountSub.lastMessageAt}`,
    })
      .from(channels)
      .leftJoin(msgCountSub, eq(channels.id, msgCountSub.channelId))
      .leftJoin(parentChannels, eq(channels.parentId, parentChannels.id))
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    // Get participant counts and avatars for each thread
    const threadIds = threads.map(t => t.id);
    let participantData: Record<string, { count: number; avatars: string[] }> = {};

    if (threadIds.length > 0) {
      const participants = await db.select({
        channelId: messages.channelId,
        participantCount: sql<number>`COUNT(DISTINCT ${messages.authorId})`,
        avatars: sql<string[]>`ARRAY_AGG(DISTINCT ${users.avatarHash}) FILTER (WHERE ${users.avatarHash} IS NOT NULL)`,
      })
        .from(messages)
        .leftJoin(users, eq(messages.authorId, users.id))
        .where(sql`${messages.channelId} IN (${sql.join(threadIds.map(id => sql`${id}`), sql`,`)})`)
        .groupBy(messages.channelId);

      for (const p of participants) {
        participantData[p.channelId] = {
          count: Number(p.participantCount),
          avatars: (p.avatars || []).slice(0, 5),
        };
      }
    }

    // Get preview snippets (latest message per thread)
    let previews: Record<string, string> = {};
    if (threadIds.length > 0) {
      const latestMessages = await db.select({
        channelId: messages.channelId,
        content: messages.content,
      })
        .from(messages)
        .where(sql`${messages.channelId} IN (${sql.join(threadIds.map(id => sql`${id}`), sql`,`)})`)
        .orderBy(desc(messages.createdAt))
        .limit(threadIds.length);

      const seen = new Set<string>();
      for (const m of latestMessages) {
        if (!seen.has(m.channelId)) {
          previews[m.channelId] = (m.content || '').slice(0, 200);
          seen.add(m.channelId);
        }
      }
    }

    const result = threads.map(t => ({
      id: t.id,
      name: t.name,
      channelId: t.channelId,
      channelName: t.channelName,
      lastMessageAt: t.lastMessageAt,
      messageCount: Number(t.messageCount),
      participantCount: participantData[t.id]?.count || 0,
      participantAvatars: participantData[t.id]?.avatars || [],
      preview: previews[t.id] || null,
    }));

    res.json(result);
  } catch (err) {
    logger.error('[thread-dashboard] GET error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});
