import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, asc } from 'drizzle-orm';
import { db } from '../db/index';
import { roles, memberRoles, Permissions, DEFAULT_PERMISSIONS } from '../db/schema/roles';
import { guildMembers, guilds } from '../db/schema/guilds';
import { channelPermissionOverrides } from '../db/schema/channel-overrides';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { getIO } from '../lib/socket-io';
import { logAuditEvent, AuditActionTypes } from '../lib/audit';

export const rolesRouter = Router({ mergeParams: true });

// Helper: check if user has permission in guild
async function hasPermission(userId: string, guildId: string, permission: bigint): Promise<boolean> {
  // Check if guild owner (full permissions)
  const [guild] = await db.select({ ownerId: guilds.ownerId }).from(guilds).where(eq(guilds.id, guildId)).limit(1);
  if (guild?.ownerId === userId) return true;

  // Get all user's roles in this guild
  const userRoles = await db
    .select({ permissions: roles.permissions })
    .from(memberRoles)
    .innerJoin(roles, eq(roles.id, memberRoles.roleId))
    .where(and(eq(memberRoles.userId, userId), eq(memberRoles.guildId, guildId)));

  // Also get @everyone role
  const [everyoneRole] = await db
    .select({ permissions: roles.permissions })
    .from(roles)
    .where(and(eq(roles.guildId, guildId), eq(roles.name, '@everyone')))
    .limit(1);

  let effectivePerms = everyoneRole?.permissions ?? 0n;
  for (const r of userRoles) {
    effectivePerms |= r.permissions;
  }

  if (effectivePerms & Permissions.ADMINISTRATOR) return true;
  return (effectivePerms & permission) !== 0n;
}

// Export for use in other routes
export { hasPermission };

/**
 * Compute effective permissions for a user in a specific channel.
 *
 * Algorithm (Discord-style):
 *   1. Start with base guild permissions (OR of @everyone + all assigned roles).
 *   2. If ADMINISTRATOR, return all permissions immediately.
 *   3. Apply role-level channel overrides: for each role the user has (plus @everyone),
 *      OR in the allow bits and AND out the deny bits.
 *   4. Apply member-specific channel override: OR in allow, AND out deny.
 *   5. Guild owners always get full permissions.
 */
async function computeChannelPermissions(userId: string, guildId: string, channelId: string): Promise<bigint> {
  // Guild owner gets everything
  const [guild] = await db.select({ ownerId: guilds.ownerId }).from(guilds).where(eq(guilds.id, guildId)).limit(1);
  if (guild?.ownerId === userId) return ~0n; // all bits set

  // Get @everyone role
  const [everyoneRole] = await db
    .select({ id: roles.id, permissions: roles.permissions })
    .from(roles)
    .where(and(eq(roles.guildId, guildId), eq(roles.name, '@everyone')))
    .limit(1);

  // Get all user's roles in this guild (with IDs for override lookup)
  const userRoles = await db
    .select({ id: roles.id, permissions: roles.permissions })
    .from(memberRoles)
    .innerJoin(roles, eq(roles.id, memberRoles.roleId))
    .where(and(eq(memberRoles.userId, userId), eq(memberRoles.guildId, guildId)));

  // Step 1: base permissions = OR of @everyone + assigned roles
  let basePerms = everyoneRole?.permissions ?? 0n;
  for (const r of userRoles) {
    basePerms |= r.permissions;
  }

  // Step 2: ADMINISTRATOR short-circuit
  if (basePerms & Permissions.ADMINISTRATOR) return ~0n;

  // Fetch all channel overrides for this channel
  const overrides = await db
    .select()
    .from(channelPermissionOverrides)
    .where(eq(channelPermissionOverrides.channelId, channelId));

  // Build lookup: targetId -> override
  const overrideMap = new Map(overrides.map((o) => [o.targetId, o]));

  // Step 3: Apply role overrides
  let permissions = basePerms;
  let roleAllow = 0n;
  let roleDeny = 0n;

  // @everyone role override
  if (everyoneRole) {
    const everyoneOverride = overrideMap.get(everyoneRole.id);
    if (everyoneOverride) {
      roleAllow |= everyoneOverride.allow;
      roleDeny |= everyoneOverride.deny;
    }
  }

  // Other role overrides
  for (const r of userRoles) {
    const override = overrideMap.get(r.id);
    if (override) {
      roleAllow |= override.allow;
      roleDeny |= override.deny;
    }
  }

  permissions = (permissions & ~roleDeny) | roleAllow;

  // Step 4: Apply member-specific override
  const memberOverride = overrideMap.get(userId);
  if (memberOverride) {
    permissions = (permissions & ~memberOverride.deny) | memberOverride.allow;
  }

  return permissions;
}

