import { Router, Request, Response } from 'express';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { db } from '../db/index';
import { messageReactions } from '../db/schema/reactions';
import { messages } from '../db/schema/messages';
import { channels, dmChannelMembers } from '../db/schema/channels';
import { guildMembers } from '../db/schema/guilds';
import { guildEmojis } from '../db/schema/emojis';
import { users } from '../db/schema/users';
import { requireAuth } from '../middleware/auth';
import { getIO } from '../lib/socket-io';
import { incrementChallengeProgress } from './daily-challenges';

export const reactionsRouter = Router({ mergeParams: true });

/** PUT /channels/:channelId/messages/:messageId/reactions/:emoji/@me */
reactionsRouter.put(
  '/:emoji/@me',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { channelId, messageId, emoji } = req.params as Record<string, string>;
    const decodedEmoji = decodeURIComponent(emoji);

    // Verify message exists in channel
    const [msg] = await db.select({ id: messages.id }).from(messages)
      .where(and(eq(messages.id, messageId), eq(messages.channelId, channelId))).limit(1);
    if (!msg) { res.status(404).json({ code: 'NOT_FOUND', message: 'Message not found' }); return; }

    // Add reaction (upsert)
    await db.insert(messageReactions).values({
      messageId,
      userId: req.userId!,
      emoji: decodedEmoji,
    }).onConflictDoNothing();

    try {
      getIO().to(`channel:${channelId}`).emit('MESSAGE_REACTION_ADD', {
        messageId, channelId, userId: req.userId!, emoji: decodedEmoji,
      });
    } catch {}

    // Daily challenge progress (fire-and-forget)
    incrementChallengeProgress(req.userId!, 'react_to_messages');
    incrementChallengeProgress(req.userId!, 'send_reactions');

    res.json({ code: 'OK' });
  },
);

/** DELETE /channels/:channelId/messages/:messageId/reactions/:emoji/@me */
reactionsRouter.delete(
  '/:emoji/@me',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { channelId, messageId, emoji } = req.params as Record<string, string>;
    const decodedEmoji = decodeURIComponent(emoji);

    await db.delete(messageReactions).where(
      and(
        eq(messageReactions.messageId, messageId),
        eq(messageReactions.userId, req.userId!),
        eq(messageReactions.emoji, decodedEmoji),
      ),
    );

    try {
      getIO().to(`channel:${channelId}`).emit('MESSAGE_REACTION_REMOVE', {
        messageId, channelId, userId: req.userId!, emoji: decodedEmoji,
      });
    } catch {}

    res.json({ code: 'OK' });
  },
);

/** GET /channels/:channelId/messages/:messageId/reactions/:emoji — users who reacted with this emoji */
reactionsRouter.get(
  '/:emoji',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { messageId, emoji } = req.params as Record<string, string>;
    const decodedEmoji = decodeURIComponent(emoji);

    const rows = await db
      .select({
        userId: messageReactions.userId,
        username: users.username,
        displayName: users.displayName,
        avatarHash: users.avatarHash,
      })
      .from(messageReactions)
      .innerJoin(users, eq(users.id, messageReactions.userId))
      .where(
        and(
          eq(messageReactions.messageId, messageId),
          eq(messageReactions.emoji, decodedEmoji),
        ),
      );

    res.json(rows.map(r => ({
      id: r.userId,
      username: r.username,
      displayName: r.displayName,
      avatarHash: r.avatarHash,
    })));
  },
);

/** GET /channels/:channelId/messages/:messageId/reactions */
reactionsRouter.get(
  '/',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { channelId, messageId } = req.params as Record<string, string>;

    const reactions = await db.select().from(messageReactions)
      .where(eq(messageReactions.messageId, messageId));

    // Resolve guild for custom emoji lookup
    const [channel] = await db.select({ guildId: channels.guildId }).from(channels)
      .where(eq(channels.id, channelId)).limit(1);
    const guildId = channel?.guildId;

    // Group by emoji
    const grouped: Record<string, { emoji: string; emojiUrl?: string; isCustom: boolean; count: number; userIds: string[]; me: boolean }> = {};
    for (const r of reactions) {
      if (!grouped[r.emoji]) {
        grouped[r.emoji] = { emoji: r.emoji, isCustom: false, count: 0, userIds: [], me: false };
      }
      grouped[r.emoji].count++;
      grouped[r.emoji].userIds.push(r.userId);
      if (r.userId === req.userId) grouped[r.emoji].me = true;
    }

    // Resolve custom emojis (format :name:id:)
    if (guildId) {
      const customEmojiPattern = /^:(.+):(.+):$/;
      const emojiIdsToResolve: string[] = [];
      for (const key of Object.keys(grouped)) {
        const match = key.match(customEmojiPattern);
        if (match) emojiIdsToResolve.push(match[2]);
      }
      if (emojiIdsToResolve.length > 0) {
        const emojiRows = await db.select({ id: guildEmojis.id, imageUrl: guildEmojis.imageUrl })
          .from(guildEmojis)
          .where(eq(guildEmojis.guildId, guildId));
        const emojiMap = new Map(emojiRows.map(e => [e.id, e.imageUrl]));
        for (const key of Object.keys(grouped)) {
          const match = key.match(customEmojiPattern);
          if (match) {
            const url = emojiMap.get(match[2]);
            if (url) {
              grouped[key].isCustom = true;
              grouped[key].emojiUrl = url;
            }
          }
        }
      }
    }

    res.json(Object.values(grouped));
  },
);
