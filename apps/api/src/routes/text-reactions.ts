import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db/index';
import { textReactions, textReactionStats } from '../db/schema/text-reactions';
import { messages } from '../db/schema/messages';
import { channels } from '../db/schema/channels';
import { users } from '../db/schema/users';
import { requireAuth } from '../middleware/auth';

export const textReactionsRouter = Router({ mergeParams: true });
export const textReactionPopularRouter = Router({ mergeParams: true });

/** POST /channels/:channelId/messages/:messageId/text-reactions — add text reaction */
textReactionsRouter.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { channelId, messageId } = req.params as Record<string, string>;
    const { text } = req.body as { text: string };

    if (!text || text.length > 20) {
      res.status(400).json({ code: 'BAD_REQUEST', message: 'text is required and must be 20 characters or fewer'  });
      return;
    }

    const trimmed = text.trim();
    if (!trimmed) {
      res.status(400).json({ code: 'BAD_REQUEST', message: 'text cannot be empty'  });
      return;
    }

    // Verify message exists in this channel
    const [msg] = await db.select({ id: messages.id })
      .from(messages)
      .where(and(eq(messages.id, messageId), eq(messages.channelId, channelId)))
      .limit(1);

    if (!msg) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Message not found'  });
      return;
    }

    // Insert text reaction
    const [reaction] = await db.insert(textReactions).values({
      messageId,
      userId,
      textContent: trimmed,
    }).onConflictDoNothing().returning();

    if (!reaction) {
      res.status(409).json({ code: 'CONFLICT', message: 'You already added this text reaction'  });
      return;
    }

    // Increment stats for the guild
    const [channel] = await db.select({ guildId: channels.guildId })
      .from(channels)
      .where(eq(channels.id, channelId))
      .limit(1);

    if (channel?.guildId) {
      await db.insert(textReactionStats).values({
        guildId: channel.guildId,
        text: trimmed,
        useCount: 1,
      }).onConflictDoUpdate({
        target: [textReactionStats.guildId, textReactionStats.text],
        set: { useCount: sql`${textReactionStats.useCount} + 1` },
      });
    }

    res.status(201).json(reaction);
  } catch (err) {
    logger.error('[text-reactions] POST error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error'  });
  }
});

/** DELETE /channels/:channelId/messages/:messageId/text-reactions/:text — remove text reaction */
textReactionsRouter.delete('/:text', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { messageId, text: reactionText } = req.params as Record<string, string>;

    const decoded = decodeURIComponent(reactionText);

    const [deleted] = await db.delete(textReactions)
      .where(and(
        eq(textReactions.messageId, messageId),
        eq(textReactions.userId, userId),
        eq(textReactions.textContent, decoded),
      ))
      .returning();

    if (!deleted) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Text reaction not found'  });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    logger.error('[text-reactions] DELETE error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error'  });
  }
});

/** GET /channels/:channelId/messages/:messageId/text-reactions — get text reactions for a message */
textReactionsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { messageId } = req.params as Record<string, string>;

    const rows = await db.select({
      textContent: textReactions.textContent,
      userId: textReactions.userId,
      username: users.username,
      displayName: users.displayName,
    })
      .from(textReactions)
      .innerJoin(users, eq(users.id, textReactions.userId))
      .where(eq(textReactions.messageId, messageId));

    // Group by text
    const grouped: Record<string, { text: string; count: number; users: Array<{ id: string; username: string; displayName: string }> }> = {};
    for (const r of rows) {
      if (!grouped[r.textContent]) {
        grouped[r.textContent] = { text: r.textContent, count: 0, users: [] };
      }
      grouped[r.textContent].count++;
      grouped[r.textContent].users.push({ id: r.userId, username: r.username, displayName: r.displayName });
    }

    res.json(Object.values(grouped));
  } catch (err) {
    logger.error('[text-reactions] GET error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error'  });
  }
});

/** GET /guilds/:guildId/text-reactions/popular — top 10 most-used text reactions */
textReactionPopularRouter.get('/popular', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params as Record<string, string>;

    const rows = await db.select()
      .from(textReactionStats)
      .where(eq(textReactionStats.guildId, guildId))
      .orderBy(desc(textReactionStats.useCount))
      .limit(10);

    res.json(rows);
  } catch (err) {
    logger.error('[text-reactions] GET popular error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error'  });
  }
});
