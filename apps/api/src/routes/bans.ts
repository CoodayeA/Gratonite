import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, isNotNull, inArray } from 'drizzle-orm';
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
import { logger } from '../lib/logger';
import { logAdminAudit } from '../lib/admin-audit';

export const bansRouter = Router({ mergeParams: true });

const banSchema = z.object({
  reason: z.string().max(512).nullable().optional(),
  duration: z.number().int().positive().optional(), // minutes
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

    const { reason, duration } = req.body;
    const expiresAt = duration ? new Date(Date.now() + duration * 60 * 1000) : null;

    // Remove from guild members first
    await db.delete(guildMembers).where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, userId)));

    // Add ban
    await db.insert(guildBans).values({
      guildId,
      userId,
      reason: reason || null,
      bannedBy: req.userId!,
      expiresAt,
    }).onConflictDoNothing();

    // Audit log
    logAuditEvent(guildId, req.userId!, AuditActionTypes.MEMBER_BAN, userId, 'USER', null, reason || null);

    try {
      getIO().to(`guild:${guildId}`).emit('GUILD_BAN_ADD', { guildId, userId });
      getIO().to(`user:${userId}`).emit('GUILD_BAN_ADD', { guildId });
    } catch (err) { logger.debug({ msg: 'socket emit failed', event: 'GUILD_BAN_ADD', err }); }

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
  } catch (err) { logger.debug({ msg: 'socket emit failed', event: 'GUILD_BAN_REMOVE', err }); }

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

/** GET /guilds/:guildId/bans/appeals — list pending appeals (must be before /:userId routes) */
bansRouter.get('/appeals', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId } = req.params as Record<string, string>;
  const requestedStatus = typeof req.query.status === 'string' ? req.query.status : 'pending';

  if (!(await hasPermission(req.userId!, guildId, Permissions.BAN_MEMBERS))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing BAN_MEMBERS permission' }); return;
  }

  const statusFilter = requestedStatus === 'all'
    ? isNotNull(guildBans.appealStatus)
    : eq(guildBans.appealStatus, ['approved', 'denied', 'pending'].includes(requestedStatus) ? requestedStatus : 'pending');

  const appeals = await db
    .select({
      id: guildBans.id,
      userId: guildBans.userId,
      reason: guildBans.reason,
      appealStatus: guildBans.appealStatus,
      appealText: guildBans.appealText,
      appealSubmittedAt: guildBans.appealSubmittedAt,
      appealReviewedAt: guildBans.appealReviewedAt,
      appealReviewedBy: guildBans.appealReviewedBy,
      createdAt: guildBans.createdAt,
      username: users.username,
      displayName: users.displayName,
      avatarHash: users.avatarHash,
    })
    .from(guildBans)
    .leftJoin(users, eq(users.id, guildBans.userId))
    .where(and(eq(guildBans.guildId, guildId), statusFilter));

  const reviewerIds = Array.from(new Set(appeals.map((appeal) => appeal.appealReviewedBy).filter((id): id is string => Boolean(id))));
  const reviewers = reviewerIds.length
    ? await db.select({ id: users.id, username: users.username, displayName: users.displayName }).from(users).where(inArray(users.id, reviewerIds))
    : [];
  const reviewerMap = new Map(reviewers.map((reviewer) => [reviewer.id, reviewer]));

  res.json(appeals
    .sort((a, b) => new Date(b.appealSubmittedAt ?? b.createdAt).getTime() - new Date(a.appealSubmittedAt ?? a.createdAt).getTime())
    .map((appeal) => ({
      ...appeal,
      reviewedByName: appeal.appealReviewedBy ? (reviewerMap.get(appeal.appealReviewedBy)?.displayName || reviewerMap.get(appeal.appealReviewedBy)?.username || null) : null,
    })));
});

