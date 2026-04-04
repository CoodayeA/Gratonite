import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index';
import { users } from '../db/schema/users';
import { adminAuditLog, adminTeamInvites } from '../db/schema/admin';
import { botListings, botReviews } from '../db/schema/bot-store';
import { guilds } from '../db/schema/guilds';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { logAdminAudit } from '../lib/admin-audit';
import {
  ADMIN_SCOPES,
  type AdminScope,
  FULL_ADMIN_SCOPES,
  grantAdminScopes,
  hasAdminScope,
  isPlatformAdmin,
  replaceAdminScopes,
} from '../lib/admin-scopes';
import { getSystemHealthSnapshot } from '../lib/systemHealth';

export const adminRouter = Router();

/** GET /api/v1/admin/system-health — disk, LiveKit probe, DB/Redis (platform admins only) */
adminRouter.get('/system-health', requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.userId || !(await isPlatformAdmin(req.userId))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Platform admin required' });
    return;
  }
  try {
    const snapshot = await getSystemHealthSnapshot();
    res.json(snapshot);
  } catch {
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to collect system health' });
  }
});

/** GET /api/v1/admin/system-health/history — last 12 snapshots from Redis sliding window */
adminRouter.get('/system-health/history', requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.userId || !(await isPlatformAdmin(req.userId))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Platform admin required' });
    return;
  }
  try {
    const { redis } = await import('../lib/redis');
    const raw = await redis.lrange('admin:health:history', 0, 11);
    const history = raw.map(s => { try { return JSON.parse(s); } catch { return null; } }).filter(Boolean);
    res.json({ history });
  } catch {
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to load health history' });
  }
});

const inviteTeamSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'moderator', 'support']),
});

const acceptInviteSchema = z.object({
  token: z.string().min(16).max(128),
});

const updateRoleSchema = z.object({
  role: z.enum(['admin', 'moderator', 'support']),
});

const updateDiscoverCurationSchema = z.object({
  isFeatured: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  discoverRank: z.number().int().min(0).max(999999).optional(),
});

const updatePortalSchema = z.object({
  isPinned: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  isPublic: z.boolean().optional(),
});

async function assertScope(req: Request, res: Response, scope: AdminScope): Promise<boolean> {
  if (!req.userId) {
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Authentication required' });
    return false;
  }

  if (!(await hasAdminScope(req.userId, scope))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Admin scope required' });
    return false;
  }

  return true;
}

function toAuditType(action: string): string {
  switch (action) {
    case 'BOT_LISTING_VERIFIED':
      return 'bot_approved';
    case 'BOT_LISTING_DELISTED':
    case 'BOT_REVIEW_DELETED':
      return 'bot_rejected';
    case 'TEAM_INVITE_SENT':
      return 'team_invited';
    default:
      return 'settings_changed';
  }
}

adminRouter.get('/team', requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!(await assertScope(req, res, ADMIN_SCOPES.TEAM_MANAGE))) return;

  const activeAdmins = await db
    .select({
      id: users.id,
      userId: users.id,
      username: users.username,
      displayName: users.displayName,
      email: users.email,
      avatarHash: users.avatarHash,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.isAdmin, true))
    .orderBy(desc(users.createdAt));

  const pendingInvites = await db
    .select({
      id: adminTeamInvites.id,
      email: adminTeamInvites.email,
      role: adminTeamInvites.role,
      createdAt: adminTeamInvites.createdAt,
    })
    .from(adminTeamInvites)
    .where(eq(adminTeamInvites.status, 'pending'))
    .orderBy(desc(adminTeamInvites.createdAt));

  const items = [
    ...activeAdmins.map((u) => ({
      id: u.id,
      userId: u.userId,
      name: u.displayName || u.username,
      username: u.username,
      email: u.email,
      role: 'admin',
      status: 'active',
      joinedAt: u.createdAt,
      avatarHash: u.avatarHash,
    })),
    ...pendingInvites.map((inv) => ({
      id: inv.id,
      userId: null,
      name: inv.email.split('@')[0],
      username: null,
      email: inv.email,
      role: inv.role,
      status: 'pending',
      joinedAt: inv.createdAt,
      avatarHash: null,
    })),
  ];

  res.status(200).json({ items });
});

