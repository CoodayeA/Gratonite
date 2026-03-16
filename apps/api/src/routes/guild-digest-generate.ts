/**
 * routes/guild-digest-generate.ts — Manual digest generation trigger.
 * Mounted at /guilds/:guildId/digest
 */
import { Router, Request, Response } from 'express';
import { eq, and, gte, desc, sql } from 'drizzle-orm';
import { db } from '../db/index';
import { guildDigestConfig, guildDigests } from '../db/schema/guild-digest';
import { messages } from '../db/schema/messages';
import { channels } from '../db/schema/channels';
import { messageReactions } from '../db/schema/reactions';
import { guildMembers } from '../db/schema/guilds';
import { users } from '../db/schema/users';
import { Permissions } from '../db/schema/roles';
import { requireAuth } from '../middleware/auth';
import { hasPermission } from './roles';
import { getIO } from '../lib/socket-io';
import { logger } from '../lib/logger';

export const guildDigestGenerateRouter = Router({ mergeParams: true });

// POST /guilds/:guildId/digest/generate-now — manually trigger digest generation
guildDigestGenerateRouter.post('/generate-now', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const guildId = req.params.guildId as string;

    if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission' });
      return;
    }

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // Top 5 most-reacted messages
    const topMessages = await db.select({
      messageId: messages.id,
      content: messages.content,
      authorId: messages.authorId,
      channelId: messages.channelId,
      createdAt: messages.createdAt,
      reactionCount: sql<number>`count(${messageReactions.id})::int`,
    })
      .from(messages)
      .innerJoin(channels, eq(messages.channelId, channels.id))
      .leftJoin(messageReactions, eq(messageReactions.messageId, messages.id))
      .where(and(eq(channels.guildId, guildId), gte(messages.createdAt, oneWeekAgo)))
      .groupBy(messages.id)
      .orderBy(sql`count(${messageReactions.id}) DESC`)
      .limit(5);

    // New members this week
    const newMembers = await db.select({
      userId: guildMembers.userId,
      username: users.username,
      displayName: users.displayName,
      joinedAt: guildMembers.joinedAt,
    })
      .from(guildMembers)
      .innerJoin(users, eq(guildMembers.userId, users.id))
      .where(and(eq(guildMembers.guildId, guildId), gte(guildMembers.joinedAt, oneWeekAgo)));

    // Total messages this week
    const [msgCount] = await db.select({
      count: sql<number>`count(*)::int`,
    })
      .from(messages)
      .innerJoin(channels, eq(messages.channelId, channels.id))
      .where(and(eq(channels.guildId, guildId), gte(messages.createdAt, oneWeekAgo)));

    // Most active channels
    const activeChannels = await db.select({
      channelId: channels.id,
      channelName: channels.name,
      messageCount: sql<number>`count(${messages.id})::int`,
    })
      .from(messages)
      .innerJoin(channels, eq(messages.channelId, channels.id))
      .where(and(eq(channels.guildId, guildId), gte(messages.createdAt, oneWeekAgo)))
      .groupBy(channels.id, channels.name)
      .orderBy(sql`count(${messages.id}) DESC`)
      .limit(5);

    // Most active threads (channels with parentId set = threads)
    const activeThreads = await db.select({
      channelId: channels.id,
      channelName: channels.name,
      messageCount: sql<number>`count(${messages.id})::int`,
    })
      .from(messages)
      .innerJoin(channels, eq(messages.channelId, channels.id))
      .where(and(
        eq(channels.guildId, guildId),
        gte(messages.createdAt, oneWeekAgo),
        sql`${channels.parentId} IS NOT NULL`,
      ))
      .groupBy(channels.id, channels.name)
      .orderBy(sql`count(${messages.id}) DESC`)
      .limit(5);

    // Most active members
    const activeMembers = await db.select({
      userId: messages.authorId,
      username: users.username,
      displayName: users.displayName,
      messageCount: sql<number>`count(${messages.id})::int`,
    })
      .from(messages)
      .innerJoin(channels, eq(messages.channelId, channels.id))
      .leftJoin(users, eq(messages.authorId, users.id))
      .where(and(eq(channels.guildId, guildId), gte(messages.createdAt, oneWeekAgo)))
      .groupBy(messages.authorId, users.username, users.displayName)
      .orderBy(sql`count(${messages.id}) DESC`)
      .limit(5);

    const content = {
      topMessages,
      newMembers,
      messageCount: msgCount?.count || 0,
      activeChannels,
      activeThreads,
      activeMembers,
      weekStart: oneWeekAgo.toISOString(),
      generatedAt: new Date().toISOString(),
    };

    // Store digest
    const [digest] = await db.insert(guildDigests).values({
      guildId,
      weekStart: oneWeekAgo,
      content,
    }).returning();

    // Update lastSentAt on config
    await db.update(guildDigestConfig)
      .set({ lastSentAt: new Date() })
      .where(eq(guildDigestConfig.guildId, guildId));

    // Optionally post to configured target channel
    const [config] = await db.select()
      .from(guildDigestConfig)
      .where(eq(guildDigestConfig.guildId, guildId))
      .limit(1);

    if (config?.targetChannelId) {
      // Insert digest as a system message in the target channel
      await db.insert(messages).values({
        channelId: config.targetChannelId,
        authorId: req.userId!,
        content: `**Weekly Server Digest** (${new Date().toLocaleDateString()})\n\n` +
          `Messages this week: **${content.messageCount}**\n` +
          `New members: **${content.newMembers.length}**\n` +
          `Most active channel: **${content.activeChannels[0]?.channelName || 'N/A'}**\n\n` +
          `View the full digest in Server Settings > Digest.`,
      });

      getIO().to(`channel:${config.targetChannelId}`).emit('DIGEST_POSTED', {
        guildId,
        digestId: digest.id,
        channelId: config.targetChannelId,
      });
    }

    res.status(201).json(digest);
  } catch (err) {
    logger.error('[guild-digest-generate] POST generate-now error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});
