/**
 * routes/federation.ts — Federation HTTP endpoints.
 * All routes are mounted at /api/v1/federation.
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/index';
import { federatedInstances } from '../db/schema/federation-instances';
import { federationActivities } from '../db/schema/federation-activities';
import { remoteUsers } from '../db/schema/remote-users';
import { remoteGuilds } from '../db/schema/remote-guilds';
import { instanceBlocks } from '../db/schema/instance-blocks';
import { users } from '../db/schema/users';
import { guilds } from '../db/schema/guilds';
import { eq, and, desc, sql, ilike, or, notInArray } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { requireFederationAuth } from '../middleware/federation-auth';
import { federationSanitizeMiddleware, sanitizeFederationContent } from '../middleware/federation-sanitize';
import { isFederationEnabled, getFederationFlags, getInstanceDomain } from '../federation/index';
import { getPublicKeyPem, getKeyId } from '../federation/crypto';
import { recordInboundActivity } from '../federation/activities';
import { parseFederationAddress, createShadowUser } from '../federation/user-resolver';
import { exportAccount, verifyImportSignature, startImport, ExportData } from '../federation/export-import';
import { assertNotPrivateHost } from '../lib/ssrf-guard';
import { logger } from '../lib/logger';

export const federationRouter = Router();

/**
 * getFederationInstanceId — Extract the federation instance ID attached by
 * `requireFederationAuth` middleware. Avoids `(req as any)` casts throughout.
 */
function getFederationInstanceId(req: Request): string {
  return (req as Request & { federationInstanceId: string }).federationInstanceId;
}

// ---------------------------------------------------------------------------
// Well-known endpoint (no auth — public discovery)
// ---------------------------------------------------------------------------

/**
 * GET /.well-known/gratonite — Instance discovery endpoint.
 * Returns the instance's public identity, version, and federation endpoints.
 * NOTE: This is mounted at the app level, not under /api/v1/federation.
 */
export function wellKnownHandler(_req: Request, res: Response): void {
  if (!isFederationEnabled()) {
    res.status(404).json({ error: 'Federation not enabled' });
    return;
  }

  const domain = getInstanceDomain();
  let publicKeyPem: string;
  let keyId: string;
  try {
    publicKeyPem = getPublicKeyPem();
    keyId = getKeyId();
  } catch (err) {
    logger.debug({ msg: 'federation keys not initialized', err });
    res.status(503).json({ error: 'Federation not initialized' });
    return;
  }

  res.json({
    domain,
    publicKeyPem,
    keyId,
    softwareVersion: process.env.npm_package_version || '1.0.0',
    endpoints: {
      inbox: `/api/v1/federation/inbox`,
      users: `/api/v1/federation/users`,
      guilds: `/api/v1/federation/guilds`,
      sync: `/api/v1/federation/sync`,
    },
    federation: {
      protocol: 'gratonite-federation/v1',
      features: getFederationFlags(),
    },
  });
}

// ---------------------------------------------------------------------------
// Instance handshake
// ---------------------------------------------------------------------------

/**
 * POST /federation/handshake — Initiate or respond to an instance handshake.
 * The calling instance sends its identity; we verify and store it.
 */
