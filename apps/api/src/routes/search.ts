import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { eq, and, or, sql, desc, lt, gt, inArray } from 'drizzle-orm';
import { db } from '../db/index';
import { messages } from '../db/schema/messages';
import { users } from '../db/schema/users';
import { channels } from '../db/schema/channels';
import { guilds, guildMembers } from '../db/schema/guilds';
import { dmChannelMembers } from '../db/schema/channels';
import { requireAuth } from '../middleware/auth';
import { searchRateLimit } from '../middleware/rateLimit';

export const searchRouter = Router();

/** GET /api/v1/search/messages */
searchRouter.get('/messages', requireAuth, searchRateLimit, async (req: Request, res: Response): Promise<void> => {
  try {
  const q = (typeof req.query.query === 'string' ? req.query.query.trim() : '') || (typeof req.query.q === 'string' ? req.query.q.trim() : '');
  if (q.length < 2) {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Query must be at least 2 characters' }); return;
  }

  const channelId = typeof req.query.channelId === 'string' ? req.query.channelId : undefined;
  const guildId = typeof req.query.guildId === 'string' ? req.query.guildId : undefined;
  const authorId = typeof req.query.authorId === 'string' ? req.query.authorId : undefined;
  const before = typeof req.query.before === 'string' ? req.query.before : undefined;
  const after = typeof req.query.after === 'string' ? req.query.after : undefined;
  const has = typeof req.query.has === 'string' ? req.query.has : undefined;
  const limit = Math.min(Number(req.query.limit) || 25, 50);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const escaped = q.replace(/[%_\\]/g, '\\$&');
  const pattern = `%${escaped}%`;

  // Full-text search: use plainto_tsquery (safely handles all input) with ILIKE fallback
  const useFts = q.trim().length > 0;

  // Build conditions — prefer ts_rank for relevance if FTS is viable
  const conditions = useFts
    ? [
        sql`${messages.content} IS NOT NULL AND ("messages"."search_vector" @@ plainto_tsquery('english', ${q}) OR ${messages.content} ILIKE ${pattern})`,
      ]
    : [sql`${messages.content} ILIKE ${pattern}`];

  // mentionsMe filter: messages that contain @userId or @everyone/@here
  const mentionsMe = typeof req.query.mentionsMe === 'string' && req.query.mentionsMe === 'true';
  if (mentionsMe) {
    conditions.push(sql`(${messages.content} ILIKE ${'%<@' + req.userId + '>%'} OR ${messages.content} ILIKE '%@everyone%' OR ${messages.content} ILIKE '%@here%')`);
  }
  if (channelId) conditions.push(eq(messages.channelId, channelId));
  if (guildId) conditions.push(eq(channels.guildId, guildId));
  if (authorId) conditions.push(eq(messages.authorId, authorId));
  if (before) {
    const beforeDate = new Date(before);
    if (isNaN(beforeDate.getTime())) {
      res.status(400).json({ error: 'Invalid before date' }); return;
    }
    conditions.push(lt(messages.createdAt, beforeDate));
  }
  if (after) {
    const afterDate = new Date(after);
    if (isNaN(afterDate.getTime())) {
      res.status(400).json({ error: 'Invalid after date' }); return;
    }
    conditions.push(gt(messages.createdAt, afterDate));
  }
  if (has === 'file' || has === 'image') {
    conditions.push(sql`jsonb_array_length(COALESCE(${messages.attachments}, '[]'::jsonb)) > 0`);
  } else if (has === 'embed') {
    conditions.push(sql`jsonb_array_length(COALESCE(${messages.embeds}, '[]'::jsonb)) > 0`);
  } else if (has === 'link') {
    conditions.push(sql`${messages.content} ~ 'https?://'`);
  }

  // Access control: only search channels the user can access.
  // Fetch guild IDs where the user is a member.
  const userGuildRows = await db
    .select({ guildId: guildMembers.guildId })
    .from(guildMembers)
    .where(eq(guildMembers.userId, req.userId!))
    .limit(500);
  const userGuildIds = userGuildRows.map(r => r.guildId);

  if (guildId && !userGuildIds.includes(guildId)) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Not a member of this guild' });
    return;
  }

  // Fetch DM channel IDs where the user participates.
  const userDmRows = await db
    .select({ channelId: dmChannelMembers.channelId })
    .from(dmChannelMembers)
    .where(eq(dmChannelMembers.userId, req.userId!))
    .limit(500);
  const userDmChannelIds = userDmRows.map(r => r.channelId);

  if (userGuildIds.length === 0 && userDmChannelIds.length === 0) {
    res.json({ results: [], total: 0, limit, offset: 0 });
    return;
  }

  // Build access condition: channel belongs to a guild the user is in, OR is a DM the user participates in.
  const accessConditions: ReturnType<typeof eq>[] = [];
  if (userGuildIds.length > 0) {
    accessConditions.push(inArray(channels.guildId, userGuildIds));
  }
  if (userDmChannelIds.length > 0) {
    accessConditions.push(inArray(messages.channelId, userDmChannelIds));
  }
  conditions.push(or(...accessConditions)!);

  const results = await db
    .select({
      id: messages.id,
      channelId: messages.channelId,
      content: messages.content,
      authorId: messages.authorId,
      createdAt: messages.createdAt,
      authorUsername: users.username,
      authorDisplayName: users.displayName,
      authorAvatarHash: users.avatarHash,
      channelName: channels.name,
      guildId: channels.guildId,
    })
    .from(messages)
    .innerJoin(channels, eq(channels.id, messages.channelId))
    .leftJoin(users, eq(users.id, messages.authorId))
    .where(and(...conditions))
    .orderBy(desc(messages.createdAt))
    .limit(limit)
    .offset(offset);

  // Fetch guild names in a single batch query
  const guildIds = [...new Set(results.filter(r => r.guildId).map(r => r.guildId!))];
  const guildNames: Record<string, string> = {};
  if (guildIds.length > 0) {
    const guildRows = await db.select({ id: guilds.id, name: guilds.name }).from(guilds).where(inArray(guilds.id, guildIds));
    for (const g of guildRows) {
      guildNames[g.id] = g.name;
    }
  }

  const mapped = results.map(r => ({
    id: r.id,
    channelId: r.channelId,
    channelName: r.channelName,
    guildId: r.guildId,
    guildName: r.guildId ? guildNames[r.guildId] : null,
    content: r.content,
    createdAt: r.createdAt,
    authorUsername: r.authorUsername,
    author: r.authorId ? {
      id: r.authorId,
      username: r.authorUsername,
      displayName: r.authorDisplayName,
      avatarHash: r.authorAvatarHash,
    } : null,
  }));
  res.json({ results: mapped, total: mapped.length, limit, offset });
  } catch (err) {
    logger.error('[search] GET /messages error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});
