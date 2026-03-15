import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/index';
import { guildInvites } from '../db/schema/invites';
import { guilds, guildMembers } from '../db/schema/guilds';
import { guildBans } from '../db/schema/bans';
import { roles as rolesTable, Permissions } from '../db/schema/roles';
import { users } from '../db/schema/users';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { getIO } from '../lib/socket-io';
import { logger } from '../lib/logger';
import { hasPermission } from './roles';
import { redis } from '../lib/redis';
import { publicInviteRateLimit } from '../middleware/rateLimit';
import { toRows } from '../lib/to-rows.js';
import crypto from 'crypto';
import { recordActivity } from './activity';

export const invitesRouter = Router();

function generateCode(): string {
  return crypto.randomBytes(8).toString('base64url');
}

const createInviteSchema = z.object({
  maxUses: z.number().int().min(0).max(1000).nullable().optional(),
  expiresIn: z.number().int().min(0).nullable().optional(), // seconds from now, 0 = never
  temporary: z.boolean().optional(),
});

/** POST /api/v1/guilds/:guildId/invites */
invitesRouter.post(
  '/guilds/:guildId/invites',
  requireAuth,
  validate(createInviteSchema),
  async (req: Request, res: Response): Promise<void> => {
    const { guildId } = req.params as Record<string, string>;

    // Verify membership
    const [membership] = await db
      .select({ id: guildMembers.id })
      .from(guildMembers)
      .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, req.userId!)))
      .limit(1);
    if (!membership) { res.status(403).json({ code: 'FORBIDDEN', message: 'Not a guild member' }); return; }

    const { maxUses, expiresIn, temporary } = req.body;
    const expiresAt = expiresIn && expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000) : null;

    let code = generateCode();
    // Ensure uniqueness
    for (let i = 0; i < 5; i++) {
      const [exists] = await db.select({ code: guildInvites.code }).from(guildInvites).where(eq(guildInvites.code, code)).limit(1);
      if (!exists) break;
      code = generateCode();
    }

    const [invite] = await db.insert(guildInvites).values({
      code,
      guildId,
      createdBy: req.userId!,
      maxUses: maxUses ?? null,
      expiresAt,
      temporary: temporary ?? false,
    }).returning();

    res.status(201).json(invite);
  },
);

/** GET /api/v1/guilds/:guildId/invites */
invitesRouter.get('/guilds/:guildId/invites', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId } = req.params as Record<string, string>;

  const [membership] = await db
    .select({ id: guildMembers.id })
    .from(guildMembers)
    .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, req.userId!)))
    .limit(1);
  if (!membership) { res.status(403).json({ code: 'FORBIDDEN', message: 'Not a guild member' }); return; }

  const inviteRows = await db
    .select({
      code: guildInvites.code,
      guildId: guildInvites.guildId,
      createdBy: guildInvites.createdBy,
      maxUses: guildInvites.maxUses,
      uses: guildInvites.uses,
      expiresAt: guildInvites.expiresAt,
      temporary: guildInvites.temporary,
      createdAt: guildInvites.createdAt,
      creatorUsername: users.username,
    })
    .from(guildInvites)
    .leftJoin(users, eq(users.id, guildInvites.createdBy))
    .where(eq(guildInvites.guildId, guildId));

  res.json(inviteRows);
});

/** GET /api/v1/invites/:code — public preview */
invitesRouter.get('/invites/:code', publicInviteRateLimit, async (req: Request, res: Response): Promise<void> => {
  const { code } = req.params as Record<string, string>;
  const [invite] = await db.select().from(guildInvites).where(eq(guildInvites.code, code)).limit(1);
  if (!invite) { res.status(404).json({ code: 'NOT_FOUND', message: 'Invite not found or expired' }); return; }

  // Check expiry
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    res.status(410).json({ code: 'EXPIRED', message: 'Invite has expired' }); return;
  }
  if (invite.maxUses && invite.uses >= invite.maxUses) {
    res.status(410).json({ code: 'EXHAUSTED', message: 'Invite has reached max uses' }); return;
  }

  const [guild] = await db.select({
    id: guilds.id,
    name: guilds.name,
    iconHash: guilds.iconHash,
    memberCount: guilds.memberCount,
    description: guilds.description,
  }).from(guilds).where(eq(guilds.id, invite.guildId)).limit(1);

  res.json({ invite: { code: invite.code, guildId: invite.guildId }, guild });
});