federationRouter.post('/handshake', async (req: Request, res: Response) => {
  if (!isFederationEnabled()) {
    res.status(503).json({ code: 'FEDERATION_DISABLED', message: 'Federation is not enabled' });
    return;
  }

  const { instanceUrl, publicKeyPem, softwareVersion } = req.body as {
    instanceUrl?: string;
    publicKeyPem?: string;
    softwareVersion?: string;
  };

  if (!instanceUrl || !publicKeyPem) {
    res.status(400).json({ code: 'MISSING_FIELDS', message: 'instanceUrl and publicKeyPem are required' });
    return;
  }

  // Validate URL format
  let baseUrl: string;
  try {
    const parsed = new URL(instanceUrl);
    baseUrl = `${parsed.protocol}//${parsed.host}`;
  } catch (err) {
    logger.debug({ msg: 'invalid federation instanceUrl', err });
    res.status(400).json({ code: 'INVALID_URL', message: 'Invalid instanceUrl format' });
    return;
  }

  // SSRF protection: resolve the hostname and block private IPs before fetching
  try {
    const parsedUrl = new URL(baseUrl);
    await assertNotPrivateHost(parsedUrl.hostname);
  } catch (ssrfErr: any) {
    res.status(400).json({ code: 'SSRF_BLOCKED', message: `Blocked: ${ssrfErr.message}` });
    return;
  }

  // Verify the remote instance by fetching its well-known endpoint
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    const wkResp = await fetch(`${baseUrl}/.well-known/gratonite`, {
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!wkResp.ok) {
      res.status(400).json({ code: 'VERIFICATION_FAILED', message: 'Could not fetch remote instance well-known endpoint' });
      return;
    }

    const wkData = await wkResp.json() as { publicKeyPem?: string; domain?: string };

    // Verify the public key matches
    if (wkData.publicKeyPem !== publicKeyPem) {
      res.status(400).json({ code: 'KEY_MISMATCH', message: 'Public key does not match well-known endpoint' });
      return;
    }
  } catch (err) {
    logger.debug({ msg: 'federation remote verification failed', err });
    res.status(400).json({ code: 'VERIFICATION_FAILED', message: 'Could not reach remote instance for verification' });
    return;
  }

  // Upsert the instance record
  const [existing] = await db
    .select()
    .from(federatedInstances)
    .where(eq(federatedInstances.baseUrl, baseUrl))
    .limit(1);

  if (existing) {
    await db.update(federatedInstances)
      .set({
        publicKeyPem,
        publicKeyId: `${baseUrl}/api/v1/federation/actor#main-key`,
        softwareVersion: softwareVersion ?? existing.softwareVersion,
        lastSeenAt: new Date(),
        failedHeartbeats: 0,
        updatedAt: new Date(),
      })
      .where(eq(federatedInstances.id, existing.id));
  } else {
    await db.insert(federatedInstances).values({
      baseUrl,
      publicKeyPem,
      publicKeyId: `${baseUrl}/api/v1/federation/actor#main-key`,
      trustLevel: 'auto_discovered',
      status: 'active',
      softwareVersion: softwareVersion ?? null,
      lastSeenAt: new Date(),
    });
  }

  // Return our own identity
  const domain = getInstanceDomain();
  res.json({
    type: 'InstanceHelloAck',
    instanceUrl: `https://${domain}`,
    publicKeyPem: getPublicKeyPem(),
    softwareVersion: process.env.npm_package_version || '1.0.0',
  });
});

// ---------------------------------------------------------------------------
// Federation inbox (receives signed activities from remote instances)
// ---------------------------------------------------------------------------

federationRouter.post('/inbox',
  requireFederationAuth,
  federationSanitizeMiddleware,
  async (req: Request, res: Response) => {
    const instanceId = getFederationInstanceId(req);

    const { type, payload } = req.body as {
      type?: string;
      origin?: string;
      timestamp?: string;
      payload?: Record<string, unknown>;
    };

    if (!type || !payload) {
      res.status(400).json({ code: 'INVALID_ACTIVITY', message: 'Missing type or payload' });
      return;
    }

    // Record inbound activity
    await recordInboundActivity(instanceId, type, payload);

    // Process by activity type
    switch (type) {
      case 'InstanceHello':
        res.json({ type: 'InstanceHelloAck', status: 'ok' });
        return;

      case 'GuildJoinRequest': {
        // A remote user wants to join a local guild
        const flags = getFederationFlags();
        if (!flags.allowJoins) {
          res.status(403).json({ code: 'JOINS_DISABLED', message: 'Remote joins are disabled' });
          return;
        }
        // TODO: Process guild join request — create shadow user + guild member
        res.json({ type: 'GuildJoinApproved', status: 'pending' });
        return;
      }

      case 'MessageCreate': {
        // A remote instance is forwarding a message to a local guild
        const sanitized = sanitizeFederationContent(payload);
        // TODO: Insert message from federated source
        res.json({ status: 'accepted' });
        return;
      }

      case 'GuildLeave': {
        // A remote user is leaving a local guild
        // TODO: Remove shadow user from guild members
        res.json({ status: 'ok' });
        return;
      }

      case 'UserProfileSync': {
        // Remote instance is syncing a user profile update
        // TODO: Update shadow user profile
        res.json({ status: 'ok' });
        return;
      }

      case 'ReplicaAck': {
        // Replica acknowledged sync cursor
        res.json({ status: 'ok' });
        return;
      }

      default:
        res.json({ status: 'ok', message: `Activity type '${type}' acknowledged` });
    }
  },
);

