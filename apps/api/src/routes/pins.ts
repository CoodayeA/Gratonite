import { Router, Request, Response } from 'express';
import { eq, and, desc, count } from 'drizzle-orm';
import { db } from '../db/index';
import { channelPins } from '../db/schema/pins';
import { messages } from '../db/schema/messages';
import { users } from '../db/schema/users';
import { requireAuth } from '../middleware/auth';
import { getIO } from '../lib/socket-io';
import { messageService, ServiceError } from '../services/message.service';

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
  try {
    const { channelId, messageId } = req.params as Record<string, string>;

    await messageService.pinMessage(channelId, messageId, req.userId!);

    res.json({ code: 'OK' });
  } catch (err) {
    if (err instanceof ServiceError) {
      const status = err.code === 'NOT_FOUND' ? 404 : err.code === 'MAX_PINS' ? 400 : 400;
      res.status(status).json({ code: err.code, message: err.message });
      return;
    }
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

/** DELETE /channels/:channelId/pins/:messageId */
pinsRouter.delete('/:messageId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelId, messageId } = req.params as Record<string, string>;

    await messageService.unpinMessage(channelId, messageId);

    res.json({ code: 'OK' });
  } catch (err) {
    if (err instanceof ServiceError) {
      res.status(400).json({ code: err.code, message: err.message });
      return;
    }
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});
