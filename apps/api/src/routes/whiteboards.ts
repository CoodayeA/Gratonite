import { Router, Request, Response } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/index';
import { whiteboards } from '../db/schema/whiteboards';
import { guildMembers } from '../db/schema/guilds';
import { channels } from '../db/schema/channels';
import { Permissions } from '../db/schema/roles';
import { requireAuth } from '../middleware/auth';
import { hasPermission } from './roles';

export const whiteboardsRouter = Router({ mergeParams: true });

/** GET /channels/:channelId/whiteboards — list boards */
whiteboardsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const channelId = req.params.channelId as string;

  const [channel] = await db.select({ id: channels.id, guildId: channels.guildId }).from(channels)
    .where(eq(channels.id, channelId)).limit(1);
  if (!channel || !channel.guildId) { res.status(404).json({ code: 'NOT_FOUND' }); return; }

  const [member] = await db.select({ id: guildMembers.id }).from(guildMembers)
    .where(and(eq(guildMembers.guildId, channel.guildId), eq(guildMembers.userId, req.userId!))).limit(1);
  if (!member) { res.status(403).json({ code: 'FORBIDDEN' }); return; }

  const rows = await db.select({
    id: whiteboards.id,
    name: whiteboards.name,
    createdBy: whiteboards.createdBy,
    createdAt: whiteboards.createdAt,
    updatedAt: whiteboards.updatedAt,
  }).from(whiteboards)
    .where(eq(whiteboards.channelId, channelId))
    .orderBy(desc(whiteboards.updatedAt));

  res.json(rows);
});

/** POST /channels/:channelId/whiteboards — create board */
whiteboardsRouter.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const channelId = req.params.channelId as string;

  const [channel] = await db.select({ id: channels.id, guildId: channels.guildId }).from(channels)
    .where(eq(channels.id, channelId)).limit(1);
  if (!channel || !channel.guildId) { res.status(404).json({ code: 'NOT_FOUND' }); return; }

  const [member] = await db.select({ id: guildMembers.id }).from(guildMembers)
    .where(and(eq(guildMembers.guildId, channel.guildId), eq(guildMembers.userId, req.userId!))).limit(1);
  if (!member) { res.status(403).json({ code: 'FORBIDDEN' }); return; }

  const { name } = req.body;

  const [board] = await db.insert(whiteboards).values({
    channelId,
    guildId: channel.guildId,
    name: name || 'Untitled Board',
    createdBy: req.userId!,
  }).returning();

  res.status(201).json(board);
});

/** GET /channels/:channelId/whiteboards/:id — get board data */
whiteboardsRouter.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const boardId = req.params.id as string;
  const channelId = req.params.channelId as string;

  const [board] = await db.select().from(whiteboards)
    .where(and(eq(whiteboards.id, boardId), eq(whiteboards.channelId, channelId))).limit(1);
  if (!board) { res.status(404).json({ code: 'NOT_FOUND' }); return; }

  const [member] = await db.select({ id: guildMembers.id }).from(guildMembers)
    .where(and(eq(guildMembers.guildId, board.guildId), eq(guildMembers.userId, req.userId!))).limit(1);
  if (!member) { res.status(403).json({ code: 'FORBIDDEN' }); return; }

  res.json(board);
});

/** PUT /channels/:channelId/whiteboards/:id — save board data */
whiteboardsRouter.put('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const boardId = req.params.id as string;
  const channelId = req.params.channelId as string;

  const [board] = await db.select().from(whiteboards)
    .where(and(eq(whiteboards.id, boardId), eq(whiteboards.channelId, channelId))).limit(1);
  if (!board) { res.status(404).json({ code: 'NOT_FOUND' }); return; }

  const [member] = await db.select({ id: guildMembers.id }).from(guildMembers)
    .where(and(eq(guildMembers.guildId, board.guildId), eq(guildMembers.userId, req.userId!))).limit(1);
  if (!member) { res.status(403).json({ code: 'FORBIDDEN' }); return; }

  const { data, name } = req.body;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (data !== undefined) updates.data = data;
  if (name !== undefined) updates.name = name;

  const [updated] = await db.update(whiteboards).set(updates)
    .where(eq(whiteboards.id, boardId)).returning();

  res.json(updated);
});

/** DELETE /channels/:channelId/whiteboards/:id — delete board */
whiteboardsRouter.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const boardId = req.params.id as string;
  const channelId = req.params.channelId as string;

  const [board] = await db.select().from(whiteboards)
    .where(and(eq(whiteboards.id, boardId), eq(whiteboards.channelId, channelId))).limit(1);
  if (!board) { res.status(404).json({ code: 'NOT_FOUND' }); return; }

  if (!(await hasPermission(req.userId!, board.guildId, Permissions.MANAGE_CHANNELS))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_CHANNELS permission' }); return;
  }

  await db.delete(whiteboards).where(eq(whiteboards.id, boardId));
  res.json({ ok: true });
});
