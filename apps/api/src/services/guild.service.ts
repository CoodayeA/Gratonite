/**
 * services/guild.service.ts — Business logic for core guild operations.
 *
 * Extracted from routes/guilds.ts to separate HTTP concerns from domain logic.
 * Route handlers validate input and translate service errors to HTTP responses.
 *
 * @module services/guild.service
 */

import { eq, and, sql, asc, ilike } from 'drizzle-orm';

import { db } from '../db/index';
import { guilds } from '../db/schema/guilds';
import { guildMembers } from '../db/schema/guilds';
import { channels } from '../db/schema/channels';
import { users } from '../db/schema/users';
import { roles, memberRoles, DEFAULT_PERMISSIONS, Permissions } from '../db/schema/roles';
import { guildMemberGroupMembers } from '../db/schema/member-groups';
import { guildMemberOnboarding } from '../db/schema/guild-onboarding';
import { guildTags } from '../db/schema/guild-tags';
import { getIO } from '../lib/socket-io';
import { logAuditEvent, AuditActionTypes } from '../lib/audit';
import { redis } from '../lib/redis';
import { recordActivity } from '../routes/activity';
import { dispatchEvent } from '../lib/webhook-dispatch';
import { hasPermission } from '../routes/roles';

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

/**
 * ServiceError — Thrown by service methods to signal a business-rule violation.
 * Route handlers catch these and translate `code` to an HTTP status.
 */
export class ServiceError extends Error {
  constructor(
    public code:
      | 'NOT_FOUND'
      | 'FORBIDDEN'
      | 'DUPLICATE_NAME'
      | 'VALIDATION_ERROR'
      | 'CONFLICT',
    message: string,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

// ---------------------------------------------------------------------------
// Helpers (private to service)
// ---------------------------------------------------------------------------

type PresenceStatus = 'online' | 'idle' | 'dnd' | 'invisible' | 'offline';

function normalizePresenceStatus(value: string): PresenceStatus {
  if (
    value === 'online' ||
    value === 'idle' ||
    value === 'dnd' ||
    value === 'invisible' ||
    value === 'offline'
  ) {
    return value;
  }
  return 'offline';
}

/**
 * Emit GROUP_KEY_ROTATION_NEEDED for every encrypted channel in a guild.
 */
async function emitKeyRotationForEncryptedChannels(
  guildId: string,
  reason: 'member_added' | 'member_removed',
): Promise<void> {
  try {
    const encryptedChannels = await db
      .select({ id: channels.id })
      .from(channels)
      .where(and(eq(channels.guildId, guildId), eq(channels.isEncrypted, true)));

    if (encryptedChannels.length === 0) return;

    const io = getIO();
    for (const ch of encryptedChannels) {
      io.to(`guild:${guildId}`).emit('GROUP_KEY_ROTATION_NEEDED', {
        channelId: ch.id,
        reason,
      });
    }
  } catch {
    // Non-critical — rotation will be triggered on next membership change
  }
}

// ---------------------------------------------------------------------------
// GuildService
// ---------------------------------------------------------------------------

export class GuildService {
  /**
   * 1. getUserGuilds — Return all guilds a user belongs to.
   */
  async getUserGuilds(userId: string) {
    return db
      .select({
        id: guilds.id,
        name: guilds.name,
        description: guilds.description,
        iconHash: guilds.iconHash,
        bannerHash: guilds.bannerHash,
        ownerId: guilds.ownerId,
        isDiscoverable: guilds.isDiscoverable,
        memberCount: guilds.memberCount,
        createdAt: guilds.createdAt,
        updatedAt: guilds.updatedAt,
      })
      .from(guilds)
      .innerJoin(guildMembers, eq(guildMembers.guildId, guilds.id))
      .where(eq(guildMembers.userId, userId));
  }

  /**
   * 2. createGuild — Create a guild with the caller as owner.
   *    Creates the @everyone role. Does NOT create default channels
   *    (the client handles that).
   */
  async createGuild(
    ownerId: string,
    data: { name: string; description?: string; isDiscoverable?: boolean },
  ) {
    // Check for duplicate guild name.
    const existing = await db
      .select({ id: guilds.id })
      .from(guilds)
      .where(sql`LOWER(${guilds.name}) = LOWER(${data.name})`)
      .limit(1);

    if (existing.length > 0) {
      throw new ServiceError('DUPLICATE_NAME', 'A server with this name already exists');
    }

    // Insert guild.
    const [guild] = await db
      .insert(guilds)
      .values({
        name: data.name,
        description: data.description ?? null,
        isDiscoverable: data.isDiscoverable ?? false,
        ownerId,
        memberCount: 1,
      })
      .returning();

    // Add creator as first member.
    await db.insert(guildMembers).values({
      guildId: guild.id,
      userId: ownerId,
    });

    // Create @everyone role with default permissions.
    await db.insert(roles).values({
      guildId: guild.id,
      name: '@everyone',
      position: 0,
      permissions: DEFAULT_PERMISSIONS,
    });

    return guild;
  }

  /**
   * 3. getGuildById — Get guild details. Verifies the caller is a member.
   */
  async getGuildById(guildId: string, userId: string) {
    const [guild] = await db
      .select()
      .from(guilds)
      .where(eq(guilds.id, guildId))
      .limit(1);

    if (!guild) {
      throw new ServiceError('NOT_FOUND', 'Guild not found');
    }

    const [membership] = await db
      .select({ id: guildMembers.id })
      .from(guildMembers)
      .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, userId)))
      .limit(1);