/**
 * Check if a user has a specific permission in a specific channel.
 * Takes into account channel permission overrides.
 */
async function hasChannelPermission(userId: string, guildId: string, channelId: string, permission: bigint): Promise<boolean> {
  const effective = await computeChannelPermissions(userId, guildId, channelId);
  return (effective & permission) !== 0n;
}

export { hasChannelPermission, computeChannelPermissions };

/** GET /api/v1/guilds/:guildId/roles */
rolesRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId } = req.params as Record<string, string>;

  // Verify membership
  const [membership] = await db
    .select({ id: guildMembers.id })
    .from(guildMembers)
    .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, req.userId!)))
    .limit(1);
  if (!membership) { res.status(403).json({ code: 'FORBIDDEN', message: 'Not a guild member' }); return; }

  const guildRoles = await db
    .select()
    .from(roles)
    .where(eq(roles.guildId, guildId))
    .orderBy(asc(roles.position));

  res.json(guildRoles.map(r => ({
    ...r,
    permissions: r.permissions.toString(),
  })));
});

const createRoleSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  permissions: z.string().optional(),
  hoist: z.boolean().optional(),
  mentionable: z.boolean().optional(),
});

/** POST /api/v1/guilds/:guildId/roles */
rolesRouter.post('/', requireAuth, validate(createRoleSchema), async (req: Request, res: Response): Promise<void> => {
  const { guildId } = req.params as Record<string, string>;

  if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_ROLES))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_ROLES permission' }); return;
  }

  const { name, color, permissions: permsStr, hoist, mentionable } = req.body;

  // Get next position
  const allRoles = await db.select({ position: roles.position }).from(roles).where(eq(roles.guildId, guildId));
  const maxPos = allRoles.reduce((max, r) => Math.max(max, r.position), 0);

  const [created] = await db.insert(roles).values({
    guildId,
    name,
    color: color || null,
    position: maxPos + 1,
    permissions: permsStr ? BigInt(permsStr) : DEFAULT_PERMISSIONS,
    hoist: hoist ?? false,
    mentionable: mentionable ?? false,
  }).returning();

  // Audit log
  logAuditEvent(guildId, req.userId!, AuditActionTypes.ROLE_CREATE, created.id, 'ROLE', { name: created.name, color: created.color });

  try {
    getIO().to(`guild:${guildId}`).emit('GUILD_ROLE_CREATE', { ...created, permissions: created.permissions.toString() });
  } catch {}

  res.status(201).json({ ...created, permissions: created.permissions.toString() });
});

const patchRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  permissions: z.string().optional(),
  hoist: z.boolean().optional(),
  mentionable: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
  unicodeEmoji: z.string().max(50).nullable().optional(),
  iconHash: z.string().max(255).nullable().optional(),
});

