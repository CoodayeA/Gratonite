import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index';
import { automodRules } from '../db/schema/automod-rules';
import { Permissions } from '../db/schema/roles';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { hasPermission } from './roles';

export const automodRouter = Router({ mergeParams: true });

const createRuleSchema = z.object({
  name: z.string().min(1).max(100),
  triggerType: z.string().min(1),
  triggerMetadata: z.record(z.string(), z.unknown()).optional(),
  actions: z.array(z.record(z.string(), z.unknown())).optional(),
  exemptRoles: z.array(z.string()).optional(),
  exemptChannels: z.array(z.string()).optional(),
  enabled: z.boolean().optional(),
});

const updateRuleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  enabled: z.boolean().optional(),
  triggerMetadata: z.record(z.string(), z.unknown()).optional(),
  actions: z.array(z.record(z.string(), z.unknown())).optional(),
  exemptRoles: z.array(z.string()).optional(),
  exemptChannels: z.array(z.string()).optional(),
});

/** GET /guilds/:guildId/auto-moderation/rules */
automodRouter.get('/rules', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId } = req.params as Record<string, string>;

  if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission' }); return;
  }

  const rules = await db.select().from(automodRules).where(eq(automodRules.guildId, guildId));
  res.json(rules);
});

/** POST /guilds/:guildId/auto-moderation/rules */
automodRouter.post('/rules', requireAuth, validate(createRuleSchema), async (req: Request, res: Response): Promise<void> => {
  const { guildId } = req.params as Record<string, string>;

  if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission' }); return;
  }

  const { name, triggerType, triggerMetadata, actions, exemptRoles, exemptChannels, enabled } = req.body;

  const [rule] = await db.insert(automodRules).values({
    guildId,
    name,
    triggerType,
    triggerMetadata: triggerMetadata || {},
    actions: actions || [],
    exemptRoles: exemptRoles || [],
    exemptChannels: exemptChannels || [],
    enabled: enabled ?? true,
  }).returning();

  res.status(201).json(rule);
});

/** PATCH /guilds/:guildId/auto-moderation/rules/:ruleId */
automodRouter.patch('/rules/:ruleId', requireAuth, validate(updateRuleSchema), async (req: Request, res: Response): Promise<void> => {
  const { guildId, ruleId } = req.params as Record<string, string>;

  if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission' }); return;
  }

  const { name, enabled, triggerMetadata, actions, exemptRoles, exemptChannels } = req.body;
  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (enabled !== undefined) updateData.enabled = enabled;
  if (triggerMetadata !== undefined) updateData.triggerMetadata = triggerMetadata;
  if (actions !== undefined) updateData.actions = actions;
  if (exemptRoles !== undefined) updateData.exemptRoles = exemptRoles;
  if (exemptChannels !== undefined) updateData.exemptChannels = exemptChannels;

  const [updated] = await db.update(automodRules)
    .set(updateData)
    .where(and(eq(automodRules.id, ruleId), eq(automodRules.guildId, guildId)))
    .returning();

  if (!updated) { res.status(404).json({ code: 'NOT_FOUND', message: 'Rule not found' }); return; }
  res.json(updated);
});

/** DELETE /guilds/:guildId/auto-moderation/rules/:ruleId */
automodRouter.delete('/rules/:ruleId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId, ruleId } = req.params as Record<string, string>;

  if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission' }); return;
  }

  await db.delete(automodRules).where(and(eq(automodRules.id, ruleId), eq(automodRules.guildId, guildId)));
  res.json({ code: 'OK', message: 'Rule deleted' });
});