    if (!membership) {
      throw new ServiceError('FORBIDDEN', 'You are not a member of this guild');
    }

    return guild;
  }

  /**
   * 4. updateGuild — Update guild settings. Requires MANAGE_GUILD permission.
   */
  async updateGuild(
    guildId: string,
    userId: string,
    data: {
      name?: string;
      description?: string | null;
      isDiscoverable?: boolean;
      accentColor?: string | null;
      welcomeMessage?: string | null;
      rulesChannelId?: string | null;
      category?: string | null;
      tags?: string[];
      rulesText?: string | null;
      requireRulesAgreement?: boolean;
      raidProtectionEnabled?: boolean;
      publicStatsEnabled?: boolean;
      spotlightChannelId?: string | null;
      spotlightMessage?: string | null;
    },
  ) {
    // Verify membership
    const [membership] = await db
      .select({ id: guildMembers.id })
      .from(guildMembers)
      .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, userId)))
      .limit(1);

    if (!membership) {
      throw new ServiceError('FORBIDDEN', 'You are not a member of this guild');
    }

    if (!(await hasPermission(userId, guildId, Permissions.MANAGE_GUILD))) {
      throw new ServiceError('FORBIDDEN', 'Missing MANAGE_GUILD permission');
    }

    const updateData: Partial<typeof guilds.$inferInsert> = { updatedAt: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.isDiscoverable !== undefined) updateData.isDiscoverable = data.isDiscoverable;
    if (data.accentColor !== undefined) {
      updateData.accentColor =
        data.accentColor === null
          ? null
          : (data.accentColor.startsWith('#') ? data.accentColor : `#${data.accentColor}`).toLowerCase();
    }
    if (data.welcomeMessage !== undefined) updateData.welcomeMessage = data.welcomeMessage;
    if (data.rulesChannelId !== undefined) updateData.rulesChannelId = data.rulesChannelId;
    if (data.category !== undefined) {
      updateData.category = data.category === null ? null : data.category.toLowerCase().slice(0, 30);
    }
    if (data.rulesText !== undefined) updateData.rulesText = data.rulesText;
    if (data.requireRulesAgreement !== undefined) updateData.requireRulesAgreement = data.requireRulesAgreement;
    if (data.spotlightChannelId !== undefined) updateData.spotlightChannelId = data.spotlightChannelId;
    if (data.spotlightMessage !== undefined) updateData.spotlightMessage = data.spotlightMessage;
    if (data.publicStatsEnabled !== undefined) updateData.publicStatsEnabled = data.publicStatsEnabled;

    const [updated] = await db
      .update(guilds)
      .set(updateData)
      .where(eq(guilds.id, guildId))
      .returning();

    // Handle raid protection (column not in Drizzle schema yet — raw SQL)
    if (data.raidProtectionEnabled !== undefined) {
      await db.execute(
        sql`UPDATE guilds SET raid_protection_enabled = ${data.raidProtectionEnabled} WHERE id = ${guildId}`,
      );
    }

    // Update tags if provided
    if (data.tags !== undefined) {
      await db.delete(guildTags).where(eq(guildTags.guildId, guildId));
      if (data.tags.length > 0) {
        await db.insert(guildTags).values(
          data.tags.map((tag) => ({ guildId, tag: tag.toLowerCase().trim() })),
        );
      }
    }

    // Audit log
    const changes: Record<string, unknown> = {};
    if (data.name !== undefined) changes.name = data.name;
    if (data.description !== undefined) changes.description = data.description;
    if (data.isDiscoverable !== undefined) changes.isDiscoverable = data.isDiscoverable;
    if (data.accentColor !== undefined) changes.accentColor = data.accentColor;
    if (data.category !== undefined) changes.category = data.category;
    if (data.tags !== undefined) changes.tags = data.tags;
    logAuditEvent(guildId, userId, AuditActionTypes.GUILD_UPDATE, guildId, 'GUILD', changes);

    // Emit real-time guild update to all members
    try {
      getIO().to(`guild:${guildId}`).emit('GUILD_UPDATE', { guildId, ...updated });
    } catch {
      /* socket may not be initialised in tests */
    }

    return updated;
  }

  /**
   * 5. deleteGuild — Delete a guild. Only the owner may do this.
   */
  async deleteGuild(guildId: string, userId: string) {
    const [guild] = await db.select().from(guilds).where(eq(guilds.id, guildId)).limit(1);

    if (!guild) {
      throw new ServiceError('NOT_FOUND', 'Guild not found');
    }

    if (guild.ownerId !== userId) {
      throw new ServiceError('FORBIDDEN', 'Only the guild owner can perform this action');
    }

    // Emit guild delete to all members BEFORE deleting
    try {
      getIO().to(`guild:${guildId}`).emit('GUILD_DELETE', { guildId });
    } catch {
      /* socket may not be initialised in tests */
    }

    await db.transaction(async (tx) => {
      await tx.delete(guilds).where(eq(guilds.id, guildId));
    });
  }

  /**
   * 6. joinGuild — Join a discoverable guild.
   *    Returns { guild info, joined: boolean, alreadyMember: boolean }.
   */
  async joinGuild(userId: string, guildId: string) {
    const [guild] = await db
      .select({
        id: guilds.id,
        name: guilds.name,
        memberCount: guilds.memberCount,
        isDiscoverable: guilds.isDiscoverable,
      })
      .from(guilds)
      .where(eq(guilds.id, guildId))
      .limit(1);

    if (!guild) {
      throw new ServiceError('NOT_FOUND', 'Guild not found');
    }

    if (!guild.isDiscoverable) {
      throw new ServiceError('FORBIDDEN', 'This guild is private and requires an invite.');
    }

    const inserted = await db
      .insert(guildMembers)
      .values({ guildId, userId })
      .onConflictDoNothing()
      .returning({ id: guildMembers.id });

    const joined = inserted.length > 0;

    if (joined) {
      await db
        .update(guilds)
        .set({
          memberCount: sql`${guilds.memberCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(guilds.id, guildId));

      // Insert onboarding row
      await db
        .insert(guildMemberOnboarding)
        .values({ guildId, userId, completedAt: null })
        .onConflictDoNothing();

      // Trigger E2E key rotation
      await emitKeyRotationForEncryptedChannels(guildId, 'member_added');

      // Fetch joining user info for events
      const [joiningUser] = await db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarHash: users.avatarHash,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const io = getIO();
      io.to(`guild:${guildId}`).emit('GUILD_MEMBER_ADD', {
        guildId,
        user: joiningUser
          ? {
              id: joiningUser.id,
              username: joiningUser.username,
              displayName: joiningUser.displayName,
              avatarHash: joiningUser.avatarHash,
            }
          : { id: userId },
      });

      // Record activity
      recordActivity(userId, 'joined_server', { guildId, guildName: guild.name });

      // Dispatch to bots
      dispatchEvent(guildId, 'member_join', {
        userId,
        user: joiningUser
          ? {
              id: joiningUser.id,
              username: joiningUser.username,
              displayName: joiningUser.displayName,
            }
          : { id: userId },
      });
    }

    // Re-fetch for fresh memberCount
    const [fresh] = await db
      .select({
        id: guilds.id,
        name: guilds.name,
        memberCount: guilds.memberCount,
        iconHash: guilds.iconHash,
      })
      .from(guilds)
      .where(eq(guilds.id, guildId))
      .limit(1);

    const result = {
      id: fresh?.id ?? guild.id,
      name: fresh?.name ?? guild.name,
      memberCount: fresh?.memberCount ?? guild.memberCount,
      joined,
      alreadyMember: !joined,
    };

    // Notify the joining user to add guild to sidebar
    if (joined) {
      try {
        getIO()
          .to(`user:${userId}`)
          .emit('GUILD_JOINED', {
            guildId,
            guild: fresh ?? {
              id: guildId,
              name: guild.name,
              iconHash: null,
              memberCount: guild.memberCount + 1,
            },
          });
      } catch {
        /* socket may not be initialised in tests */
      }
    }

    return result;
  }

  /**
   * 7. leaveGuild — Current user leaves a guild voluntarily.
   *    Owners must transfer ownership first.
   */
  async leaveGuild(userId: string, guildId: string) {
    const [guild] = await db
      .select({ ownerId: guilds.ownerId })
      .from(guilds)
      .where(eq(guilds.id, guildId))
      .limit(1);

    if (!guild) {
      throw new ServiceError('NOT_FOUND', 'Guild not found');
    }

    if (guild.ownerId === userId) {
      throw new ServiceError('FORBIDDEN', 'Transfer ownership before leaving');
    }

    await db
      .delete(guildMembers)
      .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, userId)));

    // Decrement member count
    await db
      .update(guilds)
      .set({
        memberCount: sql`GREATEST(${guilds.memberCount} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(guilds.id, guildId));

    getIO().to(`guild:${guildId}`).emit('GUILD_MEMBER_REMOVE', { guildId, userId });
    getIO().to(`user:${userId}`).emit('GUILD_LEFT', { guildId });

    // Dispatch to bots
    dispatchEvent(guildId, 'member_leave', { userId });

    // Trigger E2E key rotation
    await emitKeyRotationForEncryptedChannels(guildId, 'member_removed');
  }

  /**
   * 8. kickMember — Kick a member from a guild. Requires KICK_MEMBERS permission.
   */
  async kickMember(guildId: string, actorId: string, targetId: string) {
    // Verify actor is a member
    const [actorMembership] = await db
      .select({ id: guildMembers.id })
      .from(guildMembers)
      .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, actorId)))
      .limit(1);

    if (!actorMembership) {
      throw new ServiceError('FORBIDDEN', 'You are not a member of this guild');
    }

    if (!(await hasPermission(actorId, guildId, Permissions.KICK_MEMBERS))) {
      throw new ServiceError('FORBIDDEN', 'Missing KICK_MEMBERS permission');
    }

    // Prevent self-kick
    if (targetId === actorId) {
      throw new ServiceError('VALIDATION_ERROR', 'You cannot kick yourself from the guild');
    }

    // Verify target is a member
    const [membership] = await db
      .select({ id: guildMembers.id })
      .from(guildMembers)
      .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, targetId)))
      .limit(1);

    if (!membership) {
      throw new ServiceError('NOT_FOUND', 'User is not a member of this guild');
    }

    // Delete the membership row
    await db
      .delete(guildMembers)
      .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, targetId)));

    // Decrement member count
    await db
      .update(guilds)
      .set({
        memberCount: sql`GREATEST(${guilds.memberCount} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(guilds.id, guildId));

    // Audit log
    logAuditEvent(guildId, actorId, AuditActionTypes.MEMBER_KICK, targetId, 'USER');

    // Trigger E2E key rotation
    await emitKeyRotationForEncryptedChannels(guildId, 'member_removed');
  }

  /**
   * 9. getMembers — Get guild members list with presence, roles, and groups.
   */
  async getMembers(
    guildId: string,
    userId: string,
    options?: {
      search?: string;
      status?: string;
      groupId?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    // Verify caller is a member
    const [callerMembership] = await db
      .select({ id: guildMembers.id })
      .from(guildMembers)
      .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, userId)))
      .limit(1);

    if (!callerMembership) {
      throw new ServiceError('FORBIDDEN', 'You are not a member of this guild');
    }

    const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);
    const offset = Math.max(options?.offset ?? 0, 0);
    const search = options?.search?.trim() ?? '';
    const statusFilter = options?.status?.trim().toLowerCase() ?? '';
    const groupIdFilter = options?.groupId?.trim() ?? '';
    const escapedSearch = search.replace(/[%_\\]/g, '\\$&');

    const rows = await db
      .select({
        id: guildMembers.id,
        userId: guildMembers.userId,
        username: users.username,
        displayName: users.displayName,
        avatarHash: users.avatarHash,
        nickname: guildMembers.nickname,
        joinedAt: guildMembers.joinedAt,
      })
      .from(guildMembers)
      .innerJoin(users, eq(users.id, guildMembers.userId))
      .where(
        search.length > 0
          ? and(
              eq(guildMembers.guildId, guildId),
              sql`(
                ${users.username} ILIKE ${`%${escapedSearch}%`}
                OR ${users.displayName} ILIKE ${`%${escapedSearch}%`}
                OR ${guildMembers.nickname} ILIKE ${`%${escapedSearch}%`}
              )`,
            )
          : eq(guildMembers.guildId, guildId),
      )
      .orderBy(asc(users.username));

    // Fetch role assignments
    const allMemberRoles = await db
      .select({ userId: memberRoles.userId, roleId: memberRoles.roleId })
      .from(memberRoles)
      .where(eq(memberRoles.guildId, guildId));

    const rolesByUser = new Map<string, string[]>();
    for (const mr of allMemberRoles) {
      const arr = rolesByUser.get(mr.userId) ?? [];
      arr.push(mr.roleId);
      rolesByUser.set(mr.userId, arr);
    }

    // Fetch group assignments
    const groupAssignments = await db
      .select({
        groupId: guildMemberGroupMembers.groupId,
        userId: guildMemberGroupMembers.userId,
      })
      .from(guildMemberGroupMembers)
      .where(eq(guildMemberGroupMembers.guildId, guildId));

    const groupIdsByUser = new Map<string, string[]>();
    for (const assignment of groupAssignments) {
      const arr = groupIdsByUser.get(assignment.userId) ?? [];
      arr.push(assignment.groupId);
      groupIdsByUser.set(assignment.userId, arr);
    }

    // Fetch presence from Redis
    const userIds = rows.map((row) => row.userId);
    const statusByUser = new Map<string, PresenceStatus>();
    const activityByUser = new Map<string, { name: string; type: string } | null>();

    if (userIds.length > 0) {
      try {
        const pipeline = redis.pipeline();
        for (const uid of userIds) {
          pipeline.get(`presence:${uid}`);
          pipeline.get(`presence:${uid}:activity`);
        }
        const pipelineResult = await pipeline.exec();
        userIds.forEach((uid, index) => {
          const redisStatus = pipelineResult?.[index * 2]?.[1] as string | null;
          statusByUser.set(uid, redisStatus ? normalizePresenceStatus(redisStatus) : 'offline');

          const activityValue = pipelineResult?.[index * 2 + 1]?.[1] as string | null;
          if (activityValue) {
            try {
              activityByUser.set(uid, JSON.parse(activityValue));
            } catch {
              /* ignore */
            }
          }
        });
      } catch {
        userIds.forEach((uid) => statusByUser.set(uid, 'offline'));
      }
    }

    const membersWithRoles = rows.map((row) => ({
      ...row,
      status: statusByUser.get(row.userId) ?? 'offline',
      activity: activityByUser.get(row.userId) ?? null,
      roles: rolesByUser.get(row.userId) ?? [],
      roleIds: rolesByUser.get(row.userId) ?? [],
      groupIds: groupIdsByUser.get(row.userId) ?? [],
    }));

    let filtered = membersWithRoles;
    if (statusFilter === 'online') {
      filtered = filtered.filter(
        (member) => member.status !== 'offline' && member.status !== 'invisible',
      );
    } else if (statusFilter === 'offline') {
      filtered = filtered.filter(
        (member) => member.status === 'offline' || member.status === 'invisible',
      );
    }
    if (groupIdFilter) {
      filtered = filtered.filter((member) => member.groupIds.includes(groupIdFilter));
    }

    return filtered.slice(offset, offset + limit);
  }

  /**
   * 10. transferOwnership — Transfer guild ownership to another member.
   */
  async transferOwnership(guildId: string, userId: string, newOwnerId: string) {
    // Verify current user is the owner
    const [guild] = await db.select().from(guilds).where(eq(guilds.id, guildId)).limit(1);

    if (!guild) {
      throw new ServiceError('NOT_FOUND', 'Guild not found');
    }

    if (guild.ownerId !== userId) {
      throw new ServiceError('FORBIDDEN', 'Only the guild owner can transfer ownership');
    }

    if (newOwnerId === userId) {
      throw new ServiceError('VALIDATION_ERROR', 'You are already the owner');
    }

    // Verify new owner is a member
    const [newOwnerMembership] = await db
      .select({ id: guildMembers.id })
      .from(guildMembers)
      .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, newOwnerId)))
      .limit(1);

    if (!newOwnerMembership) {
      throw new ServiceError('NOT_FOUND', 'Target user is not a member of this guild');
    }

    // Transfer ownership
    const [updated] = await db
      .update(guilds)
      .set({ ownerId: newOwnerId, updatedAt: new Date() })
      .where(eq(guilds.id, guildId))
      .returning();

    // Audit log
    logAuditEvent(guildId, userId, AuditActionTypes.GUILD_UPDATE, guildId, 'GUILD', {
      ownershipTransfer: { from: userId, to: newOwnerId },
    });

    // Emit update to all members
    try {
      getIO()
        .to(`guild:${guildId}`)
        .emit('GUILD_UPDATE', { guildId, ownerId: newOwnerId });
    } catch {
      /* socket may not be initialised in tests */
    }

    return updated;
  }
}

export const guildService = new GuildService();
