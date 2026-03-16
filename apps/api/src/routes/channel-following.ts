import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index';
import { channelFollowers } from '../db/schema/channel-followers';
import { channels } from '../db/schema/channels';
import { guilds } from '../db/schema/guilds';
import { guildMembers } from '../db/schema/guilds';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { z } from 'zod';

export const channelFollowingRouter = Router({ mergeParams: true });
export const guildFollowingRouter = Router({ mergeParams: true });

const followSchema = z.object({
  targetChannelId: z.string().uuid(),
  targetGuildId: z.string().uuid(),
});

// POST /channels/:channelId/followers — follow this channel
channelFollowingRouter.post('/', requireAuth, validate(followSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const sourceChannelId = req.params.channelId as string;
    const { targetChannelId, targetGuildId } = req.body;

    // Verify user is member of target guild (needs permission to create webhook-like follow)
    const [targetMembership] = await db.select({ id: guildMembers.id })
      .from(guildMembers)
      .where(and(eq(guildMembers.guildId, targetGuildId), eq(guildMembers.userId, req.userId!)))
      .limit(1);

    if (!targetMembership) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Not a member of the target guild' });
      return;
    }

    // Verify user is member of source channel's guild
    const [sourceChannel] = await db.select({ guildId: channels.guildId })
      .from(channels).where(eq(channels.id, sourceChannelId)).limit(1);
    if (sourceChannel?.guildId) {
      const [sourceMembership] = await db.select({ id: guildMembers.id }).from(guildMembers)
        .where(and(eq(guildMembers.guildId, sourceChannel.guildId), eq(guildMembers.userId, req.userId!)))
        .limit(1);
      if (!sourceMembership) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'Not a member of the source channel guild' });
        return;
      }
    }

    // Insert follow relationship
    const [follower] = await db.insert(channelFollowers)
      .values({
        sourceChannelId,
        targetChannelId,
      })
      .onConflictDoNothing()
      .returning();

    if (!follower) {
      res.json({ alreadyFollowing: true });
      return;
    }

    res.status(201).json(follower);
  } catch (err) {
    logger.error('[channel-following] POST error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// GET /channels/:channelId/followers — list followers of this channel
channelFollowingRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const sourceChannelId = req.params.channelId as string;

    const followers = await db.select({
      sourceChannelId: channelFollowers.sourceChannelId,
      targetChannelId: channelFollowers.targetChannelId,
      targetChannelName: channels.name,
      targetGuildId: channels.guildId,
      targetGuildName: guilds.name,
    })
      .from(channelFollowers)
      .innerJoin(channels, eq(channelFollowers.targetChannelId, channels.id))
      .leftJoin(guilds, eq(channels.guildId, guilds.id))
      .where(eq(channelFollowers.sourceChannelId, sourceChannelId));

    res.json(followers);
  } catch (err) {
    logger.error('[channel-following] GET followers error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// DELETE /channels/:channelId/followers/:followId — unfollow
channelFollowingRouter.delete('/:followId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const sourceChannelId = req.params.channelId as string;
    const targetChannelId = req.params.followId as string;

    await db.delete(channelFollowers)
      .where(and(
        eq(channelFollowers.sourceChannelId, sourceChannelId),
        eq(channelFollowers.targetChannelId, targetChannelId),
      ));

    res.json({ ok: true });
  } catch (err) {
    logger.error('[channel-following] DELETE error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// GET /guilds/:guildId/following — list all channels this guild follows
guildFollowingRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const guildId = req.params.guildId as string;

    // Verify guild membership
    const [membership] = await db.select({ id: guildMembers.id })
      .from(guildMembers)
      .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, req.userId!)))
      .limit(1);

    if (!membership) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Not a member of this guild' });
      return;
    }

    // Get all target channels in this guild that are following source channels
    const targetChannels = db.select({ id: channels.id })
      .from(channels)
      .where(eq(channels.guildId, guildId))
      .as('target_channels');

    // Source channel alias for join
    const sourceChannels = db.select({
      id: channels.id,
      name: channels.name,
      guildId: channels.guildId,
    }).from(channels).as('source_channels');

    const following = await db.select({
      sourceChannelId: channelFollowers.sourceChannelId,
      sourceChannelName: sourceChannels.name,
      sourceGuildId: sourceChannels.guildId,
      sourceGuildName: guilds.name,
      targetChannelId: channelFollowers.targetChannelId,
      targetChannelName: channels.name,
    })
      .from(channelFollowers)
      .innerJoin(channels, eq(channelFollowers.targetChannelId, channels.id))
      .innerJoin(sourceChannels, eq(channelFollowers.sourceChannelId, sourceChannels.id))
      .leftJoin(guilds, eq(sourceChannels.guildId, guilds.id))
      .where(eq(channels.guildId, guildId));

    res.json(following);
  } catch (err) {
    logger.error('[channel-following] GET following error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});
