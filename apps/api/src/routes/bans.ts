import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index';
import { guildBans } from '../db/schema/bans';
import { guilds, guildMembers } from '../db/schema/guilds';
import { users } from '../db/schema/users';
import { Permissions } from '../db/schema/roles';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { getIO } from '../lib/socket-io';
import { hasPermission } from './roles';
import { logAuditEvent, AuditActionTypes } from '../lib/audit';

export const bansRouter = Router({ mergeParams: true });

const banSchema = z.object({
  reason: z.string().max(512).nullable().optional(),
});

/** PUT /guilds/:guildId/bans/:userId */
bansRouter.put(
  '/:userId',
  requireAuth,
  validate(banSchema),
  async (req: Request, res: Response): Promise<void> => {
    const { guildId, userId } = req.params as Record<string, string>;

    // Check BAN_MEMBERS permission (hasPermission already checks guild owner + ADMINISTRATOR)
    if (!(await hasPermission(req.userId!, guildId, Permissions.BAN_MEMBERS))) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Missing BAN_MEMBERS permission' }); return;
    }

    // Can't ban the owner
    const [guild] = await db.select({ ownerId: guilds.ownerId }).from(guilds).where(eq(guilds.id, guildId)).limit(1);
    if (!guild) { res.status(404).json({ code: 'NOT_FOUND', message: 'Guild not found' }); return; }
    if (userId === guild.ownerId) {
      res.status(400).json({ code: 'BAD_REQUEST', message: 'Cannot ban the guild owner' }); return;
    }

    const { reason } = req.body;

    // Remove from guild members first
    await db.delete(guildMembers).where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, userId)));

    // Add ban
    await db.insert(guildBans).values({
      guildId,
      userId,
      reason: reason || null,
      bannedBy: req.userId!,
    }).onConflictDoNothing();

    // Audit log
    logAuditEvent(guildId, req.userId!, AuditActionTypes.MEMBER_BAN, userId, 'USER', null, reason || null);

    try {
      getIO().to(`guild:${guildId}`).emit('GUILD_BAN_ADD', { guildId, userId });
      getIO().to(`user:${userId}`).emit('GUILD_BAN_ADD', { guildId });
    } catch {}

    res.json({ code: 'OK' });
  },
);

/** DELETE /guilds/:guildId/bans/:userId — unban */
bansRouter.delete('/:userId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId, userId } = req.params as Record<string, string>;

  if (!(await hasPermission(req.userId!, guildId, Permissions.BAN_MEMBERS))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing BAN_MEMBERS permission' }); return;
  }

  await db.delete(guildBans).where(and(eq(guildBans.guildId, guildId), eq(guildBans.userId, userId)));

  // Audit log
  logAuditEvent(guildId, req.userId!, AuditActionTypes.MEMBER_UNBAN, userId, 'USER');

  try {
    getIO().to(`guild:${guildId}`).emit('GUILD_BAN_REMOVE', { guildId, userId });
  } catch {}

  res.json({ code: 'OK' });
});

/** GET /guilds/:guildId/bans */
bansRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId } = req.params as Record<string, string>;

  if (!(await hasPermission(req.userId!, guildId, Permissions.BAN_MEMBERS))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing BAN_MEMBERS permission' }); return;
  }

  const bans = await db
    .select({
      id: guildBans.id,
      userId: guildBans.userId,
      reason: guildBans.reason,
      bannedBy: guildBans.bannedBy,
      createdAt: guildBans.createdAt,
      username: users.username,
      displayName: users.displayName,
      avatarHash: users.avatarHash,
    })
    .from(guildBans)
    .leftJoin(users, eq(users.id, guildBans.userId))
    .where(eq(guildBans.guildId, guildId));

  res.json(bans);
});
