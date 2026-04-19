/**
 * services/channel.service.ts — Business logic for core channel operations.
 *
 * Extracted from routes/channels.ts to separate HTTP concerns from domain logic.
 * Route handlers validate input and translate service errors to HTTP responses.
 *
 * @module services/channel.service
 */

import { eq, and, asc, count, inArray } from 'drizzle-orm';

import { db } from '../db/index';
import { channels } from '../db/schema/channels';
import { channelPermissionOverrides } from '../db/schema/channel-overrides';
import { guilds } from '../db/schema/guilds';
import { Permissions, roles, memberRoles } from '../db/schema/roles';
import { getIO } from '../lib/socket-io';
import { logAuditEvent, AuditActionTypes } from '../lib/audit';
import { requireMember } from '../routes/guilds';
import { hasPermission } from '../routes/roles';
import { ServiceError } from './guild.service';

// ---------------------------------------------------------------------------
// Service methods
// ---------------------------------------------------------------------------

/**
 * getChannels — List all channels in a guild, filtered by VIEW_CHANNEL permission.
 *
 * Categories are visible if the user has MANAGE_CHANNELS or if at least one
 * child channel is visible.
 *
 * @throws {ServiceError} FORBIDDEN if user is not a guild member.
 */
export async function getChannels(guildId: string, userId: string) {
  await requireMember(guildId, userId);

  const rows = await db
    .select()
    .from(channels)
    .where(eq(channels.guildId, guildId))
    .orderBy(asc(channels.position));

  // Filter channels by VIEW_CHANNEL permission
  const visibleChannelIds = new Set<string>();
  const canManage = await hasPermission(userId, guildId, Permissions.MANAGE_CHANNELS);
  if (canManage) {
    return rows;
  }

  const [guild] = await db.select({ ownerId: guilds.ownerId }).from(guilds).where(eq(guilds.id, guildId)).limit(1);
  if (guild?.ownerId === userId) {
    return rows;
  }

  const [everyoneRole] = await db
    .select({ id: roles.id, permissions: roles.permissions })
    .from(roles)
    .where(and(eq(roles.guildId, guildId), eq(roles.name, '@everyone')))
    .limit(1);

  const userRoles = await db
    .select({ id: roles.id, permissions: roles.permissions })
    .from(memberRoles)
    .innerJoin(roles, eq(roles.id, memberRoles.roleId))
    .where(and(eq(memberRoles.userId, userId), eq(memberRoles.guildId, guildId)));

  let basePerms = BigInt(everyoneRole?.permissions ?? 0n);
  for (const r of userRoles) {
    basePerms |= BigInt(r.permissions);
  }

  if (basePerms & Permissions.ADMINISTRATOR) {
    return rows;
  }

  const channelIds = rows.map((r) => r.id);
  const allOverrides = channelIds.length > 0
    ? await db.select().from(channelPermissionOverrides).where(inArray(channelPermissionOverrides.channelId, channelIds))
    : [];

  const overridesByChannel = new Map<string, Map<string, { allow: bigint; deny: bigint }>>();
  for (const o of allOverrides) {
    let byTarget = overridesByChannel.get(o.channelId);
    if (!byTarget) {
      byTarget = new Map();
      overridesByChannel.set(o.channelId, byTarget);
    }
    byTarget.set(o.targetId, { allow: o.allow, deny: o.deny });
  }

  const canViewChannel = (channelId: string) => {
    let perms = basePerms;
    const overrideMap = overridesByChannel.get(channelId);
    if (!overrideMap) return (perms & Permissions.VIEW_CHANNEL) !== 0n;

    let roleAllow = 0n;
    let roleDeny = 0n;

    if (everyoneRole) {
      const everyoneOverride = overrideMap.get(everyoneRole.id);
      if (everyoneOverride) {
        roleAllow |= BigInt(everyoneOverride.allow);
        roleDeny |= BigInt(everyoneOverride.deny);
      }
    }

    for (const r of userRoles) {
      const override = overrideMap.get(r.id);
      if (override) {
        roleAllow |= BigInt(override.allow);
        roleDeny |= BigInt(override.deny);
      }
    }

    perms = (perms & ~roleDeny) | roleAllow;

    const memberOverride = overrideMap.get(userId);
    if (memberOverride) {
      perms = (perms & ~BigInt(memberOverride.deny)) | BigInt(memberOverride.allow);
    }

    return (perms & Permissions.VIEW_CHANNEL) !== 0n;
  };

  for (const ch of rows) {
    if (ch.type === 'GUILD_CATEGORY') {
      continue;
    }
    const canView = canViewChannel(ch.id);
    if (canView) {
      visibleChannelIds.add(ch.id);
      if (ch.parentId) visibleChannelIds.add(ch.parentId); // include parent category
    }
  }

  return rows.filter((ch: any) => visibleChannelIds.has(ch.id));
}