// ---------------------------------------------------------------------------
// Federation user lookup (instance-to-instance, requires federation auth)
// ---------------------------------------------------------------------------

federationRouter.get('/users/:username', requireFederationAuth, async (req: Request, res: Response) => {
  const username = req.params.username as string;

  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarHash: users.avatarHash,
      bio: users.bio,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (!user) {
    res.status(404).json({ code: 'USER_NOT_FOUND', message: 'User not found' });
    return;
  }

  const domain = getInstanceDomain();
  res.json({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarHash ? `/uploads/avatars/${user.avatarHash}` : null,
    bio: user.bio,
    federationAddress: `${user.username}@${domain}`,
    createdAt: user.createdAt,
  });
});

// ---------------------------------------------------------------------------
// Federation guild listing (instance-to-instance)
// ---------------------------------------------------------------------------

federationRouter.get('/guilds', requireFederationAuth, async (req: Request, res: Response) => {
  const discoverable = await db
    .select({
      id: guilds.id,
      name: guilds.name,
      description: guilds.description,
      iconHash: guilds.iconHash,
      memberCount: guilds.memberCount,
      category: guilds.category,
    })
    .from(guilds)
    .where(eq(guilds.isDiscoverable, true))
    .limit(50);

  const domain = getInstanceDomain();
  res.json(discoverable.map(g => ({
    ...g,
    federationAddress: `${g.id}@${domain}`,
    iconUrl: g.iconHash ? `/uploads/icons/${g.iconHash}` : null,
  })));
});

// ---------------------------------------------------------------------------
// Heartbeat (instance-to-instance health check)
// ---------------------------------------------------------------------------

federationRouter.post('/heartbeat', requireFederationAuth, (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Admin federation management (requires auth + admin)
// ---------------------------------------------------------------------------

federationRouter.get('/admin/instances', requireAuth, async (req: Request, res: Response) => {
  // Verify admin
  const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, req.userId!)).limit(1);
  if (!user?.isAdmin) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Admin access required' });
    return;
  }

  const instances = await db
    .select()
    .from(federatedInstances)
    .orderBy(desc(federatedInstances.lastSeenAt))
    .limit(100);

  res.json(instances);
});

federationRouter.patch('/admin/instances/:instanceId', requireAuth, async (req: Request, res: Response) => {
  const instanceId = req.params.instanceId as string;

  const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, req.userId!)).limit(1);
  if (!user?.isAdmin) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Admin access required' });
    return;
  }

  const { status, trustLevel } = req.body as { status?: string; trustLevel?: string };
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (status && ['active', 'suspended', 'blocked'].includes(status)) {
    updates.status = status;
  }
  if (trustLevel && ['verified', 'manually_trusted', 'auto_discovered'].includes(trustLevel)) {
    updates.trustLevel = trustLevel;
  }

  await db.update(federatedInstances)
    .set(updates)
    .where(eq(federatedInstances.id, instanceId));

  res.json({ status: 'updated' });
});

federationRouter.delete('/admin/instances/:instanceId', requireAuth, async (req: Request, res: Response) => {
  const instanceId = req.params.instanceId as string;

  const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, req.userId!)).limit(1);
  if (!user?.isAdmin) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Admin access required' });
    return;
  }

  await db.delete(federatedInstances).where(eq(federatedInstances.id, instanceId));
  res.json({ status: 'deleted' });
});

// Admin: federation stats
federationRouter.get('/admin/stats', requireAuth, async (req: Request, res: Response) => {
  const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, req.userId!)).limit(1);
  if (!user?.isAdmin) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Admin access required' });
    return;
  }

  const [instanceCount] = await db.select({ count: sql<number>`count(*)` }).from(federatedInstances);
  const [activeCount] = await db.select({ count: sql<number>`count(*)` }).from(federatedInstances).where(eq(federatedInstances.status, 'active'));
  const [pendingActivities] = await db.select({ count: sql<number>`count(*)` }).from(federationActivities).where(eq(federationActivities.status, 'pending'));
  const [remoteUserCount] = await db.select({ count: sql<number>`count(*)` }).from(remoteUsers);
  const [remoteGuildCount] = await db.select({ count: sql<number>`count(*)` }).from(remoteGuilds);

  res.json({
    instances: {
      total: Number(instanceCount.count),
      active: Number(activeCount.count),
    },
    activities: {
      pending: Number(pendingActivities.count),
    },
    remoteUsers: Number(remoteUserCount.count),
    remoteGuilds: Number(remoteGuildCount.count),
  });
});