adminRouter.post(
  '/team/invite',
  requireAuth,
  validate(inviteTeamSchema),
  async (req: Request, res: Response): Promise<void> => {
    if (!(await assertScope(req, res, ADMIN_SCOPES.TEAM_MANAGE))) return;

    const { email, role } = req.body as z.infer<typeof inviteTeamSchema>;
    const normalizedEmail = email.trim().toLowerCase();

    const [existingPending] = await db
      .select()
      .from(adminTeamInvites)
      .where(and(eq(adminTeamInvites.email, normalizedEmail), eq(adminTeamInvites.status, 'pending')))
      .limit(1);

    if (existingPending) {
      res.status(200).json({
        id: existingPending.id,
        email: existingPending.email,
        role: existingPending.role,
        status: existingPending.status,
        token: existingPending.token,
      });
      return;
    }

    const token = crypto.randomBytes(24).toString('hex');
    const [invite] = await db
      .insert(adminTeamInvites)
      .values({
        email: normalizedEmail,
        role,
        token,
        invitedBy: req.userId!,
      })
      .returning();

    await logAdminAudit({
      actorId: req.userId!,
      action: 'TEAM_INVITE_SENT',
      targetType: 'email',
      targetId: normalizedEmail,
      description: `Invited ${normalizedEmail} as ${role}`,
      metadata: { role },
    });

    res.status(201).json({
      id: invite.id,
      email: invite.email,
      role: invite.role,
      status: invite.status,
      token: invite.token,
    });
  },
);

adminRouter.post(
  '/team/accept',
  requireAuth,
  validate(acceptInviteSchema),
  async (req: Request, res: Response): Promise<void> => {
    const { token } = req.body as z.infer<typeof acceptInviteSchema>;

    const [me] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, req.userId!))
      .limit(1);

    if (!me) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'User not found' });
      return;
    }

    const [invite] = await db
      .select()
      .from(adminTeamInvites)
      .where(and(eq(adminTeamInvites.token, token), eq(adminTeamInvites.status, 'pending')))
      .limit(1);

    if (!invite) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Invite token is invalid or expired' });
      return;
    }

    if (invite.email.toLowerCase() !== me.email.toLowerCase()) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Invite email does not match your account email' });
      return;
    }

    const now = new Date();
    await db
      .update(adminTeamInvites)
      .set({
        status: 'accepted',
        invitedUserId: me.id,
        acceptedBy: me.id,
        acceptedAt: now,
        updatedAt: now,
      })
      .where(eq(adminTeamInvites.id, invite.id));

    if (invite.role === 'admin') {
      await db
        .update(users)
        .set({ isAdmin: true, updatedAt: now })
        .where(eq(users.id, me.id));
      await grantAdminScopes(me.id, FULL_ADMIN_SCOPES, me.id);
    }

    await logAdminAudit({
      actorId: me.id,
      action: 'TEAM_INVITE_ACCEPTED',
      targetType: 'invite',
      targetId: invite.id,
      description: `${me.email} accepted team invite as ${invite.role}`,
      metadata: { role: invite.role },
    });

    res.status(200).json({ ok: true, role: invite.role });
  },
);

