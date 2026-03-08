import { Router, Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index';
import { moodBoardItems } from '../db/schema/mood-boards';
import { guildMembers } from '../db/schema/guilds';
import { channels } from '../db/schema/channels';
import { Permissions } from '../db/schema/roles';
import { requireAuth } from '../middleware/auth';
import { hasPermission } from './roles';

export const moodBoardsRouter = Router({ mergeParams: true });

/** GET /channels/:channelId/mood-board — get all items */
moodBoardsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const channelId = req.params.channelId as string;

  const [channel] = await db.select({ id: channels.id, guildId: channels.guildId }).from(channels)
    .where(eq(channels.id, channelId)).limit(1);
  if (!channel || !channel.guildId) { res.status(404).json({ code: 'NOT_FOUND' }); return; }

  const [member] = await db.select({ id: guildMembers.id }).from(guildMembers)
    .where(and(eq(guildMembers.guildId, channel.guildId), eq(guildMembers.userId, req.userId!))).limit(1);
  if (!member) { res.status(403).json({ code: 'FORBIDDEN' }); return; }

  const rows = await db.select().from(moodBoardItems).where(eq(moodBoardItems.channelId, channelId));
  res.json(rows);
});

/** POST /channels/:channelId/mood-board — add item */
moodBoardsRouter.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const channelId = req.params.channelId as string;

  const [channel] = await db.select({ id: channels.id, guildId: channels.guildId }).from(channels)
    .where(eq(channels.id, channelId)).limit(1);
  if (!channel || !channel.guildId) { res.status(404).json({ code: 'NOT_FOUND' }); return; }

  const [member] = await db.select({ id: guildMembers.id }).from(guildMembers)
    .where(and(eq(guildMembers.guildId, channel.guildId), eq(guildMembers.userId, req.userId!))).limit(1);
  if (!member) { res.status(403).json({ code: 'FORBIDDEN' }); return; }

  const { itemType, content, position } = req.body;
  if (!itemType || !content) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'itemType and content are required' }); return;
  }

  const validTypes = ['image', 'color', 'text', 'link'];
  if (!validTypes.includes(itemType)) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'Invalid itemType' }); return;
  }

  const [item] = await db.insert(moodBoardItems).values({
    channelId,
    guildId: channel.guildId,
    itemType,
    content,
    position: position || { x: 0, y: 0, w: 200, h: 200 },
    addedBy: req.userId!,
  }).returning();

  res.status(201).json(item);
});

/** PATCH /channels/:channelId/mood-board/:id — update item */
moodBoardsRouter.patch('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const itemId = req.params.id as string;
  const channelId = req.params.channelId as string;

  const [item] = await db.select().from(moodBoardItems)
    .where(and(eq(moodBoardItems.id, itemId), eq(moodBoardItems.channelId, channelId))).limit(1);
  if (!item) { res.status(404).json({ code: 'NOT_FOUND' }); return; }

  const [member] = await db.select({ id: guildMembers.id }).from(guildMembers)
    .where(and(eq(guildMembers.guildId, item.guildId), eq(guildMembers.userId, req.userId!))).limit(1);
  if (!member) { res.status(403).json({ code: 'FORBIDDEN' }); return; }

  const { content, position } = req.body;
  const updates: Record<string, unknown> = {};
  if (content !== undefined) updates.content = content;
  if (position !== undefined) updates.position = position;

  if (Object.keys(updates).length === 0) {
    res.json(item); return;
  }

  const [updated] = await db.update(moodBoardItems).set(updates)
    .where(eq(moodBoardItems.id, itemId)).returning();

  res.json(updated);
});

/** DELETE /channels/:channelId/mood-board/:id — remove item */
moodBoardsRouter.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const itemId = req.params.id as string;
  const channelId = req.params.channelId as string;

  const [item] = await db.select().from(moodBoardItems)
    .where(and(eq(moodBoardItems.id, itemId), eq(moodBoardItems.channelId, channelId))).limit(1);
  if (!item) { res.status(404).json({ code: 'NOT_FOUND' }); return; }

  // Owner or MANAGE_CHANNELS can delete
  if (item.addedBy !== req.userId!) {
    if (!(await hasPermission(req.userId!, item.guildId, Permissions.MANAGE_CHANNELS))) {
      res.status(403).json({ code: 'FORBIDDEN' }); return;
    }
  }

  await db.delete(moodBoardItems).where(eq(moodBoardItems.id, itemId));
  res.json({ ok: true });
});
