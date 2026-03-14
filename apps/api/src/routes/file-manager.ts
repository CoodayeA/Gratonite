/**
 * routes/file-manager.ts — Browse shared files per guild (via message attachments).
 * Mounted at /guilds/:guildId/file-manager
 */
import { Router, Request, Response } from 'express';
import { eq, and, desc, sql, ilike } from 'drizzle-orm';
import { db } from '../db/index';
import { messages } from '../db/schema/messages';
import { channels } from '../db/schema/channels';
import { users } from '../db/schema/users';
import { guildMembers } from '../db/schema/guilds';
import { requireAuth } from '../middleware/auth';

export const fileManagerRouter = Router({ mergeParams: true });

// GET /guilds/:guildId/file-manager — list files from all guild channels
fileManagerRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;
  const search = (req.query.search as string) || '';
  const page = Math.max(0, Number(req.query.page) || 0);

  const [member] = await db.select({ id: guildMembers.id }).from(guildMembers)
    .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, req.userId!))).limit(1);
  if (!member) { res.status(403).json({ code: 'FORBIDDEN' }); return; }

  // Query messages with attachments from guild channels
  const searchCondition = search
    ? sql`${messages.attachments}::text ILIKE ${'%' + search + '%'}`
    : sql`true`;

  const rows = await db.select({
    id: messages.id,
    channelId: messages.channelId,
    authorId: messages.authorId,
    attachments: messages.attachments,
    createdAt: messages.createdAt,
    authorName: users.displayName,
  }).from(messages)
    .innerJoin(channels, and(eq(channels.id, messages.channelId), eq(channels.guildId, guildId)))
    .leftJoin(users, eq(users.id, messages.authorId))
    .where(and(
      sql`${messages.attachments} IS NOT NULL AND ${messages.attachments}::text != '[]' AND ${messages.attachments}::text != 'null'`,
      searchCondition,
    ))
    .orderBy(desc(messages.createdAt))
    .limit(50)
    .offset(page * 50);

  // Flatten attachments
  const fileList = rows.flatMap(row => {
    const atts = (row.attachments as Array<{ filename?: string; url?: string; size?: number; mimeType?: string }>) || [];
    return atts.map(a => ({
      messageId: row.id,
      channelId: row.channelId,
      filename: a.filename || 'unknown',
      url: a.url || '',
      size: a.size || 0,
      mimeType: a.mimeType || 'application/octet-stream',
      uploadedBy: row.authorName || 'Unknown',
      uploaderId: row.authorId,
      createdAt: row.createdAt,
    }));
  });

  res.json(fileList);
});