adminRouter.patch(
  '/team/:userId',
  requireAuth,
  validate(updateRoleSchema),
  async (req: Request, res: Response): Promise<void> => {
    if (!(await assertScope(req, res, ADMIN_SCOPES.TEAM_MANAGE))) return;

    const { userId } = req.params as Record<string, string>;
    const { role } = req.body as z.infer<typeof updateRoleSchema>;
    const now = new Date();

    const [updated] = await db
      .update(users)
      .set({
        isAdmin: role === 'admin',
        updatedAt: now,
      })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        email: users.email,
        username: users.username,
        displayName: users.displayName,
        isAdmin: users.isAdmin,
      });

    if (!updated) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'User not found' });
      return;
    }

    if (role === 'admin') {
      await grantAdminScopes(userId, FULL_ADMIN_SCOPES, req.userId!);
    } else {
      await replaceAdminScopes(userId, []);
    }

    await logAdminAudit({
      actorId: req.userId!,
      action: 'TEAM_ROLE_UPDATED',
      targetType: 'user',
      targetId: userId,
      description: `Updated ${updated.email} role to ${role}`,
      metadata: { role },
    });

    res.status(200).json({
      id: updated.id,
      email: updated.email,
      username: updated.username,
      name: updated.displayName || updated.username,
      role,
      status: 'active',
      isAdmin: updated.isAdmin,
    });
  },
);

adminRouter.delete('/team/:userId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!(await assertScope(req, res, ADMIN_SCOPES.TEAM_MANAGE))) return;

  const { userId } = req.params as Record<string, string>;

  if (userId === req.userId) {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: 'You cannot remove your own admin access' });
    return;
  }

  const [updated] = await db
    .update(users)
    .set({ isAdmin: false, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning({ id: users.id, email: users.email });

  if (!updated) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'User not found' });
    return;
  }

  await replaceAdminScopes(userId, []);

  await logAdminAudit({
    actorId: req.userId!,
    action: 'TEAM_MEMBER_REMOVED',
    targetType: 'user',
    targetId: userId,
    description: `Removed ${updated.email} from admin team`,
  });

  res.status(200).json({ ok: true });
});

/**
 * PATCH /admin/users/:userId/promote — Promote a user to admin.
 * Only existing admins can promote others.
 */
adminRouter.patch('/users/:userId/promote', requireAuth, async (req: Request, res: Response): Promise<void> => {
  // Verify caller is admin
  const [caller] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, req.userId!)).limit(1);
  if (!caller?.isAdmin) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Admin access required' });
    return;
  }

  const { userId } = req.params as Record<string, string>;

  // Check target user exists
  const [target] = await db.select({ id: users.id, username: users.username, isAdmin: users.isAdmin }).from(users).where(eq(users.id, userId)).limit(1);
  if (!target) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'User not found' });
    return;
  }
  if (target.isAdmin) {
    res.status(400).json({ code: 'ALREADY_ADMIN', message: 'User is already an admin' });
    return;
  }

  await db.update(users).set({ isAdmin: true, updatedAt: new Date() }).where(eq(users.id, userId));
  await grantAdminScopes(userId, FULL_ADMIN_SCOPES, req.userId!);

  await logAdminAudit({
    actorId: req.userId!,
    action: 'USER_PROMOTED_TO_ADMIN',
    targetType: 'user',
    targetId: userId,
    description: `Promoted @${target.username} to admin`,
  });

  res.status(200).json({ ok: true, username: target.username });
});

adminRouter.get('/audit-log', requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!(await assertScope(req, res, ADMIN_SCOPES.AUDIT_READ))) return;

  const limit = Math.min(Number(req.query.limit) || 50, 500);
  const offset = Number(req.query.offset) || 0;

  const rows = await db
    .select({
      id: adminAuditLog.id,
      action: adminAuditLog.action,
      targetType: adminAuditLog.targetType,
      targetId: adminAuditLog.targetId,
      description: adminAuditLog.description,
      metadata: adminAuditLog.metadata,
      createdAt: adminAuditLog.createdAt,
      actorId: adminAuditLog.actorId,
      actorUsername: users.username,
      actorDisplayName: users.displayName,
    })
    .from(adminAuditLog)
    .innerJoin(users, eq(users.id, adminAuditLog.actorId))
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(limit)
    .offset(offset);

  res.status(200).json({
    items: rows.map((row) => ({
      id: row.id,
      type: toAuditType(row.action),
      action: row.action,
      description: row.description ?? '',
      target: row.targetId ?? row.targetType ?? '',
      targetType: row.targetType,
      actor: row.actorDisplayName || row.actorUsername,
      actorId: row.actorId,
      ip: 'N/A',
      timestamp: row.createdAt,
      metadata: row.metadata ?? null,
    })),
  });
});