// Admin: activity queue
federationRouter.get('/admin/queue', requireAuth, async (req: Request, res: Response) => {
  const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, req.userId!)).limit(1);
  if (!user?.isAdmin) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Admin access required' });
    return;
  }

  const activities = await db
    .select()
    .from(federationActivities)
    .orderBy(desc(federationActivities.createdAt))
    .limit(50);

  res.json(activities);
});

// Admin: instance blocks
federationRouter.get('/admin/blocks', requireAuth, async (req: Request, res: Response) => {
  const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, req.userId!)).limit(1);
  if (!user?.isAdmin) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Admin access required' });
    return;
  }

  const blocks = await db.select().from(instanceBlocks).orderBy(desc(instanceBlocks.createdAt));
  res.json(blocks);
});

federationRouter.post('/admin/blocks', requireAuth, async (req: Request, res: Response) => {
  const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, req.userId!)).limit(1);
  if (!user?.isAdmin) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Admin access required' });
    return;
  }

  const { domain, reason, expiresAt } = req.body as { domain?: string; reason?: string; expiresAt?: string };
  if (!domain) {
    res.status(400).json({ code: 'MISSING_DOMAIN', message: 'domain is required' });
    return;
  }

  const [block] = await db.insert(instanceBlocks).values({
    blockedDomain: domain,
    blockedBy: req.userId!,
    reason: reason ?? null,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
  }).returning();

  res.status(201).json(block);
});

federationRouter.delete('/admin/blocks/:blockId', requireAuth, async (req: Request, res: Response) => {
  const blockId = req.params.blockId as string;

  const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, req.userId!)).limit(1);
  if (!user?.isAdmin) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Admin access required' });
    return;
  }

  await db.delete(instanceBlocks).where(eq(instanceBlocks.id, blockId));
  res.json({ status: 'deleted' });
});

// ---------------------------------------------------------------------------
// Discover Registry — Self-hosted instances register their guilds here
// ---------------------------------------------------------------------------

/**
 * POST /federation/discover/register — Remote instance pushes discoverable guilds.
 * Requires federation auth (HTTP Signature).
 */
