/**
 * routes/stories.ts — Ephemeral 24-hour stories/moments.
 *
 * Mounted at /api/v1/stories
 *
 * Endpoints:
 *   POST   /              — Create a story (text or image)
 *   GET    /feed          — Get stories from friends (last 24h)
 *   GET    /:storyId      — Get a single story
 *   DELETE /:storyId      — Delete own story
 *   POST   /:storyId/view — Mark story as viewed
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, desc, gt, inArray, sql } from 'drizzle-orm';
import { db } from '../db/index';
import { users } from '../db/schema/users';
import { relationships } from '../db/schema/relationships';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { logger } from '../lib/logger';

export const storiesRouter = Router();

// In-memory stories store (lightweight — no migration needed)
// In production this would be a DB table; using memory for minimal implementation
const storiesStore: Array<{
  id: string;
  userId: string;
  content: string;
  type: 'text' | 'image';
  imageUrl?: string;
  backgroundColor?: string;
  createdAt: Date;
  viewedBy: Set<string>;
}> = [];

let storyCounter = 0;

function cleanExpired() {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (let i = storiesStore.length - 1; i >= 0; i--) {
    if (storiesStore[i].createdAt.getTime() < cutoff) {
      storiesStore.splice(i, 1);
    }
  }
}

const createStorySchema = z.object({
  content: z.string().min(1).max(500),
  type: z.enum(['text', 'image']).optional(),
  imageUrl: z.string().optional(),
  backgroundColor: z.string().optional(),
});

// POST / — Create a story
storiesRouter.post('/', requireAuth, validate(createStorySchema), async (req: Request, res: Response): Promise<void> => {
  cleanExpired();
  const { content, type, imageUrl, backgroundColor } = req.body;

  const story = {
    id: `story_${++storyCounter}_${Date.now()}`,
    userId: req.userId!,
    content,
    type: (type || 'text') as 'text' | 'image',
    imageUrl,
    backgroundColor,
    createdAt: new Date(),
    viewedBy: new Set<string>(),
  };

  storiesStore.push(story);

  res.status(201).json({
    id: story.id,
    userId: story.userId,
    content: story.content,
    type: story.type,
    imageUrl: story.imageUrl,
    backgroundColor: story.backgroundColor,
    createdAt: story.createdAt.toISOString(),
    viewCount: 0,
  });
});

// GET /feed — Stories from friends in last 24h
storiesRouter.get('/feed', requireAuth, async (req: Request, res: Response): Promise<void> => {
  cleanExpired();
  const userId = req.userId!;

  try {
    // Get friend IDs
    const friends1 = await db
      .select({ otherId: relationships.addresseeId })
      .from(relationships)
      .where(and(eq(relationships.requesterId, userId), eq(relationships.type, 'FRIEND')));

    const friends2 = await db
      .select({ otherId: relationships.requesterId })
      .from(relationships)
      .where(and(eq(relationships.addresseeId, userId), eq(relationships.type, 'FRIEND')));

    const friendIds = new Set([userId, ...friends1.map(f => f.otherId), ...friends2.map(f => f.otherId)]);

    // Get user info for story authors
    const relevantStories = storiesStore.filter(s => friendIds.has(s.userId));

    if (relevantStories.length === 0) {
      res.json([]);
      return;
    }

    const authorIds = Array.from(new Set(relevantStories.map(s => s.userId)));
    const authorRows = authorIds.length > 0 ? await db
      .select({ id: users.id, username: users.username, displayName: users.displayName, avatarHash: users.avatarHash })
      .from(users)
      .where(inArray(users.id, authorIds)) : [];

    const authorMap = new Map(authorRows.map(a => [a.id, a]));

    // Group stories by user
    const grouped = new Map<string, typeof relevantStories>();
    for (const s of relevantStories) {
      if (!grouped.has(s.userId)) grouped.set(s.userId, []);
      grouped.get(s.userId)!.push(s);
    }

    const feed = Array.from(grouped.entries()).map(([uid, stories]) => {
      const author = authorMap.get(uid);
      return {
        userId: uid,
        username: author?.username ?? 'Unknown',
        displayName: author?.displayName ?? author?.username ?? 'Unknown',
        avatarHash: author?.avatarHash ?? null,
        stories: stories
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map(s => ({
            id: s.id,
            content: s.content,
            type: s.type,
            imageUrl: s.imageUrl,
            backgroundColor: s.backgroundColor,
            createdAt: s.createdAt.toISOString(),
            viewCount: s.viewedBy.size,
            viewed: s.viewedBy.has(userId),
          })),
        hasUnviewed: stories.some(s => !s.viewedBy.has(userId)),
      };
    }).sort((a, b) => {
      // Unviewed first, then by latest story
      if (a.hasUnviewed !== b.hasUnviewed) return a.hasUnviewed ? -1 : 1;
      return new Date(b.stories[0].createdAt).getTime() - new Date(a.stories[0].createdAt).getTime();
    });

    res.json(feed);
  } catch (err) {
    logger.error('[stories] feed error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:storyId
storiesRouter.get('/:storyId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { storyId } = req.params as Record<string, string>;
  const story = storiesStore.find(s => s.id === storyId);
  if (!story) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Story not found or expired' });
    return;
  }
  res.json({
    id: story.id,
    userId: story.userId,
    content: story.content,
    type: story.type,
    imageUrl: story.imageUrl,
    backgroundColor: story.backgroundColor,
    createdAt: story.createdAt.toISOString(),
    viewCount: story.viewedBy.size,
    viewed: story.viewedBy.has(req.userId!),
  });
});

// DELETE /:storyId
storiesRouter.delete('/:storyId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { storyId } = req.params as Record<string, string>;
  const idx = storiesStore.findIndex(s => s.id === storyId && s.userId === req.userId);
  if (idx === -1) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Story not found' });
    return;
  }
  storiesStore.splice(idx, 1);
  res.json({ code: 'OK' });
});

// POST /:storyId/view — Mark as viewed
storiesRouter.post('/:storyId/view', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { storyId } = req.params as Record<string, string>;
  const story = storiesStore.find(s => s.id === storyId);
  if (!story) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Story not found' });
    return;
  }
  story.viewedBy.add(req.userId!);
  res.json({ code: 'OK', viewCount: story.viewedBy.size });
});