adminRouter.get('/bot-store', requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!(await assertScope(req, res, ADMIN_SCOPES.BOT_MODERATE))) return;

  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;
  const status = (req.query.status as string | undefined)?.toLowerCase();
  const search = (req.query.search as string | undefined)?.trim();

  const conditions = [];
  if (status === 'approved') {
    conditions.push(and(eq(botListings.verified, true), eq(botListings.listed, true)));
  } else if (status === 'rejected') {
    conditions.push(eq(botListings.listed, false));
  } else if (status === 'pending') {
    conditions.push(and(eq(botListings.verified, false), eq(botListings.listed, true)));
  }

  if (search) {
    const pattern = `%${search.replace(/[%_\\]/g, '\\$&')}%`;
    conditions.push(
      or(
        ilike(botListings.name, pattern),
        ilike(botListings.shortDescription, pattern),
        ilike(users.username, pattern),
        ilike(users.displayName, pattern),
      ),
    );
  }

  const whereClause = conditions.length ? and(...conditions) : undefined;

  const items = await db
    .select({
      id: botListings.id,
      name: botListings.name,
      description: botListings.shortDescription,
      category: botListings.category,
      createdAt: botListings.createdAt,
      verified: botListings.verified,
      listed: botListings.listed,
      iconUrl: botListings.iconUrl,
      developerName: users.displayName,
      creatorName: users.username,
    })
    .from(botListings)
    .leftJoin(users, eq(users.id, botListings.creatorId))
    .where(whereClause)
    .orderBy(desc(botListings.createdAt))
    .limit(limit)
    .offset(offset);

  res.status(200).json({
    items: items.map((item) => ({
      ...item,
      status: !item.listed ? 'rejected' : item.verified ? 'approved' : 'pending',
    })),
  });
});

adminRouter.patch('/bot-store/:listingId/verify', requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!(await assertScope(req, res, ADMIN_SCOPES.BOT_MODERATE))) return;

  const { listingId } = req.params as Record<string, string>;
  const [updated] = await db
    .update(botListings)
    .set({
      verified: true,
      listed: true,
      updatedAt: new Date(),
    })
    .where(eq(botListings.id, listingId))
    .returning();

  if (!updated) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Bot listing not found' });
    return;
  }

  await logAdminAudit({
    actorId: req.userId!,
    action: 'BOT_LISTING_VERIFIED',
    targetType: 'bot_listing',
    targetId: listingId,
    description: `Verified bot listing ${updated.name}`,
  });

  res.status(200).json(updated);
});

adminRouter.patch('/bot-store/:listingId/delist', requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!(await assertScope(req, res, ADMIN_SCOPES.BOT_MODERATE))) return;

  const { listingId } = req.params as Record<string, string>;
  const [updated] = await db
    .update(botListings)
    .set({
      listed: false,
      updatedAt: new Date(),
    })
    .where(eq(botListings.id, listingId))
    .returning();

  if (!updated) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Bot listing not found' });
    return;
  }

  await logAdminAudit({
    actorId: req.userId!,
    action: 'BOT_LISTING_DELISTED',
    targetType: 'bot_listing',
    targetId: listingId,
    description: `Delisted bot listing ${updated.name}`,
  });

  res.status(200).json(updated);
});

