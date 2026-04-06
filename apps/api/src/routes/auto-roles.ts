import { Router, Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index';
import { autoRoleRules } from '../db/schema/auto-roles';
import { Permissions } from '../db/schema/roles';
import { requireAuth } from '../middleware/auth';
import { hasPermission } from './roles';

export const autoRolesRouter = Router({ mergeParams: true });

// GET /guilds/:guildId/auto-roles — list rules
autoRolesRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId } = req.params as Record<string, string>;

  const rows = await db.select().from(autoRoleRules)
    .where(eq(autoRoleRules.guildId, guildId));

  res.json(rows);
});

// POST /guilds/:guildId/auto-roles — create rule
autoRolesRouter.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId } = req.params as Record<string, string>;

  if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_ROLES))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_ROLES permission' });
    return;
  }

  const { roleId, triggerType, triggerValue } = req.body as {
    roleId: string;
    triggerType: string;
    triggerValue: number;
  };

  if (!roleId || !triggerType || triggerValue === undefined) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'roleId, triggerType, and triggerValue are required'  });
    return;
  }

  const validTypes = ['days_in_server', 'message_count', 'level'];
  if (!validTypes.includes(triggerType)) {
    res.status(400).json({ error: `triggerType must be one of: ${validTypes.join(', ')}` });
    return;
  }

  const [rule] = await db.insert(autoRoleRules).values({
    guildId,
    roleId,
    triggerType,
    triggerValue,
  }).returning();

  res.status(201).json(rule);
});

// PATCH /guilds/:guildId/auto-roles/:id — update rule
autoRolesRouter.patch('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId, id } = req.params as Record<string, string>;

  if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_ROLES))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_ROLES permission' });
    return;
  }

  const [existing] = await db.select().from(autoRoleRules)
    .where(and(eq(autoRoleRules.id, id), eq(autoRoleRules.guildId, guildId)))
    .limit(1);

  if (!existing) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Auto-role rule not found' });
    return;
  }

  const { roleId, triggerType, triggerValue, enabled } = req.body as {
    roleId?: string;
    triggerType?: string;
    triggerValue?: number;
    enabled?: boolean;
  };

  const updates: Record<string, unknown> = {};
  if (roleId !== undefined) updates.roleId = roleId;
  if (triggerType !== undefined) updates.triggerType = triggerType;
  if (triggerValue !== undefined) updates.triggerValue = triggerValue;
  if (enabled !== undefined) updates.enabled = enabled;

  const [updated] = await db.update(autoRoleRules)
    .set(updates)
    .where(eq(autoRoleRules.id, id))
    .returning();

  res.json(updated);
});

// DELETE /guilds/:guildId/auto-roles/:id — delete rule
autoRolesRouter.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId, id } = req.params as Record<string, string>;

  if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_ROLES))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_ROLES permission' });
    return;
  }

  const [existing] = await db.select().from(autoRoleRules)
    .where(and(eq(autoRoleRules.id, id), eq(autoRoleRules.guildId, guildId)))
    .limit(1);

  if (!existing) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Auto-role rule not found' });
    return;
  }

  await db.delete(autoRoleRules).where(eq(autoRoleRules.id, id));
  res.json({ code: 'OK', message: 'Auto-role rule deleted' });
});