federationRouter.post('/discover/register', requireFederationAuth, async (req: Request, res: Response) => {
  const instanceId = getFederationInstanceId(req);

  const { guilds: guildList } = req.body as {
    guilds?: Array<{
      id: string;
      name: string;
      description?: string;
      iconUrl?: string;
      bannerUrl?: string;
      memberCount: number;
      onlineCount?: number;
      category?: string;
      tags?: string[];
    }>;
  };

  if (!Array.isArray(guildList) || guildList.length === 0) {
    res.status(400).json({ code: 'INVALID_PAYLOAD', message: 'guilds array is required and must not be empty' });
    return;
  }

  // Limit to 100 guilds per instance
  const guildsToRegister = guildList.slice(0, 100);

  // Get instance info for trust-based auto-approval
  const [instance] = await db
    .select({ trustLevel: federatedInstances.trustLevel, baseUrl: federatedInstances.baseUrl })
    .from(federatedInstances)
    .where(eq(federatedInstances.id, instanceId))
    .limit(1);

  // Auto-approve guilds from any active instance that completed the handshake.
  // Admins can always manually reject via the admin panel.
  const autoApprove = !!instance;

  // Sanitize and validate URLs
  const isValidHttpsUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      if (['javascript:', 'data:', 'vbscript:', 'file:'].some(s => url.toLowerCase().startsWith(s))) return false;
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch (err) { logger.debug({ msg: 'URL validation failed', err }); return false; }
  };

  const sanitizeText = (text: string, maxLen: number): string =>
    text.replace(/<[^>]*>/g, '').slice(0, maxLen);

  let registered = 0;
  const registeredIds: string[] = [];

  for (const guild of guildsToRegister) {
    if (!guild.id || !guild.name) continue;

    const domain = instance ? new URL(instance.baseUrl).hostname : 'unknown';
    const federationAddress = `${guild.id}@${domain}`;

    const sanitizedName = sanitizeText(guild.name, 100);
    const sanitizedDesc = guild.description ? sanitizeText(guild.description, 1000) : null;
    const sanitizedIcon = guild.iconUrl && isValidHttpsUrl(guild.iconUrl) ? guild.iconUrl.slice(0, 500) : null;
    const sanitizedBanner = guild.bannerUrl && isValidHttpsUrl(guild.bannerUrl) ? guild.bannerUrl.slice(0, 500) : null;
    const sanitizedTags = Array.isArray(guild.tags)
      ? guild.tags.slice(0, 10).map(t => sanitizeText(String(t), 30))
      : [];

    await db.insert(remoteGuilds)
      .values({
        instanceId,
        remoteGuildId: guild.id,
        federationAddress,
        name: sanitizedName,
        description: sanitizedDesc,
        iconUrl: sanitizedIcon,
        bannerUrl: sanitizedBanner,
        memberCount: Math.max(0, Math.min(guild.memberCount ?? 0, 10_000_000)),
        onlineCount: Math.max(0, Math.min(guild.onlineCount ?? 0, 10_000_000)),
        category: guild.category ? sanitizeText(guild.category, 30) : null,
        tags: sanitizedTags,
        isApproved: autoApprove ?? false,
        updatedAt: new Date(),
        lastSyncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [remoteGuilds.instanceId, remoteGuilds.remoteGuildId],
        set: {
          federationAddress,
          name: sanitizedName,
          description: sanitizedDesc,
          iconUrl: sanitizedIcon,
          bannerUrl: sanitizedBanner,
          memberCount: Math.max(0, Math.min(guild.memberCount ?? 0, 10_000_000)),
          onlineCount: Math.max(0, Math.min(guild.onlineCount ?? 0, 10_000_000)),
          category: guild.category ? sanitizeText(guild.category, 30) : null,
          tags: sanitizedTags,
          isApproved: autoApprove ?? false,
          updatedAt: new Date(),
          lastSyncedAt: new Date(),
        },
      });

    registeredIds.push(guild.id);
    registered++;
  }

  // Remove stale guilds from this instance that weren't in the current payload
  let removed = 0;
  if (registeredIds.length > 0) {
    const stale = await db.delete(remoteGuilds)
      .where(and(
        eq(remoteGuilds.instanceId, instanceId),
        notInArray(remoteGuilds.remoteGuildId, registeredIds),
      ))
      .returning({ id: remoteGuilds.id });
    removed = stale.length;
  }

  // Mark instance as in Discover
  await db.update(federatedInstances)
    .set({ inDiscover: true, lastSeenAt: new Date() })
    .where(eq(federatedInstances.id, instanceId));

  res.json({ registered, removed });
});

/**
 * DELETE /federation/discover/unregister — Remove instance from Discover.
 */
federationRouter.delete('/discover/unregister', requireFederationAuth, async (req: Request, res: Response) => {
  const instanceId = getFederationInstanceId(req);

  await db.delete(remoteGuilds).where(eq(remoteGuilds.instanceId, instanceId));
  await db.update(federatedInstances)
    .set({ inDiscover: false })
    .where(eq(federatedInstances.id, instanceId));

  res.json({ status: 'unregistered' });
});

/**
 * GET /federation/discover/remote-guilds — Public listing for Discover page.
 * Requires regular auth (logged-in user browsing Discover).
 */
