import { Router, Request, Response } from 'express';
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
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q.length < 2) {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Query must be at least 2 characters' }); return;
  }

  const channelId = typeof req.query.channelId === 'string' ? req.query.channelId : undefined;
  const authorId = typeof req.query.authorId === 'string' ? req.query.authorId : undefined;
  const limit = Math.min(Number(req.query.limit) || 25, 50);

  const escaped = q.replace(/[%_\\]/g, '\\$&');
  const pattern = `%${escaped}%`;

  // Build conditions
  const conditions = [sql`${messages.content} ILIKE ${pattern}`];
  if (channelId) conditions.push(eq(messages.channelId, channelId));
  if (authorId) conditions.push(eq(messages.authorId, authorId));

  // Access control: only search channels the user can access.
  // Fetch guild IDs where the user is a member.
  const userGuildRows = await db
    .select({ guildId: guildMembers.guildId })
    .from(guildMembers)
    .where(eq(guildMembers.userId, req.userId!))
    .limit(500);
  const userGuildIds = userGuildRows.map(r => r.guildId);

  // Fetch DM channel IDs where the user participates.
  const userDmRows = await db
    .select({ channelId: dmChannelMembers.channelId })
    .from(dmChannelMembers)
    .where(eq(dmChannelMembers.userId, req.userId!))
    .limit(500);
  const userDmChannelIds = userDmRows.map(r => r.channelId);

  if (userGuildIds.length === 0 && userDmChannelIds.length === 0) {
    res.json([]); return;
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
    .limit(limit);

  // Fetch guild names in a single batch query
  const guildIds = [...new Set(results.filter(r => r.guildId).map(r => r.guildId!))];
  const guildNames: Record<string, string> = {};
  if (guildIds.length > 0) {
    const guildRows = await db.select({ id: guilds.id, name: guilds.name }).from(guilds).where(inArray(guilds.id, guildIds));
    for (const g of guildRows) {
      guildNames[g.id] = g.name;
    }
  }

  res.json(results.map(r => ({
    id: r.id,
    channelId: r.channelId,
    channelName: r.channelName,
    guildId: r.guildId,
    guildName: r.guildId ? guildNames[r.guildId] : null,
    content: r.content,
    createdAt: r.createdAt,
    author: r.authorId ? {
      id: r.authorId,
      username: r.authorUsername,
      displayName: r.authorDisplayName,
      avatarHash: r.authorAvatarHash,
    } : null,
  })));
});
