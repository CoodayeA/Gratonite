import { Router, Request, Response } from 'express';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/index';
import { messageReactions } from '../db/schema/reactions';
import { messages } from '../db/schema/messages';
import { channels, dmChannelMembers } from '../db/schema/channels';
import { guildMembers } from '../db/schema/guilds';
import { requireAuth } from '../middleware/auth';
import { getIO } from '../lib/socket-io';

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

/** GET /channels/:channelId/messages/:messageId/reactions */
reactionsRouter.get(
  '/',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { channelId, messageId } = req.params as Record<string, string>;

    const reactions = await db.select().from(messageReactions)
      .where(eq(messageReactions.messageId, messageId));

    // Group by emoji
    const grouped: Record<string, { emoji: string; count: number; userIds: string[]; me: boolean }> = {};
    for (const r of reactions) {
      if (!grouped[r.emoji]) {
        grouped[r.emoji] = { emoji: r.emoji, count: 0, userIds: [], me: false };
      }
      grouped[r.emoji].count++;
      grouped[r.emoji].userIds.push(r.userId);
      if (r.userId === req.userId) grouped[r.emoji].me = true;
    }

    res.json(Object.values(grouped));
  },
);
