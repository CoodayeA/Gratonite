import { Router, Request, Response } from 'express';
import { eq, and, desc, count } from 'drizzle-orm';
import { db } from '../db/index';
import { channelPins } from '../db/schema/pins';
import { messages } from '../db/schema/messages';
import { users } from '../db/schema/users';
import { requireAuth } from '../middleware/auth';
import { getIO } from '../lib/socket-io';

export const pinsRouter = Router({ mergeParams: true });

/** GET /channels/:channelId/pins */
pinsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { channelId } = req.params as Record<string, string>;

  const pins = await db
    .select({
      pinId: channelPins.id,
      pinnedAt: channelPins.pinnedAt,
      pinnedBy: channelPins.pinnedBy,
      messageId: messages.id,
      channelId: messages.channelId,
      content: messages.content,
      attachments: messages.attachments,
      authorId: messages.authorId,
      createdAt: messages.createdAt,
      authorUsername: users.username,
      authorDisplayName: users.displayName,
      authorAvatarHash: users.avatarHash,
    })
    .from(channelPins)
    .innerJoin(messages, eq(messages.id, channelPins.messageId))
    .leftJoin(users, eq(users.id, messages.authorId))
    .where(eq(channelPins.channelId, channelId))
    .orderBy(desc(channelPins.pinnedAt));

  res.json(pins.map(p => ({
    id: p.messageId,
    channelId: p.channelId,
    content: p.content,
    attachments: p.attachments,
    authorId: p.authorId,
    createdAt: p.createdAt,
    pinnedAt: p.pinnedAt,
    pinnedBy: p.pinnedBy,
    author: p.authorId ? {
      id: p.authorId,
      username: p.authorUsername,
      displayName: p.authorDisplayName,
      avatarHash: p.authorAvatarHash,
    } : null,
  })));
});

/** PUT /channels/:channelId/pins/:messageId */
pinsRouter.put('/:messageId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { channelId, messageId } = req.params as Record<string, string>;

  // Verify message exists in channel
  const [msg] = await db.select({ id: messages.id }).from(messages)
    .where(and(eq(messages.id, messageId), eq(messages.channelId, channelId))).limit(1);
  if (!msg) { res.status(404).json({ code: 'NOT_FOUND', message: 'Message not found' }); return; }

  // Check max 50 pins
  const [{ pinCount }] = await db.select({ pinCount: count() }).from(channelPins).where(eq(channelPins.channelId, channelId));
  if (pinCount >= 50) { res.status(400).json({ code: 'MAX_PINS', message: 'Maximum 50 pins per channel' }); return; }

  await db.insert(channelPins).values({
    channelId,
    messageId,
    pinnedBy: req.userId!,
  }).onConflictDoNothing();

  try {
    getIO().to(`channel:${channelId}`).emit('CHANNEL_PINS_UPDATE', { channelId, messageId, pinned: true });
  } catch {}

  res.json({ code: 'OK' });
});

/** DELETE /channels/:channelId/pins/:messageId */
pinsRouter.delete('/:messageId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { channelId, messageId } = req.params as Record<string, string>;

  await db.delete(channelPins).where(
    and(eq(channelPins.channelId, channelId), eq(channelPins.messageId, messageId)),
  );

  try {
    getIO().to(`channel:${channelId}`).emit('CHANNEL_PINS_UPDATE', { channelId, messageId, pinned: false });
  } catch {}

  res.json({ code: 'OK' });
});