/** POST /guilds/:guildId/bans/:userId/appeal — submit a ban appeal */
bansRouter.post('/:userId/appeal', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId, userId } = req.params as Record<string, string>;

  // The banned user themselves submits the appeal
  if (userId !== req.userId!) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'You can only appeal your own ban' }); return;
  }

  const [ban] = await db.select().from(guildBans)
    .where(and(eq(guildBans.guildId, guildId), eq(guildBans.userId, userId)))
    .limit(1);
  if (!ban) { res.status(404).json({ code: 'NOT_FOUND', message: 'Ban not found' }); return; }
  if (ban.appealStatus) { res.status(400).json({ code: 'BAD_REQUEST', message: 'Appeal already submitted' }); return; }

  const { text: appealText } = req.body as { text?: string };
  if (!appealText || appealText.trim().length === 0) {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Appeal text is required' }); return;
  }
  if (appealText.length > 2000) {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Appeal text must be 2000 characters or fewer' }); return;
  }

  const [updated] = await db.update(guildBans).set({
    appealStatus: 'pending',
    appealText: appealText.trim(),
    appealSubmittedAt: new Date(),
  }).where(eq(guildBans.id, ban.id)).returning();

  res.json(updated);
});

/** PATCH /guilds/:guildId/bans/:userId/appeal — review an appeal */
bansRouter.patch('/:userId/appeal', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId, userId } = req.params as Record<string, string>;

  if (!(await hasPermission(req.userId!, guildId, Permissions.BAN_MEMBERS))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing BAN_MEMBERS permission' }); return;
  }

  const { status } = req.body as { status?: string };
  if (!status || !['approved', 'denied'].includes(status)) {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: 'status must be "approved" or "denied"' }); return;
  }

  const [ban] = await db.select().from(guildBans)
    .where(and(eq(guildBans.guildId, guildId), eq(guildBans.userId, userId)))
    .limit(1);
  if (!ban) { res.status(404).json({ code: 'NOT_FOUND', message: 'Ban not found' }); return; }

  const [targetUser] = await db.select({ username: users.username, displayName: users.displayName }).from(users).where(eq(users.id, userId)).limit(1);
  const [targetGuild] = await db.select({ name: guilds.name }).from(guilds).where(eq(guilds.id, guildId)).limit(1);
  const actorLabel = targetUser?.displayName || targetUser?.username || userId;
  const guildLabel = targetGuild?.name || guildId;

  if (status === 'approved') {
    await db.delete(guildBans).where(eq(guildBans.id, ban.id));
    try {
      getIO().to(`guild:${guildId}`).emit('GUILD_BAN_REMOVE', { guildId, userId });
    } catch (err) { logger.debug({ msg: 'socket emit failed', event: 'GUILD_BAN_REMOVE', err }); }
    await logAdminAudit({
      actorId: req.userId!,
      action: 'BAN_APPEAL_APPROVED',
      targetType: 'ban_appeal',
      targetId: `${guildId}:${userId}`,
      description: `Approved ban appeal for ${actorLabel} in ${guildLabel}`,
      metadata: {
        guildId,
        userId,
        appealStatus: 'approved',
        appealSubmittedAt: ban.appealSubmittedAt?.toISOString?.() ?? null,
      },
    });
    res.json({ code: 'OK', message: 'Appeal approved, ban removed' });
  } else {
    await db.update(guildBans).set({
      appealStatus: 'denied',
      appealReviewedBy: req.userId!,
      appealReviewedAt: new Date(),
    }).where(eq(guildBans.id, ban.id));
    await logAdminAudit({
      actorId: req.userId!,
      action: 'BAN_APPEAL_DENIED',
      targetType: 'ban_appeal',
      targetId: `${guildId}:${userId}`,
      description: `Denied ban appeal for ${actorLabel} in ${guildLabel}`,
      metadata: {
        guildId,
        userId,
        appealStatus: 'denied',
        appealSubmittedAt: ban.appealSubmittedAt?.toISOString?.() ?? null,
      },
    });
    res.json({ code: 'OK', message: 'Appeal denied' });
  }
});