federationRouter.get('/discover/remote-guilds', requireAuth, async (req: Request, res: Response) => {
  const q = (req.query.q as string || '').trim();
  const category = (req.query.category as string || '').trim();
  const sort = (req.query.sort as string) || 'members';
  const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 50), 100);
  const offset = Math.max(0, parseInt(req.query.offset as string) || 0);

  // Build query: join remote_guilds with federated_instances
  const conditions = [
    eq(federatedInstances.status, 'active'),
    eq(federatedInstances.inDiscover, true),
    eq(remoteGuilds.isApproved, true),
  ];

  if (category) {
    conditions.push(eq(remoteGuilds.category, category));
  }

  if (q) {
    conditions.push(or(
      ilike(remoteGuilds.name, `%${q}%`),
      ilike(remoteGuilds.description, `%${q}%`),
    )!);
  }

  let orderBy: any;
  switch (sort) {
    case 'rating':
      orderBy = desc(remoteGuilds.averageRating);
      break;
    case 'recent':
      orderBy = desc(remoteGuilds.updatedAt);
      break;
    case 'members':
    default:
      orderBy = desc(remoteGuilds.memberCount);
      break;
  }

  const results = await db
    .select({
      id: remoteGuilds.id,
      remoteGuildId: remoteGuilds.remoteGuildId,
      federationAddress: remoteGuilds.federationAddress,
      name: remoteGuilds.name,
      description: remoteGuilds.description,
      iconUrl: remoteGuilds.iconUrl,
      bannerUrl: remoteGuilds.bannerUrl,
      memberCount: remoteGuilds.memberCount,
      onlineCount: remoteGuilds.onlineCount,
      category: remoteGuilds.category,
      tags: remoteGuilds.tags,
      averageRating: remoteGuilds.averageRating,
      totalRatings: remoteGuilds.totalRatings,
      instanceId: federatedInstances.id,
      instanceBaseUrl: federatedInstances.baseUrl,
      instanceTrustLevel: federatedInstances.trustLevel,
      instanceTrustScore: federatedInstances.trustScore,
      instanceSoftwareVersion: federatedInstances.softwareVersion,
      instanceLastSeenAt: federatedInstances.lastSeenAt,
    })
    .from(remoteGuilds)
    .innerJoin(federatedInstances, eq(remoteGuilds.instanceId, federatedInstances.id))
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  res.json(results.map(r => ({
    id: r.id,
    remoteGuildId: r.remoteGuildId,
    federationAddress: r.federationAddress,
    name: r.name,
    description: r.description,
    iconUrl: r.iconUrl,
    bannerUrl: r.bannerUrl,
    memberCount: r.memberCount,
    onlineCount: r.onlineCount,
    category: r.category,
    tags: Array.isArray(r.tags) ? r.tags : [],
    averageRating: r.averageRating,
    totalRatings: r.totalRatings,
    instance: {
      id: r.instanceId,
      baseUrl: r.instanceBaseUrl,
      trustLevel: r.instanceTrustLevel,
      trustScore: r.instanceTrustScore,
      softwareVersion: r.instanceSoftwareVersion,
      lastSeenAt: r.instanceLastSeenAt,
    },
  })));
});

/**
 * POST /federation/discover/remote-guilds/:remoteGuildId/join — Get join info for a remote guild.
 */
federationRouter.post('/discover/remote-guilds/:remoteGuildId/join', requireAuth, async (req: Request, res: Response) => {
  const remoteGuildId = req.params.remoteGuildId as string;

  const [guild] = await db
    .select({
      federationAddress: remoteGuilds.federationAddress,
      name: remoteGuilds.name,
      instanceBaseUrl: federatedInstances.baseUrl,
      instanceTrustLevel: federatedInstances.trustLevel,
    })
    .from(remoteGuilds)
    .innerJoin(federatedInstances, eq(remoteGuilds.instanceId, federatedInstances.id))
    .where(eq(remoteGuilds.id, remoteGuildId))
    .limit(1);

  if (!guild) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Remote guild not found' });
    return;
  }

  res.json({
    federationAddress: guild.federationAddress,
    instanceUrl: guild.instanceBaseUrl,
    joinUrl: `${guild.instanceBaseUrl}/app/`,
    guildName: guild.name,
    instanceTrustLevel: guild.instanceTrustLevel,
  });
});

/**
 * Admin: list all remote guilds in Discover (including unapproved).
 */