adminRouter.patch(
  '/guilds/:guildId/discover',
  requireAuth,
  validate(updateDiscoverCurationSchema),
  async (req: Request, res: Response): Promise<void> => {
    if (!(await assertScope(req, res, ADMIN_SCOPES.DISCOVER_CURATE))) return;

    const { guildId } = req.params as Record<string, string>;
    const { isFeatured, isPinned, discoverRank } = req.body as z.infer<typeof updateDiscoverCurationSchema>;

    const patch: Partial<typeof guilds.$inferInsert> = { updatedAt: new Date() };
    if (isFeatured !== undefined) patch.isFeatured = isFeatured;
    if (isPinned !== undefined) patch.isPinned = isPinned;
    if (discoverRank !== undefined) patch.discoverRank = discoverRank;

    const [updated] = await db
      .update(guilds)
      .set(patch)
      .where(eq(guilds.id, guildId))
      .returning({
        id: guilds.id,
        isFeatured: guilds.isFeatured,
        isPinned: guilds.isPinned,
        discoverRank: guilds.discoverRank,
      });

    if (!updated) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Guild not found' });
      return;
    }

    await logAdminAudit({
      actorId: req.userId!,
      action: 'DISCOVER_CURATION_UPDATED',
      targetType: 'guild',
      targetId: guildId,
      description: 'Updated discover curation fields',
      metadata: { isFeatured, isPinned, discoverRank },
    });

    res.status(200).json(updated);
  },
);

adminRouter.get('/portals', requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!(await assertScope(req, res, ADMIN_SCOPES.DISCOVER_CURATE))) return;

  const rows = await db
    .select({
      id: guilds.id,
      name: guilds.name,
      description: guilds.description,
      iconHash: guilds.iconHash,
      memberCount: guilds.memberCount,
      isDiscoverable: guilds.isDiscoverable,
      isFeatured: guilds.isFeatured,
      isPinned: guilds.isPinned,
      discoverRank: guilds.discoverRank,
      createdAt: guilds.createdAt,
    })
    .from(guilds)
    .where(eq(guilds.isDiscoverable, true))
    .orderBy(guilds.discoverRank, guilds.name);

  res.status(200).json({ items: rows });
});

adminRouter.patch(
  '/portals/:guildId',
  requireAuth,
  validate(updatePortalSchema),
  async (req: Request, res: Response): Promise<void> => {
    if (!(await assertScope(req, res, ADMIN_SCOPES.DISCOVER_CURATE))) return;

    const { guildId } = req.params as Record<string, string>;
    const { isPinned, isFeatured, isPublic } = req.body as z.infer<typeof updatePortalSchema>;

    const patch: Partial<typeof guilds.$inferInsert> = { updatedAt: new Date() };
    if (isPinned !== undefined) patch.isPinned = isPinned;
    if (isFeatured !== undefined) patch.isFeatured = isFeatured;
    if (isPublic !== undefined) patch.isDiscoverable = isPublic;

    const [updated] = await db
      .update(guilds)
      .set(patch)
      .where(eq(guilds.id, guildId))
      .returning({
        id: guilds.id,
        name: guilds.name,
        isDiscoverable: guilds.isDiscoverable,
        isFeatured: guilds.isFeatured,
        isPinned: guilds.isPinned,
      });

    if (!updated) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Guild not found' });
      return;
    }

    await logAdminAudit({
      actorId: req.userId!,
      action: 'PORTAL_UPDATED',
      targetType: 'guild',
      targetId: guildId,
      description: `Updated portal settings for ${updated.name}`,
      metadata: { isPinned, isFeatured, isPublic },
    });

    res.status(200).json(updated);
  },
);

/** GET /admin/diagnostics/bundle — Collect system diagnostics for download */
adminRouter.get('/diagnostics/bundle', requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.userId || !(await isPlatformAdmin(req.userId))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Platform admin required' });
    return;
  }
  try {
    const snapshot = await getSystemHealthSnapshot();

    let errorCount24h = 0;
    let slowQueryCount = 0;
    try {
      const result = await db.execute<{ count: string }>(
        sql`SELECT COUNT(*) AS count FROM admin_audit_log WHERE created_at > NOW() - INTERVAL '24 hours' AND action LIKE '%ERROR%'`,
      );
      const rows = result as unknown as Array<{ count: string }>;
      errorCount24h = parseInt(rows[0]?.count ?? '0', 10) || 0;
    } catch { /* non-fatal */ }

    const bundle = {
      generatedAt: new Date().toISOString(),
      system: snapshot,
      errors24h: errorCount24h,
      slowQueries: slowQueryCount,
      activeConnections: 1,
      node: {
        version: process.version,
        platform: process.platform,
        arch: process.arch,
        uptime: Math.floor(process.uptime()),
        env: process.env.NODE_ENV ?? 'unknown',
      },
    };

    res.json(bundle);
  } catch {
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to generate diagnostics bundle' });
  }
});