/**
 * createChannel — Create a new channel inside a guild.
 *
 * Requires MANAGE_CHANNELS permission. If createLinkedText is true and
 * the channel type is voice/stage, a companion text channel is also created.
 *
 * @throws {ServiceError} FORBIDDEN if user lacks MANAGE_CHANNELS.
 */
export async function createChannel(
  guildId: string,
  userId: string,
  data: {
    name: string;
    type: 'GUILD_TEXT' | 'GUILD_VOICE' | 'GUILD_CATEGORY' | 'GUILD_STAGE' | 'GUILD_FORUM' | 'GUILD_ANNOUNCEMENT' | 'GUILD_WIKI' | 'GUILD_QA' | 'GUILD_CONFESSION' | 'GUILD_TASK' | 'GUILD_DOCUMENT';
    parentId?: string;
    createLinkedText?: boolean;
  },
) {
  await requireMember(guildId, userId);

  if (!(await hasPermission(userId, guildId, Permissions.MANAGE_CHANNELS))) {
    throw new ServiceError('FORBIDDEN', 'Missing MANAGE_CHANNELS permission');
  }

  const { name, type, parentId, createLinkedText } = data;

  // Determine next position (append after existing channels in guild).
  const [{ value: existingCount }] = await db
    .select({ value: count() })
    .from(channels)
    .where(eq(channels.guildId, guildId));

  const [channel] = await db
    .insert(channels)
    .values({
      guildId,
      name,
      type,
      parentId: parentId ?? null,
      position: Number(existingCount),
    })
    .returning();

  // Audit log
  logAuditEvent(guildId, userId, AuditActionTypes.CHANNEL_CREATE, channel.id, 'CHANNEL', { name, type });

  // If requested, create a companion text channel for voice/stage channels
  if (createLinkedText && (type === 'GUILD_VOICE' || type === 'GUILD_STAGE')) {
    const [{ value: countAfter }] = await db
      .select({ value: count() })
      .from(channels)
      .where(eq(channels.guildId, guildId));

    const linkedName = `${name}-chat`;
    const [textChannel] = await db
      .insert(channels)
      .values({
        guildId,
        name: linkedName.slice(0, 100),
        type: 'GUILD_TEXT',
        parentId: parentId ?? null,
        position: Number(countAfter),
      })
      .returning();

    // Link the voice/stage channel to its text companion
    const [updated] = await db
      .update(channels)
      .set({ linkedTextChannelId: textChannel.id })
      .where(eq(channels.id, channel.id))
      .returning();

    logAuditEvent(guildId, userId, AuditActionTypes.CHANNEL_CREATE, textChannel.id, 'CHANNEL', { name: linkedName, type: 'GUILD_TEXT' });

    getIO().to(`guild:${guildId}`).emit('CHANNEL_CREATE', { ...updated, linkedTextChannel: textChannel });
    return { ...updated, linkedTextChannel: textChannel };
  }

  getIO().to(`guild:${guildId}`).emit('CHANNEL_CREATE', channel);
  return channel;
}

/**
 * updateChannel — Update channel settings (name, topic, nsfw, etc.).
 *
 * Requires MANAGE_CHANNELS permission. Only guild channels can be modified.
 *
 * @throws {ServiceError} NOT_FOUND if channel does not exist.
 * @throws {ServiceError} VALIDATION_ERROR if channel is a DM.
 * @throws {ServiceError} FORBIDDEN if user lacks MANAGE_CHANNELS.
 */
