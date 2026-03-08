import { db } from '../db/index';
import { guildDigestConfig, guildDigests } from '../db/schema/guild-digest';
import { messages } from '../db/schema/messages';
import { channels } from '../db/schema/channels';
import { messageReactions } from '../db/schema/reactions';
import { guildMembers } from '../db/schema/guilds';
import { users } from '../db/schema/users';
import { eq, and, gte, sql } from 'drizzle-orm';

async function generateDigestContent(guildId: string) {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

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

  const newMembers = await db.select({
    userId: guildMembers.userId,
    username: users.username,
    displayName: users.displayName,
    joinedAt: guildMembers.joinedAt,
  })
    .from(guildMembers)
    .innerJoin(users, eq(guildMembers.userId, users.id))
    .where(and(eq(guildMembers.guildId, guildId), gte(guildMembers.joinedAt, oneWeekAgo)));

  const [msgCount] = await db.select({
    count: sql<number>`count(*)::int`,
  })
    .from(messages)
    .innerJoin(channels, eq(messages.channelId, channels.id))
    .where(and(eq(channels.guildId, guildId), gte(messages.createdAt, oneWeekAgo)));

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

export function startGuildDigestJob() {
  // Check once per hour
  setInterval(async () => {
    try {
      const today = new Date().getDay(); // 0=Sunday, 1=Monday, etc.

      const configs = await db.select()
        .from(guildDigestConfig)
        .where(and(
          eq(guildDigestConfig.enabled, true),
          eq(guildDigestConfig.dayOfWeek, today),
        ));

      for (const config of configs) {
        try {
          // Skip if already sent within the last 20 hours
          if (config.lastSentAt) {
            const hoursSince = (Date.now() - new Date(config.lastSentAt).getTime()) / (1000 * 60 * 60);
            if (hoursSince < 20) continue;
          }

          const content = await generateDigestContent(config.guildId);

          // Save digest
          await db.insert(guildDigests).values({
            guildId: config.guildId,
            weekStart: new Date(content.weekStart),
            content,
          });

          // Post to target channel
          if (config.targetChannelId) {
            const summary = [
              `**Weekly Server Digest**`,
              `Messages this week: **${content.messageCount}**`,
              `New members: **${content.newMembers.length}**`,
              content.activeChannels.length > 0
                ? `Most active channel: **#${content.activeChannels[0].channelName}** (${content.activeChannels[0].messageCount} messages)`
                : null,
              content.activeMembers.length > 0
                ? `Most active member: **${content.activeMembers[0].displayName || content.activeMembers[0].username}** (${content.activeMembers[0].messageCount} messages)`
                : null,
            ].filter(Boolean).join('\n');

            await db.insert(messages).values({
              channelId: config.targetChannelId,
              content: summary,
            });
          }

          // Update last sent
          await db.update(guildDigestConfig)
            .set({ lastSentAt: new Date() })
            .where(eq(guildDigestConfig.guildId, config.guildId));

          console.log(`[guildDigest] Generated digest for guild ${config.guildId}`);
        } catch (err) {
          console.error(`[guildDigest] Error generating digest for guild ${config.guildId}:`, err);
        }
      }
    } catch (err) {
      console.error('[guildDigest] Job error:', err);
    }
  }, 60 * 60 * 1000); // Every hour
}
