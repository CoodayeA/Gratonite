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
import { dispatchEvent } from '../lib/webhook-dispatch';
import { messageService, ServiceError } from '../services/message.service';

export const reactionsRouter = Router({ mergeParams: true });

/** PUT /channels/:channelId/messages/:messageId/reactions/:emoji/@me */
reactionsRouter.put(
  '/:emoji/@me',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { channelId, messageId, emoji } = req.params as Record<string, string>;

      await messageService.addReaction(channelId, messageId, req.userId!, emoji);

      res.json({ code: 'OK' });
    } catch (err) {
      if (err instanceof ServiceError) {
        const status = err.code === 'NOT_FOUND' ? 404 : err.code === 'FORBIDDEN' ? 403 : 400;
        res.status(status).json({ code: err.code, message: err.message });
        return;
      }
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

/** DELETE /channels/:channelId/messages/:messageId/reactions/:emoji/@me */
reactionsRouter.delete(
  '/:emoji/@me',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { channelId, messageId, emoji } = req.params as Record<string, string>;

      await messageService.removeReaction(channelId, messageId, req.userId!, emoji);

      res.json({ code: 'OK' });
    } catch (err) {
      if (err instanceof ServiceError) {
        const status = err.code === 'NOT_FOUND' ? 404 : err.code === 'FORBIDDEN' ? 403 : 400;
        res.status(status).json({ code: err.code, message: err.message });
        return;
      }
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
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
