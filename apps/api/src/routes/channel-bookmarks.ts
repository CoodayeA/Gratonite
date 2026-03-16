/**
 * routes/channel-bookmarks.ts — Channel Bookmarks Bar.
 * Mounted at /channels/:channelId/bookmarks
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, asc } from 'drizzle-orm';
import { db } from '../db/index';
import { channelBookmarks } from '../db/schema/channel-bookmarks';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { getIO } from '../lib/socket-io';
import { logger } from '../lib/logger';
import { Permissions } from '../db/schema/roles';
import { hasPermission } from './roles';
import { channels } from '../db/schema/channels';

export const channelBookmarksRouter = Router({ mergeParams: true });

const createBookmarkSchema = z.object({
  title: z.string().min(1).max(200),
  url: z.string().url().optional(),
  fileId: z.string().uuid().optional(),
  messageId: z.string().uuid().optional(),
  type: z.enum(['link', 'file', 'message']).optional().default('link'),
});

const updateBookmarkSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  url: z.string().url().optional(),
  position: z.number().int().min(0).optional(),
});

const reorderSchema = z.array(z.object({
  id: z.string().uuid(),
  position: z.number().int().min(0),
}));

/** Check if user can manage bookmarks (MANAGE_CHANNELS permission on the guild) */
async function canManageBookmarks(userId: string, channelId: string): Promise<boolean> {
  const [channel] = await db.select().from(channels)
    .where(eq(channels.id, channelId)).limit(1);
  if (!channel) return false;

  // Check MANAGE_CHANNELS permission on guild
  if (channel.guildId) {
    return hasPermission(userId, channel.guildId, Permissions.MANAGE_CHANNELS);
  }

  // DM channels — the participant themselves can manage
  return true;
}

// GET /channels/:channelId/bookmarks — list bookmarks ordered by position
channelBookmarksRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const channelId = req.params.channelId as string;
    const bookmarks = await db.select()
      .from(channelBookmarks)
      .where(eq(channelBookmarks.channelId, channelId))
      .orderBy(asc(channelBookmarks.position));

    res.json(bookmarks);
  } catch (err) {
    logger.error('[channel-bookmarks] GET list error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// POST /channels/:channelId/bookmarks — add bookmark
channelBookmarksRouter.post('/', requireAuth, validate(createBookmarkSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const channelId = req.params.channelId as string;

    if (!(await canManageBookmarks(req.userId!, channelId))) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Missing permission to manage bookmarks' });
      return;
    }

    const { title, url, fileId, messageId, type } = req.body;

    const [bookmark] = await db.insert(channelBookmarks).values({
      channelId,
      addedBy: req.userId!,
      title,
      url: url || null,
      fileId: fileId || null,
      messageId: messageId || null,
      type,
    }).returning();

    getIO().to(`channel:${channelId}`).emit('CHANNEL_BOOKMARK_CREATE', bookmark);
    res.status(201).json(bookmark);
  } catch (err) {
    logger.error('[channel-bookmarks] POST create error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// PATCH /channels/:channelId/bookmarks/reorder — batch reorder
channelBookmarksRouter.patch('/reorder', requireAuth, validate(reorderSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const channelId = req.params.channelId as string;

    if (!(await canManageBookmarks(req.userId!, channelId))) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Missing permission to manage bookmarks' });
      return;
    }

    const items: Array<{ id: string; position: number }> = req.body;

    for (const item of items) {
      await db.update(channelBookmarks)
        .set({ position: item.position })
        .where(and(eq(channelBookmarks.id, item.id), eq(channelBookmarks.channelId, channelId)));
    }

    const updated = await db.select()
      .from(channelBookmarks)
      .where(eq(channelBookmarks.channelId, channelId))
      .orderBy(asc(channelBookmarks.position));

    getIO().to(`channel:${channelId}`).emit('CHANNEL_BOOKMARKS_REORDER', updated);
    res.json(updated);
  } catch (err) {
    logger.error('[channel-bookmarks] PATCH reorder error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// PATCH /channels/:channelId/bookmarks/:bookmarkId — update bookmark
channelBookmarksRouter.patch('/:bookmarkId', requireAuth, validate(updateBookmarkSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const channelId = req.params.channelId as string;
    const bookmarkId = req.params.bookmarkId as string;

    if (!(await canManageBookmarks(req.userId!, channelId))) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Missing permission to manage bookmarks' });
      return;
    }

    const updates: Record<string, unknown> = {};
    if (req.body.title !== undefined) updates.title = req.body.title;
    if (req.body.url !== undefined) updates.url = req.body.url;
    if (req.body.position !== undefined) updates.position = req.body.position;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ code: 'BAD_REQUEST', message: 'No fields to update' });
      return;
    }

    const [updated] = await db.update(channelBookmarks)
      .set(updates)
      .where(and(eq(channelBookmarks.id, bookmarkId), eq(channelBookmarks.channelId, channelId)))
      .returning();

    if (!updated) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Bookmark not found' });
      return;
    }

    getIO().to(`channel:${channelId}`).emit('CHANNEL_BOOKMARK_UPDATE', updated);
    res.json(updated);
  } catch (err) {
    logger.error('[channel-bookmarks] PATCH update error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// DELETE /channels/:channelId/bookmarks/:bookmarkId — remove bookmark
channelBookmarksRouter.delete('/:bookmarkId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const channelId = req.params.channelId as string;
    const bookmarkId = req.params.bookmarkId as string;

    if (!(await canManageBookmarks(req.userId!, channelId))) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Missing permission to manage bookmarks' });
      return;
    }

    const deleted = await db.delete(channelBookmarks)
      .where(and(eq(channelBookmarks.id, bookmarkId), eq(channelBookmarks.channelId, channelId)))
      .returning();

    if (deleted.length === 0) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Bookmark not found' });
      return;
    }

    getIO().to(`channel:${channelId}`).emit('CHANNEL_BOOKMARK_DELETE', { id: bookmarkId, channelId });
    res.json({ success: true });
  } catch (err) {
    logger.error('[channel-bookmarks] DELETE error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});