export async function updateChannel(
  channelId: string,
  userId: string,
  data: {
    name?: string;
    topic?: string | null;
    isNsfw?: boolean;
    rateLimitPerUser?: number;
    position?: number;
    backgroundUrl?: string | null;
    backgroundType?: 'image' | 'video' | null;
    linkedTextChannelId?: string | null;
    isAnnouncement?: boolean;
    forumTags?: Array<{ id: string; name: string; color?: string }>;
    isEncrypted?: boolean;
    attachmentsEnabled?: boolean;
    permissionSynced?: boolean;
    parentId?: string | null;
    archived?: boolean;
    autoArchiveDays?: number | null;
  },
) {
  const [channel] = await db
    .select()
    .from(channels)
    .where(eq(channels.id, channelId))
    .limit(1);

  if (!channel) {
    throw new ServiceError('NOT_FOUND', 'Channel not found');
  }

  if (!channel.guildId) {
    throw new ServiceError('VALIDATION_ERROR', 'Cannot modify a DM channel');
  }

  await requireMember(channel.guildId, userId);

  if (!(await hasPermission(userId, channel.guildId, Permissions.MANAGE_CHANNELS))) {
    throw new ServiceError('FORBIDDEN', 'Missing MANAGE_CHANNELS permission');
  }

  const updateData: Partial<typeof channels.$inferInsert> = { updatedAt: new Date() };
  if (data.name !== undefined) updateData.name = data.name;
  if (data.topic !== undefined) updateData.topic = data.topic;
  if (data.isNsfw !== undefined) updateData.isNsfw = data.isNsfw;
  if (data.rateLimitPerUser !== undefined) updateData.rateLimitPerUser = data.rateLimitPerUser;
  if (data.position !== undefined) updateData.position = data.position;
  if (data.backgroundUrl !== undefined) updateData.backgroundUrl = data.backgroundUrl;
  if (data.backgroundType !== undefined) updateData.backgroundType = data.backgroundType;
  if (data.linkedTextChannelId !== undefined) updateData.linkedTextChannelId = data.linkedTextChannelId;
  if (data.isAnnouncement !== undefined) updateData.isAnnouncement = data.isAnnouncement;
  if (data.forumTags !== undefined) updateData.forumTags = data.forumTags;
  if (data.isEncrypted !== undefined) updateData.isEncrypted = data.isEncrypted;
  if (data.attachmentsEnabled !== undefined) updateData.attachmentsEnabled = data.attachmentsEnabled;
  if (data.permissionSynced !== undefined) updateData.permissionSynced = data.permissionSynced;
  if (data.parentId !== undefined) updateData.parentId = data.parentId;
  if (data.archived !== undefined) updateData.archived = data.archived;
  if (data.autoArchiveDays !== undefined) updateData.autoArchiveDays = data.autoArchiveDays;

  const [updated] = await db
    .update(channels)
    .set(updateData)
    .where(eq(channels.id, channelId))
    .returning();

  // Audit log
  const changes: Record<string, unknown> = {};
  if (data.name !== undefined) changes.name = data.name;
  if (data.topic !== undefined) changes.topic = data.topic;
  if (data.isNsfw !== undefined) changes.isNsfw = data.isNsfw;
  logAuditEvent(channel.guildId, userId, AuditActionTypes.CHANNEL_UPDATE, channelId, 'CHANNEL', changes);

  // Broadcast background update to all members in the channel
  if (data.backgroundUrl !== undefined || data.backgroundType !== undefined) {
    try {
      const room = channel.guildId ? `guild:${channel.guildId}` : `channel:${channelId}`;
      getIO().to(room).emit('CHANNEL_BACKGROUND_UPDATED', {
        channelId,
        backgroundUrl: updated.backgroundUrl ?? null,
        backgroundType: updated.backgroundType ?? null,
      });
    } catch { /* socket may not be initialised in tests */ }
  }

  // Emit real-time channel update to guild members
  if (channel.guildId) {
    try {
      getIO().to(`guild:${channel.guildId}`).emit('CHANNEL_UPDATE', { ...updated, channelId, guildId: channel.guildId });
    } catch { /* socket may not be initialised in tests */ }
  }

  return updated;
}

