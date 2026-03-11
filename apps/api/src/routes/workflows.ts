/**
 * routes/workflows.ts — Workflow / Flow Automation API endpoints.
 *
 * Mounted at /api/v1/guilds by src/routes/index.ts.
 *
 * Endpoints (all owner-only):
 *   GET    /guilds/:guildId/workflows                  — list workflows
 *   POST   /guilds/:guildId/workflows                  — create workflow
 *   PATCH  /guilds/:guildId/workflows/:workflowId      — update workflow
 *   DELETE /guilds/:guildId/workflows/:workflowId      — delete workflow
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';

import { db } from '../db/index';
import { guilds } from '../db/schema/guilds';
import { workflows, workflowTriggers, workflowActions } from '../db/schema/workflows';
import { requireAuth } from '../middleware/auth';
import { AppError, handleAppError } from '../lib/errors.js';

export const workflowsRouter = Router();

// ---------------------------------------------------------------------------
// Helper: require guild ownership
// ---------------------------------------------------------------------------

async function requireGuildOwner(guildId: string, userId: string): Promise<void> {
  const [guild] = await db
    .select({ ownerId: guilds.ownerId })
    .from(guilds)
    .where(eq(guilds.id, guildId))
    .limit(1);

  if (!guild) {
    throw new AppError(404, 'Guild not found', 'NOT_FOUND');
  }
  if (guild.ownerId !== userId) {
    throw new AppError(403, 'Only the guild owner can manage workflows', 'FORBIDDEN');
  }
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const triggerSchema = z.object({
  type: z.string().min(1),
  config: z.record(z.string(), z.any()).optional(),
});

const actionSchema = z.object({
  order: z.number().int(),
  type: z.string().min(1),
  config: z.record(z.string(), z.any()).optional(),
});

const createWorkflowSchema = z.object({
  name: z.string().min(1).max(100),
  triggers: z.array(triggerSchema),
  actions: z.array(actionSchema),
});

const updateWorkflowSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  enabled: z.boolean().optional(),
  triggers: z.array(triggerSchema).optional(),
  actions: z.array(actionSchema).optional(),
});

// ---------------------------------------------------------------------------
// GET /guilds/:guildId/workflows
// ---------------------------------------------------------------------------

workflowsRouter.get(
  '/:guildId/workflows',
  requireAuth,
  async (req: Request, res: Response) => {
    const { guildId } = req.params as Record<string, string>;
    const userId = req.userId!;

    try {
      await requireGuildOwner(guildId, userId);

      const workflowList = await db
        .select()
        .from(workflows)
        .where(eq(workflows.guildId, guildId));

      // Fetch triggers and actions for each workflow
      const results = await Promise.all(
        workflowList.map(async (wf) => {
          const triggers = await db
            .select()
            .from(workflowTriggers)
            .where(eq(workflowTriggers.workflowId, wf.id));

          const actions = await db
            .select()
            .from(workflowActions)
            .where(eq(workflowActions.workflowId, wf.id))
            .orderBy(workflowActions.orderIndex);

          return { ...wf, triggers, actions };
        }),
      );

      res.json(results);
    } catch (err) {
      handleAppError(res, err, 'workflows');
    }
  },
);

// ---------------------------------------------------------------------------
// POST /guilds/:guildId/workflows
// ---------------------------------------------------------------------------

workflowsRouter.post(
  '/:guildId/workflows',
  requireAuth,
  async (req: Request, res: Response) => {
    const { guildId } = req.params as Record<string, string>;
    const userId = req.userId!;

    try {
      await requireGuildOwner(guildId, userId);

      const parsed = createWorkflowSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ code: 'VALIDATION_ERROR', message: parsed.error.message });
        return;
      }

      const { name, triggers, actions } = parsed.data;

      // Insert workflow
      const [workflow] = await db
        .insert(workflows)
        .values({ guildId, name, createdBy: userId })
        .returning();

      // Insert triggers
      if (triggers.length > 0) {
        await db.insert(workflowTriggers).values(
          triggers.map((t) => ({
            workflowId: workflow.id,
            type: t.type,
            config: t.config ?? {},
          })),
        );
      }

      // Insert actions
      if (actions.length > 0) {
        await db.insert(workflowActions).values(
          actions.map((a) => ({
            workflowId: workflow.id,
            orderIndex: a.order,
            type: a.type,
            config: a.config ?? {},
          })),
        );
      }

      // Return full workflow with triggers and actions
      const insertedTriggers = await db
        .select()
        .from(workflowTriggers)
        .where(eq(workflowTriggers.workflowId, workflow.id));

      const insertedActions = await db
        .select()
        .from(workflowActions)
        .where(eq(workflowActions.workflowId, workflow.id))
        .orderBy(workflowActions.orderIndex);

      res.status(201).json({ ...workflow, triggers: insertedTriggers, actions: insertedActions });
    } catch (err) {
      handleAppError(res, err, 'workflows');
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /guilds/:guildId/workflows/:workflowId
// ---------------------------------------------------------------------------

workflowsRouter.patch(
  '/:guildId/workflows/:workflowId',
  requireAuth,
  async (req: Request, res: Response) => {
    const { guildId, workflowId } = req.params as Record<string, string>;
    const userId = req.userId!;

    try {
      await requireGuildOwner(guildId, userId);

      const parsed = updateWorkflowSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ code: 'VALIDATION_ERROR', message: parsed.error.message });
        return;
      }

      // Verify workflow belongs to this guild
      const [existing] = await db
        .select()
        .from(workflows)
        .where(and(eq(workflows.id, workflowId), eq(workflows.guildId, guildId)))
        .limit(1);

      if (!existing) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Workflow not found' });
        return;
      }

      const { name, enabled, triggers, actions } = parsed.data;

      // Update workflow fields if provided
      const updates: Partial<typeof existing> = {};
      if (name !== undefined) updates.name = name;
      if (enabled !== undefined) updates.enabled = enabled;

      if (Object.keys(updates).length > 0) {
        await db.update(workflows).set(updates).where(eq(workflows.id, workflowId));
      }

      // Replace triggers if provided
      if (triggers !== undefined) {
        await db.delete(workflowTriggers).where(eq(workflowTriggers.workflowId, workflowId));
        if (triggers.length > 0) {
          await db.insert(workflowTriggers).values(
            triggers.map((t) => ({
              workflowId,
              type: t.type,
              config: t.config ?? {},
            })),
          );
        }
      }

      // Replace actions if provided
      if (actions !== undefined) {
        await db.delete(workflowActions).where(eq(workflowActions.workflowId, workflowId));
        if (actions.length > 0) {
          await db.insert(workflowActions).values(
            actions.map((a) => ({
              workflowId,
              orderIndex: a.order,
              type: a.type,
              config: a.config ?? {},
            })),
          );
        }
      }

      // Return updated workflow
      const [updated] = await db
        .select()
        .from(workflows)
        .where(eq(workflows.id, workflowId))
        .limit(1);

      const updatedTriggers = await db
        .select()
        .from(workflowTriggers)
        .where(eq(workflowTriggers.workflowId, workflowId));

      const updatedActions = await db
        .select()
        .from(workflowActions)
        .where(eq(workflowActions.workflowId, workflowId))
        .orderBy(workflowActions.orderIndex);

      res.json({ ...updated, triggers: updatedTriggers, actions: updatedActions });
    } catch (err) {
      handleAppError(res, err, 'workflows');
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /guilds/:guildId/workflows/:workflowId
// ---------------------------------------------------------------------------

workflowsRouter.delete(
  '/:guildId/workflows/:workflowId',
  requireAuth,
  async (req: Request, res: Response) => {
    const { guildId, workflowId } = req.params as Record<string, string>;
    const userId = req.userId!;

    try {
      await requireGuildOwner(guildId, userId);

      const [existing] = await db
        .select()
        .from(workflows)
        .where(and(eq(workflows.id, workflowId), eq(workflows.guildId, guildId)))
        .limit(1);

      if (!existing) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Workflow not found' });
        return;
      }

      await db.delete(workflows).where(eq(workflows.id, workflowId));

      res.status(204).send();
    } catch (err) {
      handleAppError(res, err, 'workflows');
    }
  },
);
