import { Router, Request, Response } from 'express';
import { eq, and, asc } from 'drizzle-orm';
import { db } from '../db/index';
import { guildMemberGroups, guildMemberGroupMembers } from '../db/schema/member-groups';
import { guildMembers } from '../db/schema/guilds';
import { Permissions } from '../db/schema/roles';
import { requireAuth } from '../middleware/auth';
import { hasPermission } from './roles';

export const memberGroupsRouter = Router({ mergeParams: true });

// GET /guilds/:guildId/member-groups — list all groups
memberGroupsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId } = req.params as Record<string, string>;

  const [member] = await db.select({ id: guildMembers.id })
    .from(guildMembers)
    .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, req.userId!)))
    .limit(1);
  if (!member) { res.status(403).json({ code: 'FORBIDDEN', message: 'Not a guild member' }); return; }

  const groups = await db.select().from(guildMemberGroups)
    .where(eq(guildMemberGroups.guildId, guildId))
    .orderBy(asc(guildMemberGroups.position));

  res.json(groups);
});

// POST /guilds/:guildId/member-groups — create group
memberGroupsRouter.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId } = req.params as Record<string, string>;

  if (!(await hasPermission(req.userId!, guildId, Permissions.MODERATE_MEMBERS))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_MEMBERS permission' }); return;
  }

  const { name, color, position } = req.body as { name?: string; color?: string; position?: number };
  if (!name || !name.trim()) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'name is required' }); return;
  }

  const [group] = await db.insert(guildMemberGroups).values({
    guildId,
    name: name.trim(),
    color: color || '#99aab5',
    position: position ?? 0,
    createdBy: req.userId!,
  }).returning();

  res.status(201).json(group);
});

// PUT /guilds/:guildId/member-groups/:groupId — update group
memberGroupsRouter.put('/:groupId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId, groupId } = req.params as Record<string, string>;

  if (!(await hasPermission(req.userId!, guildId, Permissions.MODERATE_MEMBERS))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_MEMBERS permission' }); return;
  }

  const { name, color, position } = req.body as { name?: string; color?: string; position?: number };
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (name) updates.name = name.trim();
  if (color) updates.color = color;
  if (position !== undefined) updates.position = position;

  const [updated] = await db.update(guildMemberGroups)
    .set(updates)
    .where(and(eq(guildMemberGroups.id, groupId), eq(guildMemberGroups.guildId, guildId)))
    .returning();

  if (!updated) { res.status(404).json({ code: 'NOT_FOUND', message: 'Group not found' }); return; }
  res.json(updated);
});

// DELETE /guilds/:guildId/member-groups/:groupId — delete group
memberGroupsRouter.delete('/:groupId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId, groupId } = req.params as Record<string, string>;

  if (!(await hasPermission(req.userId!, guildId, Permissions.MODERATE_MEMBERS))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_MEMBERS permission' }); return;
  }

  const deleted = await db.delete(guildMemberGroups)
    .where(and(eq(guildMemberGroups.id, groupId), eq(guildMemberGroups.guildId, guildId)))
    .returning({ id: guildMemberGroups.id });

  if (deleted.length === 0) { res.status(404).json({ code: 'NOT_FOUND', message: 'Group not found' }); return; }
  res.json({ code: 'OK', message: 'Group deleted' });
});

// POST /guilds/:guildId/member-groups/:groupId/members — add member to group
memberGroupsRouter.post('/:groupId/members', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId, groupId } = req.params as Record<string, string>;

  if (!(await hasPermission(req.userId!, guildId, Permissions.MODERATE_MEMBERS))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_MEMBERS permission' }); return;
  }

  const { userId } = req.body as { userId?: string };
  if (!userId) { res.status(400).json({ code: 'BAD_REQUEST', message: 'userId is required' }); return; }

  const [gm] = await db.select({ id: guildMembers.id })
    .from(guildMembers)
    .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, userId)))
    .limit(1);
  if (!gm) { res.status(404).json({ code: 'NOT_FOUND', message: 'User is not a guild member' }); return; }

  const [entry] = await db.insert(guildMemberGroupMembers)
    .values({ groupId, guildId, userId })
    .onConflictDoNothing()
    .returning();

  res.status(201).json(entry ?? { groupId, guildId, userId });
});

// DELETE /guilds/:guildId/member-groups/:groupId/members/:userId — remove member from group
memberGroupsRouter.delete('/:groupId/members/:userId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId, groupId, userId } = req.params as Record<string, string>;

  if (!(await hasPermission(req.userId!, guildId, Permissions.MODERATE_MEMBERS))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_MEMBERS permission' }); return;
  }

  await db.delete(guildMemberGroupMembers)
    .where(and(
      eq(guildMemberGroupMembers.groupId, groupId),
      eq(guildMemberGroupMembers.userId, userId),
    ));

  res.json({ code: 'OK', message: 'Member removed from group' });
});