/** PATCH /api/v1/guilds/:guildId/roles/:roleId */
rolesRouter.patch('/:roleId', requireAuth, validate(patchRoleSchema), async (req: Request, res: Response): Promise<void> => {
  const { guildId, roleId } = req.params as Record<string, string>;

  if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_ROLES))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_ROLES permission' }); return;
  }

  const { name, color, permissions: permsStr, hoist, mentionable, position, unicodeEmoji, iconHash } = req.body;
  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (color !== undefined) updateData.color = color;
  if (permsStr !== undefined) updateData.permissions = BigInt(permsStr);
  if (hoist !== undefined) updateData.hoist = hoist;
  if (mentionable !== undefined) updateData.mentionable = mentionable;
  if (position !== undefined) updateData.position = position;
  if (unicodeEmoji !== undefined) updateData.unicodeEmoji = unicodeEmoji;
  if (iconHash !== undefined) updateData.iconHash = iconHash;

  const [updated] = await db.update(roles).set(updateData).where(and(eq(roles.id, roleId), eq(roles.guildId, guildId))).returning();
  if (!updated) { res.status(404).json({ code: 'NOT_FOUND', message: 'Role not found' }); return; }

  // Audit log
  logAuditEvent(guildId, req.userId!, AuditActionTypes.ROLE_UPDATE, roleId, 'ROLE', updateData);

  try {
    getIO().to(`guild:${guildId}`).emit('GUILD_ROLE_UPDATE', { ...updated, permissions: updated.permissions.toString() });
  } catch {}

  res.json({ ...updated, permissions: updated.permissions.toString() });
});

/** DELETE /api/v1/guilds/:guildId/roles/:roleId */
rolesRouter.delete('/:roleId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId, roleId } = req.params as Record<string, string>;

  if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_ROLES))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_ROLES permission' }); return;
  }

  const [role] = await db.select().from(roles).where(and(eq(roles.id, roleId), eq(roles.guildId, guildId))).limit(1);
  if (!role) { res.status(404).json({ code: 'NOT_FOUND', message: 'Role not found' }); return; }
  if (role.name === '@everyone') { res.status(400).json({ code: 'BAD_REQUEST', message: 'Cannot delete @everyone role' }); return; }

  // Audit log (before delete so we have the role data)
  logAuditEvent(guildId, req.userId!, AuditActionTypes.ROLE_DELETE, roleId, 'ROLE', { name: role.name });

  await db.delete(roles).where(eq(roles.id, roleId));

  try {
    getIO().to(`guild:${guildId}`).emit('GUILD_ROLE_DELETE', { roleId, guildId });
  } catch {}

  res.json({ code: 'OK', message: 'Role deleted' });
});

/** PUT /api/v1/guilds/:guildId/members/:userId/roles/:roleId */
rolesRouter.put('/members/:userId/roles/:roleId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId, userId, roleId } = req.params as Record<string, string>;

  if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_ROLES))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_ROLES permission' }); return;
  }

  // Verify role exists in guild
  const [role] = await db.select({ id: roles.id }).from(roles).where(and(eq(roles.id, roleId), eq(roles.guildId, guildId))).limit(1);
  if (!role) { res.status(404).json({ code: 'NOT_FOUND', message: 'Role not found' }); return; }

  // Verify user is guild member
  const [member] = await db.select({ id: guildMembers.id }).from(guildMembers).where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, userId))).limit(1);
  if (!member) { res.status(404).json({ code: 'NOT_FOUND', message: 'Member not found' }); return; }

  // Upsert
  await db.insert(memberRoles).values({ userId, roleId, guildId }).onConflictDoNothing();

  try {
    getIO().to(`guild:${guildId}`).emit('GUILD_MEMBER_ROLE_ADD', { userId, roleId, guildId });
  } catch {}

  res.json({ code: 'OK' });
});

/** DELETE /api/v1/guilds/:guildId/members/:userId/roles/:roleId */
rolesRouter.delete('/members/:userId/roles/:roleId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId, userId, roleId } = req.params as Record<string, string>;

  if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_ROLES))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_ROLES permission' }); return;
  }

  await db.delete(memberRoles).where(and(eq(memberRoles.userId, userId), eq(memberRoles.roleId, roleId)));

  try {
    getIO().to(`guild:${guildId}`).emit('GUILD_MEMBER_ROLE_REMOVE', { userId, roleId, guildId });
  } catch {}

  res.json({ code: 'OK' });
});