/** POST /api/v1/invites/:code — join guild via invite or vanity code */
invitesRouter.post('/invites/:code', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { code } = req.params as Record<string, string>;
  const [invite] = await db.select().from(guildInvites).where(eq(guildInvites.code, code)).limit(1);

  // Fallback: check if this is a vanity code
  if (!invite) {
    const [vanityGuild] = await db.select({ id: guilds.id }).from(guilds).where(eq(guilds.vanityCode, code)).limit(1);
    if (!vanityGuild) { res.status(404).json({ code: 'NOT_FOUND', message: 'Invite not found' }); return; }

    // Check ban BEFORE raid detection so banned users can't trigger lockdown
    const [ban] = await db.select({ id: guildBans.id }).from(guildBans)
      .where(and(eq(guildBans.guildId, vanityGuild.id), eq(guildBans.userId, req.userId!))).limit(1);
    if (ban) { res.status(403).json({ code: 'BANNED', message: 'You are banned from this guild' }); return; }

    // Check if guild is locked (raid protection)
    const vanityGuildResult = await db.execute(sql`SELECT locked_at, raid_protection_enabled FROM guilds WHERE id = ${vanityGuild.id}`);
    const vanityGuildRow = toRows<{ locked_at: string | null; raid_protection_enabled: boolean }>(vanityGuildResult)[0];
    if (vanityGuildRow && vanityGuildRow.locked_at) {
      res.status(403).json({ code: 'GUILD_LOCKED', message: 'This server is currently locked' }); return;
    }

    // Raid detection
    if (vanityGuildRow && vanityGuildRow.raid_protection_enabled) {
      const key = `raid:joins:${vanityGuild.id}`;
      const count = await redis.incr(key);
      await redis.expire(key, 10); // Always set TTL to avoid leaked keys
      if (count > 10) {
        await db.execute(sql`UPDATE guilds SET locked_at = now() WHERE id = ${vanityGuild.id}`);
        getIO().to(`guild:${vanityGuild.id}`).emit('GUILD_LOCKDOWN_START', { guildId: vanityGuild.id });
        res.status(403).json({ code: 'GUILD_LOCKED', message: 'Server locked due to raid detection' }); return;
      }
    }

    // Check already a member
    const [existing] = await db.select({ id: guildMembers.id }).from(guildMembers)
      .where(and(eq(guildMembers.guildId, vanityGuild.id), eq(guildMembers.userId, req.userId!))).limit(1);
    if (existing) { res.json({ code: 'ALREADY_MEMBER', guildId: vanityGuild.id }); return; }

    // Join guild via vanity code
    await db.insert(guildMembers).values({ guildId: vanityGuild.id, userId: req.userId! });
    await db.update(guilds).set({ memberCount: sql`${guilds.memberCount} + 1` }).where(eq(guilds.id, vanityGuild.id));

    const [user] = await db.select({ id: users.id, username: users.username, displayName: users.displayName, avatarHash: users.avatarHash })
      .from(users).where(eq(users.id, req.userId!)).limit(1);

    try {
      getIO().to(`guild:${vanityGuild.id}`).emit('GUILD_MEMBER_ADD', { guildId: vanityGuild.id, user });
    } catch (err) { logger.debug({ msg: 'socket emit failed', event: 'GUILD_MEMBER_ADD', err }); }

    res.json({ code: 'OK', guildId: vanityGuild.id });
    return;
  }

  if (invite.expiresAt && invite.expiresAt < new Date()) {
    res.status(410).json({ code: 'EXPIRED', message: 'Invite has expired' }); return;
  }
  if (invite.maxUses && invite.uses >= invite.maxUses) {
    res.status(410).json({ code: 'EXHAUSTED', message: 'Invite has reached max uses' }); return;
  }

  // Check if guild is locked (raid protection)
  const guildResult = await db.execute(sql`SELECT locked_at, raid_protection_enabled FROM guilds WHERE id = ${invite.guildId}`);
  const guildRow = toRows<{ locked_at: string | null; raid_protection_enabled: boolean }>(guildResult)[0];
  if (guildRow && guildRow.locked_at) {
    res.status(403).json({ code: 'GUILD_LOCKED', message: 'This server is currently locked' }); return;
  }

  // Raid detection
  if (guildRow && guildRow.raid_protection_enabled) {
    const key = `raid:joins:${invite.guildId}`;
    const count = await redis.incr(key);
    await redis.expire(key, 10); // Always set TTL to avoid leaked keys
    if (count > 10) {
      await db.execute(sql`UPDATE guilds SET locked_at = now() WHERE id = ${invite.guildId}`);
      getIO().to(`guild:${invite.guildId}`).emit('GUILD_LOCKDOWN_START', { guildId: invite.guildId });
      res.status(403).json({ code: 'GUILD_LOCKED', message: 'Server locked due to raid detection' }); return;
    }
  }

  // Check ban
  const [ban] = await db.select({ id: guildBans.id }).from(guildBans)
    .where(and(eq(guildBans.guildId, invite.guildId), eq(guildBans.userId, req.userId!))).limit(1);
  if (ban) { res.status(403).json({ code: 'BANNED', message: 'You are banned from this guild' }); return; }

  // Check already a member
  const [existing] = await db.select({ id: guildMembers.id }).from(guildMembers)
    .where(and(eq(guildMembers.guildId, invite.guildId), eq(guildMembers.userId, req.userId!))).limit(1);
  if (existing) { res.json({ code: 'ALREADY_MEMBER', guildId: invite.guildId }); return; }

  // Join guild
  await db.insert(guildMembers).values({ guildId: invite.guildId, userId: req.userId! });
  await db.update(guilds).set({ memberCount: sql`${guilds.memberCount} + 1` }).where(eq(guilds.id, invite.guildId));

  // Increment uses
  await db.update(guildInvites).set({ uses: invite.uses + 1 }).where(eq(guildInvites.code, code));

  // Get user info for socket event
  const [user] = await db.select({ id: users.id, username: users.username, displayName: users.displayName, avatarHash: users.avatarHash })
    .from(users).where(eq(users.id, req.userId!)).limit(1);

  try {
    getIO().to(`guild:${invite.guildId}`).emit('GUILD_MEMBER_ADD', { guildId: invite.guildId, user });
  } catch (err) { logger.debug({ msg: 'socket emit failed', event: 'GUILD_MEMBER_ADD', err }); }

  // Record activity event
  const [guildInfo] = await db.select({ name: guilds.name }).from(guilds).where(eq(guilds.id, invite.guildId)).limit(1);
  recordActivity(req.userId!, 'joined_server', { guildId: invite.guildId, guildName: guildInfo?.name ?? 'Unknown' });

  res.json({ code: 'OK', guildId: invite.guildId });
});

