import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { eq, and, lt, desc } from 'drizzle-orm';
import { db } from '../db/index';
import { messageBookmarks } from '../db/schema/message-bookmarks';
import { messages } from '../db/schema/messages';
import { channels } from '../db/schema/channels';
import { guilds } from '../db/schema/guilds';
import { users } from '../db/schema/users';
import { requireAuth } from '../middleware/auth';

export const bookmarksRouter = Router();

// GET /users/@me/bookmarks — list bookmarks with full context
bookmarksRouter.get('/users/@me/bookmarks', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 50);
    const before = req.query.before as string | undefined;

    let query = db.select({
      id: messageBookmarks.id,
      messageId: messageBookmarks.messageId,
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
      .where(
        before
          ? and(eq(messageBookmarks.userId, req.userId!), lt(messageBookmarks.createdAt, new Date(before)))
          : eq(messageBookmarks.userId, req.userId!)
      )
      .orderBy(desc(messageBookmarks.createdAt))
      .limit(limit);

    const bookmarks = await query;
    res.json(bookmarks);
  } catch (err) {
    logger.error('[bookmarks] GET error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// POST /users/@me/bookmarks — add bookmark
bookmarksRouter.post('/users/@me/bookmarks', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { messageId, note } = req.body as { messageId: string; note?: string };
    if (!messageId) {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'messageId is required' });
      return;
    }
    const [bookmark] = await db.insert(messageBookmarks)
      .values({ userId: req.userId!, messageId, note: note || null })
      .onConflictDoNothing()
      .returning();
    res.status(201).json(bookmark || { messageId, alreadyBookmarked: true });
  } catch (err) {
    logger.error('[bookmarks] POST error:', err);
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
