/**
 * routes/rss-feeds.ts — CRUD endpoints for RSS feed subscriptions.
 *
 * Mounted at /api/v1/guilds/:guildId/rss-feeds in src/routes/index.ts
 * with mergeParams so :guildId is visible.
 *
 * Endpoints:
 *   GET    /                — List all RSS feeds for a guild
 *   POST   /                — Add a new RSS feed (MANAGE_GUILD required)
 *   PATCH  /:feedId         — Update an RSS feed
 *   DELETE /:feedId         — Remove an RSS feed
 */

import { Router, Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '../db/index';
import { rssFeeds } from '../db/schema/rss-feeds';
import { channels } from '../db/schema/channels';
import { Permissions } from '../db/schema/roles';
import { requireAuth } from '../middleware/auth';
import { hasPermission } from './roles';
import { logger } from '../lib/logger';

export const rssFeedsRouter = Router({ mergeParams: true });

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const createFeedSchema = z.object({
  channelId: z.string().uuid(),
  feedUrl: z.string().url().max(2000),
  title: z.string().max(200).optional(),
  pollIntervalMinutes: z.number().int().min(5).max(1440).optional(),
  contentFilter: z.string().max(500).optional(),
});

const updateFeedSchema = z.object({
  feedUrl: z.string().url().max(2000).optional(),
  title: z.string().max(200).nullable().optional(),
  pollIntervalMinutes: z.number().int().min(5).max(1440).optional(),
  contentFilter: z.string().max(500).nullable().optional(),
  enabled: z.boolean().optional(),
  channelId: z.string().uuid().optional(),
});

// ---------------------------------------------------------------------------
// GET / — List feeds for a guild
// ---------------------------------------------------------------------------

rssFeedsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const guildId = req.params.guildId as string;

    if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission' });
      return;
    }

    const feeds = await db
      .select()
      .from(rssFeeds)
      .where(eq(rssFeeds.guildId, guildId));

    res.json(feeds);
  } catch (err) {
    logger.error('[rss-feeds] list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST / — Create a new feed subscription
// ---------------------------------------------------------------------------

rssFeedsRouter.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const guildId = req.params.guildId as string;

    if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission' });
      return;
    }

    const parsed = createFeedSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ code: 'BAD_REQUEST', message: parsed.error.message });
      return;
    }

    const { channelId, feedUrl, title, pollIntervalMinutes, contentFilter } = parsed.data;

    // Verify channel belongs to this guild
    const [channel] = await db
      .select()
      .from(channels)
      .where(and(eq(channels.id, channelId), eq(channels.guildId, guildId)))
      .limit(1);

    if (!channel) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Channel not found in this guild' });
      return;
    }

    const [feed] = await db
      .insert(rssFeeds)
      .values({
        guildId,
        channelId,
        feedUrl,
        title: title ?? null,
        pollIntervalMinutes: pollIntervalMinutes ?? 30,
        contentFilter: contentFilter ?? null,
        createdBy: req.userId!,
      })
      .returning();

    res.status(201).json(feed);
  } catch (err) {
    logger.error('[rss-feeds] create error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /:feedId — Update feed
// ---------------------------------------------------------------------------

rssFeedsRouter.patch('/:feedId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const guildId = req.params.guildId as string;
    const feedId = req.params.feedId as string;

    if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission' });
      return;
    }

    const parsed = updateFeedSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ code: 'BAD_REQUEST', message: parsed.error.message });
      return;
    }

    const updates: Record<string, any> = {};
    const data = parsed.data;

    if (data.feedUrl !== undefined) updates.feedUrl = data.feedUrl;
    if (data.title !== undefined) updates.title = data.title;
    if (data.pollIntervalMinutes !== undefined) updates.pollIntervalMinutes = data.pollIntervalMinutes;
    if (data.contentFilter !== undefined) updates.contentFilter = data.contentFilter;
    if (data.enabled !== undefined) updates.enabled = data.enabled;

    // If channelId changes, verify it belongs to the guild
    if (data.channelId !== undefined) {
      const [channel] = await db
        .select()
        .from(channels)
        .where(and(eq(channels.id, data.channelId), eq(channels.guildId, guildId)))
        .limit(1);

      if (!channel) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Channel not found in this guild' });
        return;
      }
      updates.channelId = data.channelId;
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ code: 'BAD_REQUEST', message: 'No fields to update' });
      return;
    }

    const [updated] = await db
      .update(rssFeeds)
      .set(updates)
      .where(and(eq(rssFeeds.id, feedId), eq(rssFeeds.guildId, guildId)))
      .returning();

    if (!updated) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Feed not found' });
      return;
    }

    res.json(updated);
  } catch (err) {
    logger.error('[rss-feeds] update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /:feedId — Remove feed
// ---------------------------------------------------------------------------

rssFeedsRouter.delete('/:feedId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const guildId = req.params.guildId as string;
    const feedId = req.params.feedId as string;

    if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission' });
      return;
    }

    const [deleted] = await db
      .delete(rssFeeds)
      .where(and(eq(rssFeeds.id, feedId), eq(rssFeeds.guildId, guildId)))
      .returning();

    if (!deleted) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Feed not found' });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    logger.error('[rss-feeds] delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