/**
 * deleteChannel — Delete a guild channel.
 *
 * Requires MANAGE_CHANNELS permission. Cannot delete the last GUILD_TEXT
 * channel in a guild. Cannot delete DM channels.
 *
 * @throws {ServiceError} NOT_FOUND if channel does not exist.
 * @throws {ServiceError} VALIDATION_ERROR if channel is a DM or the last text channel.
 * @throws {ServiceError} FORBIDDEN if user lacks MANAGE_CHANNELS.
 */
export async function deleteChannel(channelId: string, userId: string) {
  const [channel] = await db
    .select()
    .from(channels)
    .where(eq(channels.id, channelId))
    .limit(1);

  if (!channel) {
    throw new ServiceError('NOT_FOUND', 'Channel not found');
  }

  if (!channel.guildId) {
    throw new ServiceError('VALIDATION_ERROR', 'Cannot delete a DM channel');
  }

  await requireMember(channel.guildId, userId);

  if (!(await hasPermission(userId, channel.guildId, Permissions.MANAGE_CHANNELS))) {
    throw new ServiceError('FORBIDDEN', 'Missing MANAGE_CHANNELS permission');
  }

  // Guard: do not delete the last text channel in the guild.
  if (channel.type === 'GUILD_TEXT') {
    const [{ value: textChannelCount }] = await db
      .select({ value: count() })
      .from(channels)
      .where(and(eq(channels.guildId, channel.guildId), eq(channels.type, 'GUILD_TEXT')));

    if (Number(textChannelCount) <= 1) {
      throw new ServiceError('VALIDATION_ERROR', 'Cannot delete the last text channel in a guild');
    }
  }

  // Audit log (before delete so we still have the channel data)
  logAuditEvent(channel.guildId, userId, AuditActionTypes.CHANNEL_DELETE, channelId, 'CHANNEL', { name: channel.name, type: channel.type });

  await db.delete(channels).where(eq(channels.id, channelId));

  // Emit real-time channel delete to guild members
  try {
    getIO().to(`guild:${channel.guildId}`).emit('CHANNEL_DELETE', { channelId, guildId: channel.guildId });
  } catch { /* socket may not be initialised in tests */ }

  return { channelId, guildId: channel.guildId };
}

/**
 * reorderChannels — Batch-update channel positions and parent categories.
 *
 * Requires MANAGE_CHANNELS permission. All referenced channels must belong
 * to the specified guild.
 *
 * @throws {ServiceError} FORBIDDEN if user lacks MANAGE_CHANNELS.
 * @throws {ServiceError} VALIDATION_ERROR if any channel does not belong to the guild.
 */
export async function reorderChannels(
  guildId: string,
  userId: string,
  positions: Array<{ id: string; position: number; parentId?: string | null }>,
) {
  await requireMember(guildId, userId);

  if (!(await hasPermission(userId, guildId, Permissions.MANAGE_CHANNELS))) {
    throw new ServiceError('FORBIDDEN', 'Missing MANAGE_CHANNELS permission');
  }

  if (positions.length === 0) {
    return;
  }

  // Verify all channel IDs belong to this guild
  const channelIds = positions.map((u) => u.id);
  const existingChannels = await db
    .select({ id: channels.id })
    .from(channels)
    .where(and(eq(channels.guildId, guildId), inArray(channels.id, channelIds)));

  const existingIds = new Set(existingChannels.map((c: any) => c.id));
  for (const u of positions) {
    if (!existingIds.has(u.id)) {
      throw new ServiceError('VALIDATION_ERROR', `Channel ${u.id} does not belong to this guild`);
    }
  }

  // Apply updates
  for (const u of positions) {
    const updateData: Partial<typeof channels.$inferInsert> = {
      position: u.position,
      updatedAt: new Date(),
    };
    if (u.parentId !== undefined) {
      updateData.parentId = u.parentId;
    }
    await db
      .update(channels)
      .set(updateData)
      .where(eq(channels.id, u.id));
  }

  // Broadcast position update so other clients reorder in real time
  try {
    getIO().to(`guild:${guildId}`).emit('CHANNEL_POSITIONS_UPDATE', { guildId, updates: positions });
  } catch { /* socket may not be initialised in tests */ }
}