/** GET /admin/upgrade/preflight — Run preflight checks before an upgrade */
adminRouter.get('/upgrade/preflight', requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.userId || !(await isPlatformAdmin(req.userId))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Platform admin required' });
    return;
  }
  try {
    const snapshot = await getSystemHealthSnapshot();
    const diskFreeMb = snapshot.disk?.freeMb ?? null;
    const diskOk = diskFreeMb !== null ? diskFreeMb > 2048 : null;

    let activeSessions = 0;
    try {
      const { redis } = await import('../lib/redis');
      const keys = await redis.keys('session:*');
      activeSessions = keys.length;
    } catch { /* non-fatal */ }

    const checks = [
      {
        id: 'disk',
        label: 'Disk space sufficient (>2 GB free)',
        ok: diskOk,
        value: diskFreeMb !== null ? `${diskFreeMb} MB free` : 'Unknown',
      },
      {
        id: 'db',
        label: 'Database connected',
        ok: snapshot.db.ok,
        value: snapshot.db.ok ? 'Connected' : 'Connection failed',
      },
      {
        id: 'redis',
        label: 'Redis connected',
        ok: snapshot.redis.ok,
        value: snapshot.redis.ok ? 'Connected' : 'Connection failed',
      },
      {
        id: 'sessions',
        label: 'Active sessions',
        ok: true,
        value: String(activeSessions),
        info: true,
      },
    ];

    const allOk = checks.filter(c => !c.info).every(c => c.ok === true);
    res.json({ checks, allOk, checkedAt: new Date().toISOString() });
  } catch {
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to run preflight checks' });
  }
});

/** GET /admin/upgrade/postflight — Verify post-upgrade state */
adminRouter.get('/upgrade/postflight', requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!req.userId || !(await isPlatformAdmin(req.userId))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Platform admin required' });
    return;
  }
  try {
    const snapshot = await getSystemHealthSnapshot();
    const checks = [
      { id: 'db', label: 'Database responding', ok: snapshot.db.ok },
      { id: 'redis', label: 'Redis responding', ok: snapshot.redis.ok },
      { id: 'api', label: 'API reachable', ok: true },
    ];
    const allOk = checks.every(c => c.ok);
    res.json({ checks, allOk, checkedAt: new Date().toISOString() });
  } catch {
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to run postflight checks' });
  }
});

adminRouter.delete('/bot-store/reviews/:reviewId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  if (!(await assertScope(req, res, ADMIN_SCOPES.BOT_MODERATE))) return;

  const { reviewId } = req.params as Record<string, string>;
  const [review] = await db.select().from(botReviews).where(eq(botReviews.id, reviewId)).limit(1);

  if (!review) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Review not found' });
    return;
  }

  await db.delete(botReviews).where(eq(botReviews.id, reviewId));

  await db
    .update(botListings)
    .set({
      reviewCount: sql`GREATEST(${botListings.reviewCount} - 1, 0)`,
      rating: sql`(SELECT COALESCE(AVG(rating), 0) FROM bot_reviews WHERE listing_id = ${review.listingId})`,
      updatedAt: new Date(),
    })
    .where(eq(botListings.id, review.listingId));

  await logAdminAudit({
    actorId: req.userId!,
    action: 'BOT_REVIEW_DELETED',
    targetType: 'bot_review',
    targetId: reviewId,
    description: `Deleted bot review ${reviewId}`,
    metadata: { listingId: review.listingId },
  });

  res.status(204).send();
});
