import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { eq, and, desc, sql, count } from 'drizzle-orm';
import { db } from '../db/index';
import { readingListItems, readingListVotes, readingListReadStatus } from '../db/schema/reading-lists';
import { users } from '../db/schema/users';
import { channels } from '../db/schema/channels';
import { guildMembers } from '../db/schema/guilds';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { z } from 'zod';

export const readingListsRouter = Router({ mergeParams: true });

const addItemSchema = z.object({
  url: z.string().url().max(2000),
  title: z.string().min(1).max(300),
  description: z.string().max(2000).nullable().optional(),
  imageUrl: z.string().url().max(2000).nullable().optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

// GET /channels/:channelId/reading-list — list items
readingListsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const channelId = req.params.channelId as string;
    const sort = (req.query.sort as string) || 'upvotes';
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;

    const orderBy = sort === 'date'
      ? desc(readingListItems.createdAt)
      : desc(readingListItems.upvotes);

    const items = await db.select({
      id: readingListItems.id,
      url: readingListItems.url,
      title: readingListItems.title,
      description: readingListItems.description,
      imageUrl: readingListItems.imageUrl,
      tags: readingListItems.tags,
      upvotes: readingListItems.upvotes,
      createdAt: readingListItems.createdAt,
      addedBy: readingListItems.addedBy,
      addedByUsername: users.username,
      addedByDisplayName: users.displayName,
    })
      .from(readingListItems)
      .leftJoin(users, eq(readingListItems.addedBy, users.id))
      .where(eq(readingListItems.channelId, channelId))
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    // Check which items the current user has voted on and read
    const itemIds = items.map(i => i.id);
    let userVotes = new Set<string>();
    let userReads = new Set<string>();

    if (itemIds.length > 0) {
      const votes = await db.select({ itemId: readingListVotes.itemId })
        .from(readingListVotes)
        .where(and(
          eq(readingListVotes.userId, req.userId!),
          sql`${readingListVotes.itemId} IN (${sql.join(itemIds.map(id => sql`${id}`), sql`,`)})`,
        ));
      userVotes = new Set(votes.map(v => v.itemId));

      const reads = await db.select({ itemId: readingListReadStatus.itemId })
        .from(readingListReadStatus)
        .where(and(
          eq(readingListReadStatus.userId, req.userId!),
          sql`${readingListReadStatus.itemId} IN (${sql.join(itemIds.map(id => sql`${id}`), sql`,`)})`,
        ));
      userReads = new Set(reads.map(r => r.itemId));
    }

    const result = items.map(item => ({
      ...item,
      hasVoted: userVotes.has(item.id),
      hasRead: userReads.has(item.id),
    }));

    res.json(result);
  } catch (err) {
    logger.error('[reading-lists] GET error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// POST /channels/:channelId/reading-list — add item
readingListsRouter.post('/', requireAuth, validate(addItemSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const channelId = req.params.channelId as string;
    const { url, title, description, imageUrl, tags } = req.body;

    // Get guildId from channel
    const [channel] = await db.select({ guildId: channels.guildId })
      .from(channels)
      .where(eq(channels.id, channelId))
      .limit(1);

    if (!channel || !channel.guildId) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Channel not found' });
      return;
    }

    // Verify guild membership
    const [membership] = await db.select({ id: guildMembers.id }).from(guildMembers)
      .where(and(eq(guildMembers.guildId, channel.guildId), eq(guildMembers.userId, req.userId!)))
      .limit(1);
    if (!membership) { res.status(403).json({ code: 'FORBIDDEN', message: 'Not a member of this guild' }); return; }

    const [item] = await db.insert(readingListItems)
      .values({
        channelId,
        guildId: channel.guildId,
        addedBy: req.userId!,
        url,
        title,
        description: description || null,
        imageUrl: imageUrl || null,
        tags: tags || [],
      })
      .returning();

    res.status(201).json(item);
  } catch (err) {
    logger.error('[reading-lists] POST error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// DELETE /channels/:channelId/reading-list/:itemId — remove item
readingListsRouter.delete('/:itemId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const itemId = req.params.itemId as string;
    const channelId = req.params.channelId as string;

    const [deleted] = await db.delete(readingListItems)
      .where(and(
        eq(readingListItems.id, itemId),
        eq(readingListItems.channelId, channelId),
        eq(readingListItems.addedBy, req.userId!),
      ))
      .returning();

    if (!deleted) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Item not found or not owned by you' });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    logger.error('[reading-lists] DELETE error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// POST /channels/:channelId/reading-list/:itemId/vote — toggle upvote
readingListsRouter.post('/:itemId/vote', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const itemId = req.params.itemId as string;

    // Check if already voted
    const [existing] = await db.select({ id: readingListVotes.id })
      .from(readingListVotes)
      .where(and(
        eq(readingListVotes.itemId, itemId),
        eq(readingListVotes.userId, req.userId!),
      ))
      .limit(1);

    if (existing) {
      // Remove vote
      await db.delete(readingListVotes).where(eq(readingListVotes.id, existing.id));
      await db.update(readingListItems)
        .set({ upvotes: sql`${readingListItems.upvotes} - 1` })
        .where(eq(readingListItems.id, itemId));
      res.json({ voted: false });
    } else {
      // Add vote
      await db.insert(readingListVotes)
        .values({ itemId, userId: req.userId! })
        .onConflictDoNothing();
      await db.update(readingListItems)
        .set({ upvotes: sql`${readingListItems.upvotes} + 1` })
        .where(eq(readingListItems.id, itemId));
      res.json({ voted: true });
    }
  } catch (err) {
    logger.error('[reading-lists] VOTE error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// POST /channels/:channelId/reading-list/:itemId/read — mark as read
readingListsRouter.post('/:itemId/read', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const itemId = req.params.itemId as string;

    const [status] = await db.insert(readingListReadStatus)
      .values({ itemId, userId: req.userId! })
      .onConflictDoNothing()
      .returning();

    res.json(status || { alreadyRead: true });
  } catch (err) {
    logger.error('[reading-lists] READ error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// GET /channels/:channelId/reading-list/stats — reading stats
readingListsRouter.get('/stats', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const channelId = req.params.channelId as string;

    const [totalItems] = await db.select({ count: count() })
      .from(readingListItems)
      .where(eq(readingListItems.channelId, channelId));

    const [totalReads] = await db.select({ count: count() })
      .from(readingListReadStatus)
      .innerJoin(readingListItems, eq(readingListReadStatus.itemId, readingListItems.id))
      .where(eq(readingListItems.channelId, channelId));

    const [userReads] = await db.select({ count: count() })
      .from(readingListReadStatus)
      .innerJoin(readingListItems, eq(readingListReadStatus.itemId, readingListItems.id))
      .where(and(
        eq(readingListItems.channelId, channelId),
        eq(readingListReadStatus.userId, req.userId!),
      ));

    const [totalVotes] = await db.select({ sum: sql<number>`COALESCE(SUM(${readingListItems.upvotes}), 0)` })
      .from(readingListItems)
      .where(eq(readingListItems.channelId, channelId));

    // Top contributors
    const topContributors = await db.select({
      userId: readingListItems.addedBy,
      count: count(),
    })
      .from(readingListItems)
      .where(eq(readingListItems.channelId, channelId))
      .groupBy(readingListItems.addedBy)
      .orderBy(desc(count()))
      .limit(5);

    res.json({
      totalItems: Number(totalItems.count),
      totalReads: Number(totalReads.count),
      userReads: Number(userReads.count),
      totalVotes: Number(totalVotes.sum),
      topContributors,
    });
  } catch (err) {
    logger.error('[reading-lists] STATS error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});
