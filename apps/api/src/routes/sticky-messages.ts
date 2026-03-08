import { Router, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index';
import { stickyMessages } from '../db/schema/sticky-messages';
import { channels } from '../db/schema/channels';
import { users } from '../db/schema/users';
import { Permissions } from '../db/schema/roles';
import { requireAuth } from '../middleware/auth';
import { hasPermission } from './roles';

export const stickyMessagesRouter = Router({ mergeParams: true });

// GET /channels/:channelId/sticky — get sticky for channel
stickyMessagesRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { channelId } = req.params as Record<string, string>;

  const [sticky] = await db.select({
    channelId: stickyMessages.channelId,
    messageId: stickyMessages.messageId,
    content: stickyMessages.content,
    setBy: stickyMessages.setBy,
    setAt: stickyMessages.setAt,
    setByUsername: users.username,
    setByDisplayName: users.displayName,
  })
    .from(stickyMessages)
    .leftJoin(users, eq(stickyMessages.setBy, users.id))
    .where(eq(stickyMessages.channelId, channelId))
    .limit(1);

  if (!sticky) {
    res.json(null);
    return;
  }

  res.json(sticky);
});

// POST /channels/:channelId/sticky — set sticky
stickyMessagesRouter.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { channelId } = req.params as Record<string, string>;

  // Look up channel's guildId from the database to enforce permissions
  const [channel] = await db.select({ guildId: channels.guildId }).from(channels).where(eq(channels.id, channelId)).limit(1);
  if (channel?.guildId && !(await hasPermission(req.userId!, channel.guildId, Permissions.MANAGE_MESSAGES))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_MESSAGES permission' });
    return;
  }

  const { content } = req.body as { content: string };
  if (!content) {
    res.status(400).json({ error: 'content is required' });
    return;
  }

  const [sticky] = await db.insert(stickyMessages).values({
    channelId,
    content,
    setBy: req.userId!,
    setAt: new Date(),
  }).onConflictDoUpdate({
    target: stickyMessages.channelId,
    set: { content, setBy: req.userId!, setAt: new Date() },
  }).returning();

  res.status(201).json(sticky);
});

// DELETE /channels/:channelId/sticky — remove sticky
stickyMessagesRouter.delete('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { channelId } = req.params as Record<string, string>;

  const [channel] = await db.select({ guildId: channels.guildId }).from(channels).where(eq(channels.id, channelId)).limit(1);
  if (channel?.guildId && !(await hasPermission(req.userId!, channel.guildId, Permissions.MANAGE_MESSAGES))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_MESSAGES permission' });
    return;
  }

  await db.delete(stickyMessages).where(eq(stickyMessages.channelId, channelId));
  res.json({ code: 'OK', message: 'Sticky message removed' });
});
