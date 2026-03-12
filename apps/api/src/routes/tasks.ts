/**
 * routes/tasks.ts — In-memory Kanban task boards per channel.
 *
 * Mounted at /tasks so endpoints become:
 *   GET    /tasks/channels/:channelId/tasks
 *   POST   /tasks/channels/:channelId/tasks
 *   PATCH  /tasks/channels/:channelId/tasks/:taskId
 *   DELETE /tasks/channels/:channelId/tasks/:taskId
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { db } from '../db';
import { channels, guildMembers } from '../db/schema';
import { eq, and } from 'drizzle-orm';

export const tasksRouter = Router({ mergeParams: true });

// ── Validation ────────────────────────────────────────────────────────────────

const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: z.enum(['todo', 'in_progress', 'done']).default('todo'),
  assigneeId: z.string().uuid().optional(),
  dueDate: z.string().optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  dueDate: z.string().nullable().optional(),
});

// ── In-memory store ───────────────────────────────────────────────────────────

interface Task {
  id: string;
  channelId: string;
  title: string;
  description: string;
  status: string;
  assigneeId: string | null;
  dueDate: string | null;
  createdBy: string;
  createdAt: string;
  position: number;
}

const taskBoards = new Map<string, Task[]>();

// ── Channel access check ──────────────────────────────────────────────────────

async function verifyChannelAccess(channelId: string, userId: string): Promise<void> {
  const [channel] = await db
    .select({ id: channels.id, guildId: channels.guildId })
    .from(channels)
    .where(eq(channels.id, channelId))
    .limit(1);

  if (!channel || !channel.guildId) {
    throw Object.assign(new Error('Channel not found'), { status: 404 });
  }

  const [membership] = await db
    .select({ id: guildMembers.id })
    .from(guildMembers)
    .where(and(eq(guildMembers.guildId, channel.guildId), eq(guildMembers.userId, userId)))
    .limit(1);

  if (!membership) {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

tasksRouter.get(
  '/channels/:channelId/tasks',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const channelId = req.params.channelId as string;
    try {
      await verifyChannelAccess(channelId, req.userId!);
    } catch (e: any) {
      res.status(e.status || 500).json({ code: e.message });
      return;
    }
    const tasks = taskBoards.get(channelId) || [];
    res.json(tasks);
  },
);

tasksRouter.post(
  '/channels/:channelId/tasks',
  requireAuth,
  validate(createTaskSchema),
  async (req: Request, res: Response): Promise<void> => {
    const channelId = req.params.channelId as string;
    try {
      await verifyChannelAccess(channelId, req.userId!);
    } catch (e: any) {
      res.status(e.status || 500).json({ code: e.message });
      return;
    }
    const { title, description, status, assigneeId, dueDate } = req.body;

    const tasks = taskBoards.get(channelId) || [];
    const task: Task = {
      id: crypto.randomUUID(),
      channelId,
      title,
      description: description || '',
      status: status || 'todo',
      assigneeId: assigneeId || null,
      dueDate: dueDate || null,
      createdBy: req.userId!,
      createdAt: new Date().toISOString(),
      position: tasks.filter(t => t.status === (status || 'todo')).length,
    };
    tasks.push(task);
    taskBoards.set(channelId, tasks);
    res.status(201).json(task);
  },
);

tasksRouter.patch(
  '/channels/:channelId/tasks/:taskId',
  requireAuth,
  validate(updateTaskSchema),
  async (req: Request, res: Response): Promise<void> => {
    const { channelId, taskId } = req.params as Record<string, string>;
    try {
      await verifyChannelAccess(channelId, req.userId!);
    } catch (e: any) {
      res.status(e.status || 500).json({ code: e.message });
      return;
    }
    const tasks = taskBoards.get(channelId) || [];
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
      res.status(404).json({ code: 'NOT_FOUND' });
      return;
    }

    const { title, description, status, assigneeId, dueDate } = req.body;
    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (status !== undefined) task.status = status;
    if (assigneeId !== undefined) task.assigneeId = assigneeId;
    if (dueDate !== undefined) task.dueDate = dueDate;

    res.json(task);
  },
);

tasksRouter.delete(
  '/channels/:channelId/tasks/:taskId',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { channelId, taskId } = req.params as Record<string, string>;
    try {
      await verifyChannelAccess(channelId, req.userId!);
    } catch (e: any) {
      res.status(e.status || 500).json({ code: e.message });
      return;
    }
    const tasks = taskBoards.get(channelId) || [];
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx === -1) {
      res.status(404).json({ code: 'NOT_FOUND' });
      return;
    }
    tasks.splice(idx, 1);
    taskBoards.set(channelId, tasks);
    res.json({ code: 'OK' });
  },
);
