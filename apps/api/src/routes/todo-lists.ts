/**
 * routes/todo-lists.ts — Shared to-do checklists in channels.
 * Mounted at /channels/:channelId/todos
 */
import { Router, Request, Response } from 'express';
import { eq, and, asc, desc } from 'drizzle-orm';
import { db } from '../db/index';
import { todoLists, todoItems } from '../db/schema/todo-lists';
import { channels, guildMembers } from '../db/schema';
import { requireAuth } from '../middleware/auth';

export const todoListsRouter = Router({ mergeParams: true });

async function verifyChannelMembership(channelId: string, userId: string) {
  const [ch] = await db.select({ guildId: channels.guildId }).from(channels)
    .where(eq(channels.id, channelId)).limit(1);
  if (!ch?.guildId) return false;
  const [m] = await db.select({ id: guildMembers.id }).from(guildMembers)
    .where(and(eq(guildMembers.guildId, ch.guildId), eq(guildMembers.userId, userId))).limit(1);
  return !!m;
}

// GET / — list todo lists for channel
todoListsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const channelId = req.params.channelId as string;
  if (!(await verifyChannelMembership(channelId, req.userId!))) { res.status(403).json({ code: 'FORBIDDEN' }); return; }

  const lists = await db.select().from(todoLists)
    .where(eq(todoLists.channelId, channelId))
    .orderBy(desc(todoLists.createdAt));

  res.json(lists);
});

// POST / — create a todo list
todoListsRouter.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const channelId = req.params.channelId as string;
  if (!(await verifyChannelMembership(channelId, req.userId!))) { res.status(403).json({ code: 'FORBIDDEN' }); return; }

  const { title } = req.body;
  if (!title) { res.status(400).json({ code: 'BAD_REQUEST', message: 'title required' }); return; }

  const [list] = await db.insert(todoLists).values({
    channelId,
    title: String(title).slice(0, 200),
    createdBy: req.userId!,
  }).returning();

  res.status(201).json(list);
});

// GET /:listId/items — get items
todoListsRouter.get('/:listId/items', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { listId } = req.params as Record<string, string>;
  const items = await db.select().from(todoItems)
    .where(eq(todoItems.listId, listId))
    .orderBy(asc(todoItems.position));
  res.json(items);
});

// POST /:listId/items — add item
todoListsRouter.post('/:listId/items', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { listId } = req.params as Record<string, string>;
  const { text, assigneeId } = req.body;
  if (!text) { res.status(400).json({ code: 'BAD_REQUEST', message: 'text required' }); return; }

  const existing = await db.select().from(todoItems).where(eq(todoItems.listId, listId));

  const [item] = await db.insert(todoItems).values({
    listId,
    text: String(text).slice(0, 500),
    assigneeId: assigneeId || null,
    position: existing.length,
    createdBy: req.userId!,
  }).returning();

  res.status(201).json(item);
});

// PATCH /:listId/items/:itemId — update item (toggle complete, reassign, etc)
todoListsRouter.patch('/:listId/items/:itemId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { itemId } = req.params as Record<string, string>;
  const { text, completed, assigneeId, position } = req.body;

  const updates: Record<string, unknown> = {};
  if (text !== undefined) updates.text = String(text).slice(0, 500);
  if (completed !== undefined) updates.completed = !!completed;
  if (assigneeId !== undefined) updates.assigneeId = assigneeId || null;
  if (position !== undefined) updates.position = position;

  const [updated] = await db.update(todoItems).set(updates)
    .where(eq(todoItems.id, itemId)).returning();
  if (!updated) { res.status(404).json({ code: 'NOT_FOUND' }); return; }

  res.json(updated);
});

// DELETE /:listId/items/:itemId
todoListsRouter.delete('/:listId/items/:itemId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { itemId } = req.params as Record<string, string>;
  await db.delete(todoItems).where(eq(todoItems.id, itemId));
  res.json({ ok: true });
});

// DELETE /:listId
todoListsRouter.delete('/:listId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { listId } = req.params as Record<string, string>;
  await db.delete(todoLists).where(eq(todoLists.id, listId));
  res.json({ ok: true });
});
