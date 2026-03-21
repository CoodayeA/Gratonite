/**
 * routes/bot-store.ts — Bot Store endpoints (listings, reviews, installs).
 *
 * Mounted at:
 *   /bot-store          — browse & manage bot listings + reviews
 *   /bots/installs      — install / uninstall bots to guilds
 *   /bots/:appId/installs — list guilds a bot is installed in
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, desc, sql, ilike, or } from 'drizzle-orm';
import { db } from '../db/index';
import { botListings, botReviews, botInstalls } from '../db/schema/bot-store';
import { botApplications } from '../db/schema/bot-applications';
import { botGuildPermissions } from '../db/schema/bot-guild-permissions';
import { users } from '../db/schema/users';
import { guilds, guildMembers } from '../db/schema/guilds';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { getIO } from '../lib/socket-io';
import { logger } from '../lib/logger';
import { invalidateBotCache } from '../lib/webhook-dispatch';
import { hasPermission } from './roles';
import { Permissions } from '../db/schema/roles';

export const botStoreRouter = Router({ mergeParams: true });

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const createListingSchema = z.object({
  applicationId: z.string().optional(),
  shortDescription: z.string().min(1).max(256),
  longDescription: z.string().optional(),
  category: z.string().min(1).max(64),
  tags: z.array(z.string()).optional(),
  iconUrl: z.string().optional(),
  bannerUrl: z.string().optional(),
  name: z.string().min(1).max(128).optional(),
});

const updateListingSchema = z.object({
  shortDescription: z.string().min(1).max(256).optional(),
  longDescription: z.string().optional(),
  category: z.string().min(1).max(64).optional(),
  tags: z.array(z.string()).optional(),
  listed: z.boolean().optional(),
  name: z.string().min(1).max(128).optional(),
});

const postReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  content: z.string().min(1),
});

const updateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  content: z.string().min(1).optional(),
});

const installBotSchema = z.object({
  guildId: z.string().uuid(),
  applicationId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// GET /bot-store — browse bot listings
// ---------------------------------------------------------------------------

botStoreRouter.get('/bot-store', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, verified, search, limit, offset } = req.query as Record<string, string | undefined>;

    const conditions = [eq(botListings.listed, true)];

    if (category) {
      conditions.push(eq(botListings.category, category));
    }
    if (verified === 'true') {
      conditions.push(eq(botListings.verified, true));
    }

    let query = db.select({
      id: botListings.id,
      name: botListings.name,
      description: botListings.description,
      shortDescription: botListings.shortDescription,
      iconUrl: botListings.iconUrl,
      bannerUrl: botListings.bannerUrl,
      category: botListings.category,
      tags: botListings.tags,
      creatorId: botListings.creatorId,
      applicationId: botListings.applicationId,
      verified: botListings.verified,
      listed: botListings.listed,
      installCount: botListings.installCount,
      rating: botListings.rating,
      reviewCount: botListings.reviewCount,
      createdAt: botListings.createdAt,
      updatedAt: botListings.updatedAt,
    })
      .from(botListings)
      .$dynamic();

    if (search) {
      const escapedSearch = search.replace(/[%_\\]/g, '\\$&');
      conditions.push(
        or(
          ilike(botListings.name, `%${escapedSearch}%`),
          ilike(botListings.shortDescription, `%${escapedSearch}%`),
        )!,
      );
    }

    query = query.where(and(...conditions));
    query = query.orderBy(desc(botListings.installCount));

    const lim = Math.min(Number(limit) || 25, 100);
    const off = Number(offset) || 0;
    query = query.limit(lim).offset(off);

    const items = await query;
    res.json({ items });
  } catch (err) {
    logger.error({ msg: 'browse bot listings failed', err });
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /bot-store/listings/mine — developer's own listings
// ---------------------------------------------------------------------------

botStoreRouter.get('/bot-store/listings/mine', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const items = await db.select()
      .from(botListings)
      .where(eq(botListings.creatorId, req.userId!))
      .orderBy(desc(botListings.createdAt));

    res.json({ items });
  } catch (err) {
    logger.error({ msg: 'fetch own bot listings failed', err });
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /bot-store/:id — single listing
// ---------------------------------------------------------------------------

botStoreRouter.get('/bot-store/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params as Record<string, string>;

    const [listing] = await db.select()
      .from(botListings)
      .where(eq(botListings.id, id))
      .limit(1);

    if (!listing) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Bot listing not found' });
      return;
    }

    res.json(listing);
  } catch (err) {
    logger.error({ msg: 'fetch bot listing failed', err });
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /bot-store/listings — create listing
// ---------------------------------------------------------------------------

botStoreRouter.post('/bot-store/listings', requireAuth, validate(createListingSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { applicationId, shortDescription, longDescription, category, tags, iconUrl, bannerUrl, name } = req.body;

    const [listing] = await db.insert(botListings).values({
      name: name ?? 'Unnamed Bot',
      shortDescription,
      description: longDescription ?? null,
      category,
      tags: tags ?? [],
      iconUrl: iconUrl ?? null,
      bannerUrl: bannerUrl ?? null,
      creatorId: req.userId!,
      applicationId: applicationId ?? null,
    }).returning();

    res.status(201).json(listing);
  } catch (err) {
    logger.error({ msg: 'create bot listing failed', err });
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /bot-store/listings/:id — update listing
// ---------------------------------------------------------------------------

botStoreRouter.patch('/bot-store/listings/:id', requireAuth, validate(updateListingSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params as Record<string, string>;

    const [existing] = await db.select().from(botListings).where(eq(botListings.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Bot listing not found' });
      return;
    }
    if (existing.creatorId !== req.userId) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Not your listing' });
      return;
    }

    const { shortDescription, longDescription, category, tags, listed, name } = req.body;
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (shortDescription !== undefined) updates.shortDescription = shortDescription;
    if (longDescription !== undefined) updates.description = longDescription;
    if (category !== undefined) updates.category = category;
    if (tags !== undefined) updates.tags = tags;
    if (listed !== undefined) updates.listed = listed;
    if (name !== undefined) updates.name = name;

    const [updated] = await db.update(botListings)
      .set(updates)
      .where(eq(botListings.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    logger.error({ msg: 'update bot listing failed', err });
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /bot-store/listings/:id — delete listing
// ---------------------------------------------------------------------------

botStoreRouter.delete('/bot-store/listings/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params as Record<string, string>;

    const [existing] = await db.select().from(botListings).where(eq(botListings.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Bot listing not found' });
      return;
    }
    if (existing.creatorId !== req.userId) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Not your listing' });
      return;
    }

    await db.delete(botListings).where(eq(botListings.id, id));
    res.status(204).send();
  } catch (err) {
    logger.error({ msg: 'delete bot listing failed', err });
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /bot-store/:id/reviews — list reviews for a bot
// ---------------------------------------------------------------------------

botStoreRouter.get('/bot-store/:id/reviews', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params as Record<string, string>;
    const { limit, offset } = req.query as Record<string, string | undefined>;

    const lim = Math.min(Number(limit) || 25, 100);
    const off = Number(offset) || 0;

    const items = await db.select({
      id: botReviews.id,
      listingId: botReviews.listingId,
      userId: botReviews.userId,
      rating: botReviews.rating,
      content: botReviews.content,
      createdAt: botReviews.createdAt,
      username: users.username,
      displayName: users.displayName,
      avatarHash: users.avatarHash,
    })
      .from(botReviews)
      .leftJoin(users, eq(users.id, botReviews.userId))
      .where(eq(botReviews.listingId, id))
      .orderBy(desc(botReviews.createdAt))
      .limit(lim)
      .offset(off);

    res.json({
      items: items.map((r) => ({
        id: r.id,
        listingId: r.listingId,
        userId: r.userId,
        rating: r.rating,
        content: r.content,
        createdAt: r.createdAt,
        author: {
          id: r.userId,
          username: r.username,
          displayName: r.displayName,
          avatarHash: r.avatarHash,
        },
      })),
    });
  } catch (err) {
    logger.error({ msg: 'fetch bot reviews failed', err });
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /bot-store/:id/reviews — post a review
// ---------------------------------------------------------------------------

botStoreRouter.post('/bot-store/:id/reviews', requireAuth, validate(postReviewSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params as Record<string, string>;
    const { rating, content } = req.body;

    // Check listing exists
    const [listing] = await db.select().from(botListings).where(eq(botListings.id, id)).limit(1);
    if (!listing) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Bot listing not found' });
      return;
    }

    const [review] = await db.insert(botReviews).values({
      listingId: id,
      userId: req.userId!,
      rating,
      content,
    }).returning();

    // Update listing review stats
    await db.update(botListings)
      .set({
        reviewCount: sql`${botListings.reviewCount} + 1`,
        rating: sql`(SELECT COALESCE(AVG(rating), 0) FROM bot_reviews WHERE listing_id = ${id})`,
        updatedAt: new Date(),
      })
      .where(eq(botListings.id, id));

    res.status(201).json(review);
  } catch (err) {
    logger.error({ msg: 'post bot review failed', err });
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /bot-store/:id/reviews/:reviewId — update a review
// ---------------------------------------------------------------------------

botStoreRouter.patch('/bot-store/:id/reviews/:reviewId', requireAuth, validate(updateReviewSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, reviewId } = req.params as Record<string, string>;

    const [existing] = await db.select().from(botReviews)
      .where(and(eq(botReviews.id, reviewId), eq(botReviews.listingId, id)))
      .limit(1);

    if (!existing) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Review not found' });
      return;
    }
    if (existing.userId !== req.userId) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Not your review' });
      return;
    }

    const { rating, content } = req.body;
    const updates: Record<string, unknown> = {};
    if (rating !== undefined) updates.rating = rating;
    if (content !== undefined) updates.content = content;

    const [updated] = await db.update(botReviews)
      .set(updates)
      .where(eq(botReviews.id, reviewId))
      .returning();

    // Recalculate listing rating
    await db.update(botListings)
      .set({
        rating: sql`(SELECT COALESCE(AVG(rating), 0) FROM bot_reviews WHERE listing_id = ${id})`,
        updatedAt: new Date(),
      })
      .where(eq(botListings.id, id));

    res.json(updated);
  } catch (err) {
    logger.error({ msg: 'update bot review failed', err });
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /bot-store/:id/reviews/:reviewId — delete a review
// ---------------------------------------------------------------------------

botStoreRouter.delete('/bot-store/:id/reviews/:reviewId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, reviewId } = req.params as Record<string, string>;

    const [existing] = await db.select().from(botReviews)
      .where(and(eq(botReviews.id, reviewId), eq(botReviews.listingId, id)))
      .limit(1);

    if (!existing) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Review not found' });
      return;
    }
    if (existing.userId !== req.userId) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Not your review' });
      return;
    }

    await db.delete(botReviews).where(eq(botReviews.id, reviewId));

    // Update listing review stats
    await db.update(botListings)
      .set({
        reviewCount: sql`GREATEST(${botListings.reviewCount} - 1, 0)`,
        rating: sql`(SELECT COALESCE(AVG(rating), 0) FROM bot_reviews WHERE listing_id = ${id})`,
        updatedAt: new Date(),
      })
      .where(eq(botListings.id, id));

    res.status(204).send();
  } catch (err) {
    logger.error({ msg: 'delete bot review failed', err });
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /bots/installs — install bot to guild
// ---------------------------------------------------------------------------

botStoreRouter.post('/bots/installs', requireAuth, validate(installBotSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId, applicationId } = req.body;

    // Require MANAGE_GUILD permission to install bots
    if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission' });
      return;
    }

    // Find listing by applicationId
    const [listing] = await db.select().from(botListings)
      .where(eq(botListings.applicationId, applicationId))
      .limit(1);

    if (!listing) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Bot listing not found' });
      return;
    }

    const [install] = await db.insert(botInstalls).values({
      botId: listing.id,
      guildId,
      applicationId,
      installedBy: req.userId!,
    }).returning();

    // Increment install count
    await db.update(botListings)
      .set({ installCount: sql`${botListings.installCount} + 1`, updatedAt: new Date() })
      .where(eq(botListings.id, listing.id));

    // Add bot's virtual user to guild members + create default permissions
    const [botApp] = await db.select({ botUserId: botApplications.botUserId })
      .from(botApplications)
      .where(eq(botApplications.id, applicationId))
      .limit(1);

    if (botApp?.botUserId) {
      await db.insert(guildMembers).values({
        guildId,
        userId: botApp.botUserId,
      }).onConflictDoNothing();

      await db.update(guilds)
        .set({ memberCount: sql`${guilds.memberCount} + 1`, updatedAt: new Date() })
        .where(eq(guilds.id, guildId));

      // Emit GUILD_MEMBER_ADD for the bot user
      const [botUser] = await db.select({ id: users.id, username: users.username, displayName: users.displayName, avatarHash: users.avatarHash, isBot: users.isBot })
        .from(users).where(eq(users.id, botApp.botUserId)).limit(1);
      if (botUser) {
        try {
          getIO().to(`guild:${guildId}`).emit('GUILD_MEMBER_ADD', {
            guildId,
            user: { id: botUser.id, username: botUser.username, displayName: botUser.displayName, avatarHash: botUser.avatarHash, isBot: true },
          });
        } catch (err) { logger.debug({ msg: 'socket emit failed', event: 'bot-store', err }); }
      }
    }

    // Create default bot permissions for this guild
    await db.insert(botGuildPermissions).values({
      botApplicationId: applicationId,
      guildId,
    }).onConflictDoNothing();

    // Invalidate cached bot list for this guild
    await invalidateBotCache(guildId);

    res.status(201).json(install);
  } catch (err) {
    logger.error({ msg: 'install bot failed', err });
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /bots/installs/:guildId — list installed bots for guild
// ---------------------------------------------------------------------------

botStoreRouter.get('/bots/installs/:guildId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params as Record<string, string>;

    // Require guild membership with MANAGE_GUILD permission
    if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission' });
      return;
    }

    const items = await db.select({
      id: botInstalls.id,
      botId: botInstalls.botId,
      guildId: botInstalls.guildId,
      applicationId: botInstalls.applicationId,
      installedBy: botInstalls.installedBy,
      createdAt: botInstalls.createdAt,
      botName: botListings.name,
      botIconUrl: botListings.iconUrl,
      botShortDescription: botListings.shortDescription,
    })
      .from(botInstalls)
      .leftJoin(botListings, eq(botListings.id, botInstalls.botId))
      .where(eq(botInstalls.guildId, guildId))
      .orderBy(desc(botInstalls.createdAt));

    res.json(items);
  } catch (err) {
    logger.error({ msg: 'list installed bots failed', err });
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /bots/installs/:guildId/:appId — uninstall bot from guild
// ---------------------------------------------------------------------------

botStoreRouter.delete('/bots/installs/:guildId/:appId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId, appId } = req.params as Record<string, string>;

    // Require MANAGE_GUILD permission to uninstall bots
    if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission' });
      return;
    }

    const [existing] = await db.select().from(botInstalls)
      .where(and(eq(botInstalls.guildId, guildId), eq(botInstalls.applicationId, appId)))
      .limit(1);

    if (!existing) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Bot install not found' });
      return;
    }

    await db.delete(botInstalls).where(eq(botInstalls.id, existing.id));

    // Decrement install count
    await db.update(botListings)
      .set({
        installCount: sql`GREATEST(${botListings.installCount} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(botListings.id, existing.botId));

    // Remove bot's virtual user from guild members
    if (existing.applicationId) {
      const [botApp] = await db.select({ botUserId: botApplications.botUserId })
        .from(botApplications)
        .where(eq(botApplications.id, existing.applicationId))
        .limit(1);

      if (botApp?.botUserId) {
        await db.delete(guildMembers).where(
          and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, botApp.botUserId)),
        );
        await db.update(guilds)
          .set({ memberCount: sql`GREATEST(${guilds.memberCount} - 1, 0)`, updatedAt: new Date() })
          .where(eq(guilds.id, guildId));

        try {
          getIO().to(`guild:${guildId}`).emit('GUILD_MEMBER_REMOVE', { guildId, userId: botApp.botUserId });
        } catch (socketErr) { logger.debug({ msg: 'socket emit failed', event: 'bot-store', err: socketErr }); }
      }

      // Remove bot permissions
      await db.delete(botGuildPermissions).where(
        and(eq(botGuildPermissions.botApplicationId, existing.applicationId), eq(botGuildPermissions.guildId, guildId)),
      );
    }

    // Invalidate cached bot list for this guild
    await invalidateBotCache(guildId);

    res.status(204).send();
  } catch (err) {
    logger.error({ msg: 'uninstall bot failed', err });
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /bots/:appId/installs — list guilds a bot is installed in
// ---------------------------------------------------------------------------

botStoreRouter.get('/bots/:appId/installs', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { appId } = req.params as Record<string, string>;

    const items = await db.select({
      id: botInstalls.id,
      botId: botInstalls.botId,
      guildId: botInstalls.guildId,
      applicationId: botInstalls.applicationId,
      installedBy: botInstalls.installedBy,
      createdAt: botInstalls.createdAt,
      guildName: guilds.name,
      guildIconHash: guilds.iconHash,
    })
      .from(botInstalls)
      .leftJoin(guilds, eq(guilds.id, botInstalls.guildId))
      .where(eq(botInstalls.applicationId, appId))
      .orderBy(desc(botInstalls.createdAt));

    res.json(items);
  } catch (err) {
    logger.error({ msg: 'list bot installs failed', err });
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});
