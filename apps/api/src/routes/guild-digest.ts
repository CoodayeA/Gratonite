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

export const guildDigestRouter = Router({ mergeParams: true });

// Generate digest content for a guild
async function generateDigestContent(guildId: string) {
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

  return {
    topMessages,
    newMembers,
    messageCount: msgCount?.count || 0,
    activeChannels,
    activeMembers,
    weekStart: oneWeekAgo.toISOString(),
    generatedAt: new Date().toISOString(),
  };
}

// GET /guilds/:guildId/digest/config
guildDigestRouter.get('/config', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const guildId = req.params.guildId as string;
    const [config] = await db.select().from(guildDigestConfig)
      .where(eq(guildDigestConfig.guildId, guildId)).limit(1);
    res.json(config || { guildId, targetChannelId: null, enabled: false, sections: ['top_messages', 'new_members', 'message_count', 'active_channels', 'active_members'], dayOfWeek: 1, lastSentAt: null });
  } catch (err) {
    console.error('[guild-digest] GET config error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// PUT /guilds/:guildId/digest/config
guildDigestRouter.put('/config', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const guildId = req.params.guildId as string;
    if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission' });
      return;
    }

    const { targetChannelId, enabled, sections, dayOfWeek } = req.body;

    const [upserted] = await db.insert(guildDigestConfig)
      .values({
        guildId,
        targetChannelId: targetChannelId || null,
        enabled: enabled ?? false,
        sections: Array.isArray(sections) ? sections : ['top_messages', 'new_members', 'message_count', 'active_channels', 'active_members'],
        dayOfWeek: dayOfWeek ?? 1,
      })
      .onConflictDoUpdate({
        target: guildDigestConfig.guildId,
        set: {
          targetChannelId: targetChannelId || null,
          enabled: enabled ?? false,
          sections: Array.isArray(sections) ? sections : ['top_messages', 'new_members', 'message_count', 'active_channels', 'active_members'],
          dayOfWeek: dayOfWeek ?? 1,
        },
      })
      .returning();

    res.json(upserted);
  } catch (err) {
    console.error('[guild-digest] PUT config error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// GET /guilds/:guildId/digest/preview
guildDigestRouter.get('/preview', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const guildId = req.params.guildId as string;
    const content = await generateDigestContent(guildId);
    res.json(content);
  } catch (err) {
    console.error('[guild-digest] GET preview error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// GET /guilds/:guildId/digests — list past digests
guildDigestRouter.get('/history', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const guildId = req.params.guildId as string;
    const rows = await db.select()
      .from(guildDigests)
      .where(eq(guildDigests.guildId, guildId))
      .orderBy(desc(guildDigests.createdAt))
      .limit(20);
    res.json(rows);
  } catch (err) {
    console.error('[guild-digest] GET history error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// Export for use in job
export { generateDigestContent };
