/**
 * routes/stories.ts — Ephemeral 24-hour stories/moments.
 *
 * Mounted at /api/v1/stories
 *
 * Endpoints:
 *   POST   /              — Create a story (text or image)
 *   GET    /feed          — Get stories from friends (last 24h)
 *   GET    /:storyId      — Get a single story
 *   PATCH  /:storyId      — Edit own story content
 *   DELETE /:storyId      — Delete own story
 *   POST   /:storyId/view — Mark story as viewed
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, desc, gt, inArray, sql, count } from 'drizzle-orm';
import { db } from '../db/index';
import { users } from '../db/schema/users';
import { relationships } from '../db/schema/relationships';
import { stories, storyViews } from '../db/schema/stories';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { logger } from '../lib/logger';

export const storiesRouter = Router();

const createStorySchema = z.object({
  content: z.string().min(1).max(500),
  type: z.enum(['text', 'image']).optional(),
  imageUrl: z.string().optional(),
  backgroundColor: z.string().optional(),
});

const updateStorySchema = z.object({
  content: z.string().min(1).max(500),
});

// POST / — Create a story
storiesRouter.post('/', requireAuth, validate(createStorySchema), async (req: Request, res: Response): Promise<void> => {
  const { content, type, imageUrl, backgroundColor } = req.body;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  try {
    const [story] = await db.insert(stories).values({
      userId: req.userId!,
      content,
      type: type ?? 'text',
      imageUrl: imageUrl ?? null,
      backgroundColor: backgroundColor ?? null,
      expiresAt,
    }).returning();

    res.status(201).json({
      id: story.id,
      userId: story.userId,
      content: story.content,
      type: story.type,
      imageUrl: story.imageUrl,
      backgroundColor: story.backgroundColor,
      createdAt: story.createdAt.toISOString(),
      expiresAt: story.expiresAt.toISOString(),
      viewCount: 0,
    });
  } catch (err) {
    logger.error('[stories] create error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to create story' });
  }
});

// GET /feed — Stories from friends in last 24h
storiesRouter.get('/feed', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const now = new Date();

  try {
    const friends1 = await db
      .select({ otherId: relationships.addresseeId })
      .from(relationships)
      .where(and(eq(relationships.requesterId, userId), eq(relationships.type, 'FRIEND')));

    const friends2 = await db
      .select({ otherId: relationships.requesterId })
      .from(relationships)
      .where(and(eq(relationships.addresseeId, userId), eq(relationships.type, 'FRIEND')));

    const friendIds = Array.from(new Set([userId, ...friends1.map(f => f.otherId), ...friends2.map(f => f.otherId)]));

    const activeStories = await db
      .select()
      .from(stories)
      .where(and(inArray(stories.userId, friendIds), gt(stories.expiresAt, now)))
      .orderBy(desc(stories.createdAt));

    if (activeStories.length === 0) {
      res.json([]);
      return;
    }

    const authorIds = Array.from(new Set(activeStories.map(s => s.userId)));
    const authorRows = await db
      .select({ id: users.id, username: users.username, displayName: users.displayName, avatarHash: users.avatarHash })
      .from(users)
      .where(inArray(users.id, authorIds));
    const authorMap = new Map(authorRows.map(a => [a.id, a]));

    const storyIds = activeStories.map(s => s.id);
    const viewRows = await db
      .select({ storyId: storyViews.storyId, viewerId: storyViews.viewerId })
      .from(storyViews)
      .where(inArray(storyViews.storyId, storyIds));

    const viewersByStory = new Map<string, Set<string>>();
    for (const v of viewRows) {
      if (!viewersByStory.has(v.storyId)) viewersByStory.set(v.storyId, new Set());
      viewersByStory.get(v.storyId)!.add(v.viewerId);
    }

    const grouped = new Map<string, typeof activeStories>();
    for (const s of activeStories) {
      if (!grouped.has(s.userId)) grouped.set(s.userId, []);
      grouped.get(s.userId)!.push(s);
    }

    const feed = Array.from(grouped.entries()).map(([uid, userStories]) => {
      const author = authorMap.get(uid);
      const mappedStories = userStories.map(s => ({
        id: s.id,
        content: s.content,
        type: s.type,
        imageUrl: s.imageUrl,
        backgroundColor: s.backgroundColor,
        createdAt: s.createdAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
        viewCount: viewersByStory.get(s.id)?.size ?? 0,
        viewed: viewersByStory.get(s.id)?.has(userId) ?? false,
      }));
      return {
        userId: uid,
        username: author?.username ?? 'Unknown',
        displayName: author?.displayName ?? author?.username ?? 'Unknown',
        avatarHash: author?.avatarHash ?? null,
        stories: mappedStories,
        hasUnviewed: mappedStories.some(s => !s.viewed),
      };
    }).sort((a, b) => {
      if (a.hasUnviewed !== b.hasUnviewed) return a.hasUnviewed ? -1 : 1;
      return new Date(b.stories[0].createdAt).getTime() - new Date(a.stories[0].createdAt).getTime();
    });

    res.json(feed);
  } catch (err) {
    logger.error('[stories] feed error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// GET /:storyId
storiesRouter.get('/:storyId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { storyId } = req.params as Record<string, string>;
  const now = new Date();

  try {
    const [story] = await db
      .select()
      .from(stories)
      .where(and(eq(stories.id, storyId), gt(stories.expiresAt, now)));

    if (!story) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Story not found or expired' });
      return;
    }

    const viewRows = await db.select().from(storyViews).where(eq(storyViews.storyId, storyId));
    const viewerSet = new Set(viewRows.map(v => v.viewerId));

    res.json({
      id: story.id,
      userId: story.userId,
      content: story.content,
      type: story.type,
      imageUrl: story.imageUrl,
      backgroundColor: story.backgroundColor,
      createdAt: story.createdAt.toISOString(),
      expiresAt: story.expiresAt.toISOString(),
      viewCount: viewerSet.size,
      viewed: viewerSet.has(req.userId!),
    });
  } catch (err) {
    logger.error('[stories] get error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// PATCH /:storyId — Edit story content
storiesRouter.patch('/:storyId', requireAuth, validate(updateStorySchema), async (req: Request, res: Response): Promise<void> => {
  const { storyId } = req.params as Record<string, string>;
  const { content } = req.body;
  const now = new Date();

  try {
    const [existing] = await db
      .select()
      .from(stories)
      .where(and(eq(stories.id, storyId), eq(stories.userId, req.userId!), gt(stories.expiresAt, now)));

    if (!existing) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Story not found' });
      return;
    }

    const [updated] = await db
      .update(stories)
      .set({ content })
      .where(eq(stories.id, storyId))
      .returning();

    res.json({ id: updated.id, content: updated.content });
  } catch (err) {
    logger.error('[stories] patch error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// DELETE /:storyId
storiesRouter.delete('/:storyId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { storyId } = req.params as Record<string, string>;

  try {
    const result = await db
      .delete(stories)
      .where(and(eq(stories.id, storyId), eq(stories.userId, req.userId!)))
      .returning({ id: stories.id });

    if (result.length === 0) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Story not found' });
      return;
    }

    res.json({ code: 'OK' });
  } catch (err) {
    logger.error('[stories] delete error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// POST /:storyId/view — Mark as viewed
storiesRouter.post('/:storyId/view', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { storyId } = req.params as Record<string, string>;
  const viewerId = req.userId!;
  const now = new Date();

  try {
    const [story] = await db
      .select({ id: stories.id })
      .from(stories)
      .where(and(eq(stories.id, storyId), gt(stories.expiresAt, now)));

    if (!story) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Story not found' });
      return;
    }

    await db.insert(storyViews).values({ storyId, viewerId }).onConflictDoNothing();

    const [{ viewCount }] = await db
      .select({ viewCount: count() })
      .from(storyViews)
      .where(eq(storyViews.storyId, storyId));

    res.json({ code: 'OK', viewCount });
  } catch (err) {
    logger.error('[stories] view error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});
