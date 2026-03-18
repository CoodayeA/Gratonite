import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { eq, and, lt, desc } from 'drizzle-orm';
import { db } from '../db/index';
import { messageBookmarks } from '../db/schema/message-bookmarks';
import { bookmarkFolders } from '../db/schema/bookmark-folders';
import { messages } from '../db/schema/messages';
import { channels, dmChannelMembers } from '../db/schema/channels';
import { guilds, guildMembers } from '../db/schema/guilds';
import { users } from '../db/schema/users';
import { requireAuth } from '../middleware/auth';

// SECURITY: verify user has access to the channel containing a message
async function verifyMessageAccess(messageId: string, userId: string): Promise<boolean> {
  const [msg] = await db.select({ channelId: messages.channelId }).from(messages)
    .where(eq(messages.id, messageId)).limit(1);
  if (!msg) return false;
  const [channel] = await db.select().from(channels).where(eq(channels.id, msg.channelId)).limit(1);
  if (!channel) return false;
  if (channel.type === 'DM' || channel.type === 'GROUP_DM') {
    const [membership] = await db.select({ id: dmChannelMembers.id }).from(dmChannelMembers)
      .where(and(eq(dmChannelMembers.channelId, msg.channelId), eq(dmChannelMembers.userId, userId))).limit(1);
    return !!membership;
  }
  if (channel.guildId) {
    const [gm] = await db.select({ id: guildMembers.id }).from(guildMembers)
      .where(and(eq(guildMembers.guildId, channel.guildId), eq(guildMembers.userId, userId))).limit(1);
    return !!gm;
  }
  return false;
}

export const bookmarksRouter = Router();

// GET /users/@me/bookmarks — list bookmarks with full context
bookmarksRouter.get('/users/@me/bookmarks', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 50);
    const before = req.query.before as string | undefined;
    const folderId = req.query.folderId as string | undefined;

    const conditions = [eq(messageBookmarks.userId, req.userId!)];
    if (before) conditions.push(lt(messageBookmarks.createdAt, new Date(before)));
    if (folderId === 'uncategorized') {
      conditions.push(eq(messageBookmarks.folderId, null as any));
    } else if (folderId) {
      conditions.push(eq(messageBookmarks.folderId, folderId));
    }

    const bookmarks = await db.select({
      id: messageBookmarks.id,
      messageId: messageBookmarks.messageId,
      folderId: messageBookmarks.folderId,
      note: messageBookmarks.note,
      createdAt: messageBookmarks.createdAt,
      messageContent: messages.content,
      messageAuthorId: messages.authorId,
      messageCreatedAt: messages.createdAt,
      channelId: messages.channelId,
      channelName: channels.name,
      guildId: channels.guildId,
      guildName: guilds.name,
      authorUsername: users.username,
      authorDisplayName: users.displayName,
    })
      .from(messageBookmarks)
      .innerJoin(messages, eq(messageBookmarks.messageId, messages.id))
      .innerJoin(channels, eq(messages.channelId, channels.id))
      .leftJoin(guilds, eq(channels.guildId, guilds.id))
      .leftJoin(users, eq(messages.authorId, users.id))
      .where(and(...conditions))
      .orderBy(desc(messageBookmarks.createdAt))
      .limit(limit);

    res.json(bookmarks);
  } catch (err) {
    logger.error('[bookmarks] GET error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// POST /users/@me/bookmarks — add bookmark
bookmarksRouter.post('/users/@me/bookmarks', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { messageId, note, folderId } = req.body as { messageId: string; note?: string; folderId?: string };
    if (!messageId) {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'messageId is required' });
      return;
    }

    // SECURITY: verify user can access the message's channel before bookmarking
    if (!await verifyMessageAccess(messageId, req.userId!)) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'No access to this message' });
      return;
    }

    const [bookmark] = await db.insert(messageBookmarks)
      .values({ userId: req.userId!, messageId, note: note || null, folderId: folderId || null })
      .onConflictDoNothing()
      .returning();
    res.status(201).json(bookmark || { messageId, alreadyBookmarked: true });
  } catch (err) {
    logger.error('[bookmarks] POST error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// PATCH /users/@me/bookmarks/:bookmarkId — update bookmark (move to folder, update note)
bookmarksRouter.patch('/users/@me/bookmarks/:bookmarkId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const bookmarkId = req.params.bookmarkId as string;
    const { folderId, note } = req.body as { folderId?: string | null; note?: string | null };
    const updates: Record<string, any> = {};
    if (folderId !== undefined) updates.folderId = folderId;
    if (note !== undefined) updates.note = note;
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Nothing to update' });
      return;
    }
    const [updated] = await db.update(messageBookmarks)
      .set(updates)
      .where(and(eq(messageBookmarks.id, bookmarkId), eq(messageBookmarks.userId, req.userId!)))
      .returning();
    if (!updated) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Bookmark not found' });
      return;
    }
    res.json(updated);
  } catch (err) {
    logger.error('[bookmarks] PATCH error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// DELETE /users/@me/bookmarks/:messageId — remove bookmark
bookmarksRouter.delete('/users/@me/bookmarks/:messageId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const messageId = req.params.messageId as string;
    await db.delete(messageBookmarks)
      .where(and(eq(messageBookmarks.userId, req.userId!), eq(messageBookmarks.messageId, messageId)));
    res.json({ ok: true });
  } catch (err) {
    logger.error('[bookmarks] DELETE error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// --- Bookmark Folders CRUD ---

// GET /users/@me/bookmark-folders — list folders
bookmarksRouter.get('/users/@me/bookmark-folders', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const folders = await db.select()
      .from(bookmarkFolders)
      .where(eq(bookmarkFolders.userId, req.userId!))
      .orderBy(bookmarkFolders.createdAt);
    res.json(folders);
  } catch (err) {
    logger.error('[bookmark-folders] GET error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// POST /users/@me/bookmark-folders — create folder
bookmarksRouter.post('/users/@me/bookmark-folders', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, color } = req.body as { name: string; color?: string };
    if (!name || !name.trim()) {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'name is required' });
      return;
    }
    const [folder] = await db.insert(bookmarkFolders)
      .values({ userId: req.userId!, name: name.trim().slice(0, 64), color: color || '#6366f1' })
      .returning();
    res.status(201).json(folder);
  } catch (err) {
    logger.error('[bookmark-folders] POST error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// PATCH /users/@me/bookmark-folders/:folderId — rename/recolor folder
bookmarksRouter.patch('/users/@me/bookmark-folders/:folderId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const folderId = req.params.folderId as string;
    const { name, color } = req.body as { name?: string; color?: string };
    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name.trim().slice(0, 64);
    if (color !== undefined) updates.color = color;
    if (Object.keys(updates).length === 0) {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Nothing to update' });
      return;
    }
    const [updated] = await db.update(bookmarkFolders)
      .set(updates)
      .where(and(eq(bookmarkFolders.id, folderId), eq(bookmarkFolders.userId, req.userId!)))
      .returning();
    if (!updated) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Folder not found' });
      return;
    }
    res.json(updated);
  } catch (err) {
    logger.error('[bookmark-folders] PATCH error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// DELETE /users/@me/bookmark-folders/:folderId — delete folder (bookmarks become uncategorized)
bookmarksRouter.delete('/users/@me/bookmark-folders/:folderId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const folderId = req.params.folderId as string;
    await db.delete(bookmarkFolders)
      .where(and(eq(bookmarkFolders.id, folderId), eq(bookmarkFolders.userId, req.userId!)));
    res.json({ ok: true });
  } catch (err) {
    logger.error('[bookmark-folders] DELETE error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});
