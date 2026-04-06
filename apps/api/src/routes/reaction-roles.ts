import { Router, Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index';
import { reactionRoleMessages, reactionRoleMappings } from '../db/schema/reaction-roles';
import { memberRoles } from '../db/schema/roles';
import { Permissions } from '../db/schema/roles';
import { requireAuth } from '../middleware/auth';
import { hasPermission } from './roles';

export const reactionRolesRouter = Router({ mergeParams: true });

// GET /guilds/:guildId/reaction-roles — list all reaction role messages for guild
reactionRolesRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId } = req.params as Record<string, string>;

  const rows = await db.select().from(reactionRoleMessages)
    .where(eq(reactionRoleMessages.guildId, guildId));

  const result = [];
  for (const row of rows) {
    const mappings = await db.select().from(reactionRoleMappings)
      .where(eq(reactionRoleMappings.reactionRoleMessageId, row.id));
    result.push({ ...row, mappings });
  }

  res.json(result);
});

// POST /guilds/:guildId/reaction-roles — create reaction role message
reactionRolesRouter.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId } = req.params as Record<string, string>;

  if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_ROLES))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_ROLES permission' });
    return;
  }

  const { messageId, channelId, mode, mappings } = req.body as {
    messageId: string;
    channelId: string;
    mode?: string;
    mappings: { emoji: string; roleId: string }[];
  };

  if (!messageId || !channelId || !mappings?.length) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'messageId, channelId, and mappings are required'  });
    return;
  }

  const [rrm] = await db.insert(reactionRoleMessages).values({
    messageId,
    channelId,
    guildId,
    mode: mode || 'multi',
  }).returning();

  const insertedMappings = [];
  for (const m of mappings) {
    const [mapping] = await db.insert(reactionRoleMappings).values({
      reactionRoleMessageId: rrm.id,
      emoji: m.emoji,
      roleId: m.roleId,
    }).returning();
    insertedMappings.push(mapping);
  }

  res.status(201).json({ ...rrm, mappings: insertedMappings });
});

// DELETE /guilds/:guildId/reaction-roles/:id — delete reaction role message
reactionRolesRouter.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId, id } = req.params as Record<string, string>;

  if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_ROLES))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_ROLES permission' });
    return;
  }

  const [existing] = await db.select().from(reactionRoleMessages)
    .where(and(eq(reactionRoleMessages.id, id), eq(reactionRoleMessages.guildId, guildId)))
    .limit(1);

  if (!existing) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Reaction role message not found' });
    return;
  }

  await db.delete(reactionRoleMessages).where(eq(reactionRoleMessages.id, id));
  res.json({ code: 'OK', message: 'Reaction role message deleted' });
});

// POST /guilds/:guildId/reaction-roles/:id/apply — apply a reaction (assign/remove role)
reactionRolesRouter.post('/:id/apply', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId, id } = req.params as Record<string, string>;
  const { emoji } = req.body as { emoji: string };
  const userId = req.userId!;

  if (!emoji) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'emoji is required'  });
    return;
  }

  const [rrm] = await db.select().from(reactionRoleMessages)
    .where(and(eq(reactionRoleMessages.id, id), eq(reactionRoleMessages.guildId, guildId)))
    .limit(1);

  if (!rrm) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Reaction role message not found' });
    return;
  }

  const mapping = await db.select().from(reactionRoleMappings)
    .where(and(
      eq(reactionRoleMappings.reactionRoleMessageId, id),
      eq(reactionRoleMappings.emoji, emoji),
    ))
    .limit(1);

  if (!mapping.length) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'No role mapping for this emoji' });
    return;
  }

  const roleId = mapping[0].roleId;

  // Check if user already has this role
  const [existingRole] = await db.select().from(memberRoles)
    .where(and(eq(memberRoles.userId, userId), eq(memberRoles.roleId, roleId)))
    .limit(1);

  if (existingRole) {
    // Remove role (toggle off)
    await db.delete(memberRoles).where(eq(memberRoles.id, existingRole.id));
    res.json({ action: 'removed', roleId });
  } else {
    // In 'single' mode, remove any other reaction roles from this message first
    if (rrm.mode === 'single') {
      const allMappings = await db.select().from(reactionRoleMappings)
        .where(eq(reactionRoleMappings.reactionRoleMessageId, id));
      const allRoleIds = allMappings.map(m => m.roleId);
      for (const rid of allRoleIds) {
        await db.delete(memberRoles)
          .where(and(eq(memberRoles.userId, userId), eq(memberRoles.roleId, rid), eq(memberRoles.guildId, guildId)));
      }
    }

    // Assign role
    await db.insert(memberRoles).values({
      userId,
      roleId,
      guildId,
    }).onConflictDoNothing();

    res.json({ action: 'added', roleId });
  }
});
