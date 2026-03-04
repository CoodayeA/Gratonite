import { Router, Request, Response } from 'express';
import { eq, and, sql, desc, lt, gt } from 'drizzle-orm';
import { db } from '../db/index';
import { messages } from '../db/schema/messages';
import { users } from '../db/schema/users';
import { channels } from '../db/schema/channels';
import { guilds } from '../db/schema/guilds';
import { requireAuth } from '../middleware/auth';

export const searchRouter = Router();

/** GET /api/v1/search/messages */
searchRouter.get('/messages', requireAuth, async (req: Request, res: Response): Promise<void> => {
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
    .leftJoin(users, eq(users.id, messages.authorId))
    .leftJoin(channels, eq(channels.id, messages.channelId))
    .where(and(...conditions))
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  // Fetch guild names
  const guildIds = [...new Set(results.filter(r => r.guildId).map(r => r.guildId!))];
  const guildNames: Record<string, string> = {};
  if (guildIds.length > 0) {
    for (const gId of guildIds) {
      const [g] = await db.select({ name: guilds.name }).from(guilds).where(eq(guilds.id, gId)).limit(1);
      if (g) guildNames[gId] = g.name;
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