/** DELETE /api/v1/invites/:code — revoke invite */
invitesRouter.delete('/invites/:code', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { code } = req.params as Record<string, string>;
  const [invite] = await db.select().from(guildInvites).where(eq(guildInvites.code, code)).limit(1);
  if (!invite) { res.status(404).json({ code: 'NOT_FOUND', message: 'Invite not found' }); return; }

  // Only creator or guild owner can revoke
  const [guild] = await db.select({ ownerId: guilds.ownerId }).from(guilds).where(eq(guilds.id, invite.guildId)).limit(1);
  if (invite.createdBy !== req.userId && guild?.ownerId !== req.userId) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Not authorized' }); return;
  }

  await db.delete(guildInvites).where(eq(guildInvites.code, code));
  res.json({ code: 'OK', message: 'Invite revoked' });
});

/** DELETE /api/v1/guilds/:guildId/invites/:code — revoke invite (MANAGE_GUILD perm) */
invitesRouter.delete('/guilds/:guildId/invites/:code', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId, code } = req.params as Record<string, string>;

  if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission' }); return;
  }

  const [invite] = await db.select().from(guildInvites)
    .where(and(eq(guildInvites.code, code), eq(guildInvites.guildId, guildId))).limit(1);
  if (!invite) { res.status(404).json({ code: 'NOT_FOUND', message: 'Invite not found' }); return; }

  await db.delete(guildInvites).where(eq(guildInvites.code, code));
  res.json({ code: 'OK', message: 'Invite revoked' });
});