federationRouter.get('/admin/discover', requireAuth, async (req: Request, res: Response) => {
  const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, req.userId!)).limit(1);
  if (!user?.isAdmin) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Admin access required' });
    return;
  }

  const results = await db
    .select({
      id: remoteGuilds.id,
      remoteGuildId: remoteGuilds.remoteGuildId,
      name: remoteGuilds.name,
      description: remoteGuilds.description,
      iconUrl: remoteGuilds.iconUrl,
      memberCount: remoteGuilds.memberCount,
      category: remoteGuilds.category,
      isApproved: remoteGuilds.isApproved,
      updatedAt: remoteGuilds.updatedAt,
      instanceBaseUrl: federatedInstances.baseUrl,
      instanceTrustLevel: federatedInstances.trustLevel,
    })
    .from(remoteGuilds)
    .innerJoin(federatedInstances, eq(remoteGuilds.instanceId, federatedInstances.id))
    .orderBy(desc(remoteGuilds.updatedAt))
    .limit(200);

  res.json(results);
});

/**
 * Admin: approve or reject a remote guild listing.
 */
federationRouter.patch('/admin/discover/:remoteGuildId', requireAuth, async (req: Request, res: Response) => {
  const remoteGuildId = req.params.remoteGuildId as string;

  const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, req.userId!)).limit(1);
  if (!user?.isAdmin) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Admin access required' });
    return;
  }

  const { isApproved } = req.body as { isApproved?: boolean };
  if (typeof isApproved !== 'boolean') {
    res.status(400).json({ code: 'INVALID_PAYLOAD', message: 'isApproved (boolean) is required' });
    return;
  }

  await db.update(remoteGuilds)
    .set({ isApproved, updatedAt: new Date() })
    .where(eq(remoteGuilds.id, remoteGuildId));

  res.json({ status: 'updated' });
});

/**
 * Admin: remove a remote guild listing.
 */
federationRouter.delete('/admin/discover/:remoteGuildId', requireAuth, async (req: Request, res: Response) => {
  const remoteGuildId = req.params.remoteGuildId as string;

  const [user] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, req.userId!)).limit(1);
  if (!user?.isAdmin) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Admin access required' });
    return;
  }

  await db.delete(remoteGuilds).where(eq(remoteGuilds.id, remoteGuildId));
  res.json({ status: 'deleted' });
});

// ---------------------------------------------------------------------------
// User-facing federation endpoints (require regular auth)
// ---------------------------------------------------------------------------

// Resolve a federation address
federationRouter.get('/resolve/:address', requireAuth, async (req: Request, res: Response) => {
  const address = req.params.address as string;
  const parsed = parseFederationAddress(address);
  if (!parsed) {
    res.status(400).json({ code: 'INVALID_ADDRESS', message: 'Invalid federation address format. Use user@domain' });
    return;
  }

  // Check if it's a local user
  const domain = getInstanceDomain();
  if (parsed.domain === domain) {
    const [localUser] = await db
      .select({ id: users.id, username: users.username, displayName: users.displayName, avatarHash: users.avatarHash })
      .from(users)
      .where(eq(users.username, parsed.username))
      .limit(1);

    if (localUser) {
      res.json({ ...localUser, federationAddress: address, isLocal: true });
      return;
    }
  }

  // Check remote users cache
  const [cached] = await db
    .select()
    .from(remoteUsers)
    .where(eq(remoteUsers.federationAddress, address.startsWith('@') ? address.slice(1) : address))
    .limit(1);

  if (cached) {
    res.json({
      id: cached.id,
      username: cached.username,
      displayName: cached.displayName,
      avatarUrl: cached.avatarUrl,
      federationAddress: cached.federationAddress,
      isLocal: false,
    });
    return;
  }

  res.status(404).json({ code: 'NOT_FOUND', message: 'Could not resolve federation address' });
});

// Export account for portability
federationRouter.get('/export', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await exportAccount(req.userId!);
    res.json(result);
  } catch (err) {
    res.status(500).json({ code: 'EXPORT_FAILED', message: 'Account export failed' });
  }
});

// Import account
federationRouter.post('/import', requireAuth, async (req: Request, res: Response) => {
  const { data, signature } = req.body as { data?: ExportData; signature?: string };
  if (!data || !signature) {
    res.status(400).json({ code: 'MISSING_FIELDS', message: 'data and signature are required' });
    return;
  }

  // Verify signature
  const valid = await verifyImportSignature(data, signature);
  if (!valid) {
    res.status(400).json({ code: 'INVALID_SIGNATURE', message: 'Import signature verification failed. Ensure the source instance is known.' });
    return;
  }

  const importId = await startImport(req.userId!, data, signature);
  res.status(201).json({ importId, status: 'pending' });
});
