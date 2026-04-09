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
import { channels, guildMembers, kanbanTasks, type KanbanTask } from '../db/schema';
import { eq, and, asc, sql } from 'drizzle-orm';

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

function serializeTask(task: KanbanTask) {
  return {
    ...task,
    createdAt: task.createdAt.toISOString(),
  };
}

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
    const tasks = await db
      .select()
      .from(kanbanTasks)
      .where(eq(kanbanTasks.channelId, channelId))
      .orderBy(asc(kanbanTasks.status), asc(kanbanTasks.position), asc(kanbanTasks.createdAt));
    res.json(tasks.map(serializeTask));
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
    const nextStatus = status || 'todo';

    const [positionRow] = await db
      .select({ maxPosition: sql<number>`coalesce(max(${kanbanTasks.position}), -1)` })
      .from(kanbanTasks)
      .where(and(eq(kanbanTasks.channelId, channelId), eq(kanbanTasks.status, nextStatus)));

    const [task] = await db.insert(kanbanTasks).values({
      channelId,
      title,
      description: description || '',
      status: nextStatus,
      assigneeId: assigneeId || null,
      dueDate: dueDate || null,
      createdBy: req.userId!,
      position: Number(positionRow?.maxPosition ?? -1) + 1,
    }).returning();

    res.status(201).json(serializeTask(task));
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
    const [task] = await db
      .select()
      .from(kanbanTasks)
      .where(and(eq(kanbanTasks.id, taskId), eq(kanbanTasks.channelId, channelId)))
      .limit(1);

    if (!task) {
      res.status(404).json({ code: 'NOT_FOUND' });
      return;
    }

    const { title, description, status, assigneeId, dueDate } = req.body;
    let nextPosition = task.position;

    if (status !== undefined && status !== task.status) {
      const [positionRow] = await db
        .select({ maxPosition: sql<number>`coalesce(max(${kanbanTasks.position}), -1)` })
        .from(kanbanTasks)
        .where(and(eq(kanbanTasks.channelId, channelId), eq(kanbanTasks.status, status)));
      nextPosition = Number(positionRow?.maxPosition ?? -1) + 1;
    }

    const [updatedTask] = await db.update(kanbanTasks).set({
      title: title ?? task.title,
      description: description ?? task.description,
      status: status ?? task.status,
      assigneeId: assigneeId !== undefined ? assigneeId : task.assigneeId,
      dueDate: dueDate !== undefined ? dueDate : task.dueDate,
      position: nextPosition,
    }).where(and(eq(kanbanTasks.id, taskId), eq(kanbanTasks.channelId, channelId)))
      .returning();

    res.json(serializeTask(updatedTask));
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
    const [deletedTask] = await db.delete(kanbanTasks)
      .where(and(eq(kanbanTasks.id, taskId), eq(kanbanTasks.channelId, channelId)))
      .returning({ id: kanbanTasks.id });

    if (!deletedTask) {
      res.status(404).json({ code: 'NOT_FOUND' });
      return;
    }

    res.json({ code: 'OK' });
  },
);
