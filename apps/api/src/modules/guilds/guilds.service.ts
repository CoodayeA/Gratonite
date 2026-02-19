import { eq, and, sql, inArray } from 'drizzle-orm';
import {
  guilds,
  guildMembers,
  guildRoles,
  userRoles,
  guildBrand,
  bans,
  auditLogEntries,
} from '@gratonite/db';
import { channels } from '@gratonite/db';
import type { AppContext } from '../../lib/context.js';
import { generateId } from '../../lib/snowflake.js';
import { logger } from '../../lib/logger.js';
import type { CreateGuildInput, UpdateGuildInput, CreateRoleInput, UpdateRoleInput } from './guilds.schemas.js';

// Default permissions for @everyone role
const DEFAULT_PERMISSIONS =
  (1 << 0) | // CREATE_INVITE
  (1 << 6) | // VIEW_CHANNEL
  (1 << 10) | // SEND_MESSAGES
  (1 << 11) | // SEND_MESSAGES_IN_THREADS
  (1 << 14) | // EMBED_LINKS
  (1 << 15) | // ATTACH_FILES
  (1 << 16) | // ADD_REACTIONS
  (1 << 17) | // USE_EXTERNAL_EMOJIS
  (1 << 18) | // USE_EXTERNAL_STICKERS
  (1 << 20) | // READ_MESSAGE_HISTORY
  (1 << 25) | // CONNECT
  (1 << 26) | // SPEAK
  (1 << 29) | // USE_VOICE_ACTIVITY
  (1 << 31); // CHANGE_NICKNAME

export function createGuildsService(ctx: AppContext) {
  async function createGuild(ownerId: string, input: CreateGuildInput) {
    const guildId = generateId();
    const everyoneRoleId = generateId();
    const generalChannelId = generateId();

    // Create guild
    await ctx.db.insert(guilds).values({
      id: guildId,
      name: input.name,
      description: input.description ?? null,
      ownerId,
      memberCount: 1,
    });

    // Create @everyone role (same ID as guild, convention from Discord)
    await ctx.db.insert(guildRoles).values({
      id: everyoneRoleId,
      guildId,
      name: '@everyone',
      position: 0,
      permissions: DEFAULT_PERMISSIONS,
    });

    // Create default brand settings
    await ctx.db.insert(guildBrand).values({ guildId });

    // Create default #general text channel
    await ctx.db.insert(channels).values({
      id: generalChannelId,
      guildId,
      type: 'GUILD_TEXT',
      name: 'general',
      position: 0,
    });

    // Add owner as member
    await ctx.db.insert(guildMembers).values({ userId: ownerId, guildId });

    logger.info({ guildId, ownerId }, 'Guild created');

    return { guildId, everyoneRoleId, generalChannelId };
  }

  async function getGuild(guildId: string) {
    const [guild] = await ctx.db
      .select()
      .from(guilds)
      .where(eq(guilds.id, guildId))
      .limit(1);
    return guild ?? null;
  }

  async function updateGuild(guildId: string, input: UpdateGuildInput) {
    const updates: Record<string, unknown> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description;
    if (input.preferredLocale !== undefined) updates.preferredLocale = input.preferredLocale;
    if (input.nsfwLevel !== undefined) updates.nsfwLevel = input.nsfwLevel;
    if (input.verificationLevel !== undefined) updates.verificationLevel = input.verificationLevel;
    if (input.explicitContentFilter !== undefined) updates.explicitContentFilter = input.explicitContentFilter;
    if (input.defaultMessageNotifications !== undefined)
      updates.defaultMessageNotifications = input.defaultMessageNotifications;
    if (input.discoverable !== undefined) updates.discoverable = input.discoverable;

    if (Object.keys(updates).length === 0) return null;

    const [updated] = await ctx.db
      .update(guilds)
      .set(updates)
      .where(eq(guilds.id, guildId))
      .returning();

    return updated ?? null;
  }

  async function deleteGuild(guildId: string) {
    await ctx.db.delete(guilds).where(eq(guilds.id, guildId));
  }

  // ── Members ──────────────────────────────────────────────────────────────

  async function isMember(guildId: string, userId: string) {
    const [member] = await ctx.db
      .select({ userId: guildMembers.userId })
      .from(guildMembers)
      .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, userId)))
      .limit(1);
    return !!member;
  }

  async function addMember(guildId: string, userId: string) {
    await ctx.db.insert(guildMembers).values({ userId, guildId });
    await ctx.db
      .update(guilds)
      .set({ memberCount: sql`${guilds.memberCount} + 1` })
      .where(eq(guilds.id, guildId));
  }

  async function removeMember(guildId: string, userId: string) {
    await ctx.db
      .delete(guildMembers)
      .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, userId)));
    // Also remove their role assignments
    await ctx.db
      .delete(userRoles)
      .where(and(eq(userRoles.guildId, guildId), eq(userRoles.userId, userId)));
    await ctx.db
      .update(guilds)
      .set({ memberCount: sql`GREATEST(${guilds.memberCount} - 1, 0)` })
      .where(eq(guilds.id, guildId));
  }

  async function getMembers(guildId: string, limit = 100, after?: string) {
    let query = ctx.db
      .select()
      .from(guildMembers)
      .where(eq(guildMembers.guildId, guildId))
      .limit(limit);

    if (after) {
      query = ctx.db
        .select()
        .from(guildMembers)
        .where(and(eq(guildMembers.guildId, guildId), sql`${guildMembers.userId} > ${after}`))
        .limit(limit);
    }

    return query;
  }

  async function getMember(guildId: string, userId: string) {
    const [member] = await ctx.db
      .select()
      .from(guildMembers)
      .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, userId)))
      .limit(1);
    return member ?? null;
  }

  async function getUserGuilds(userId: string) {
    const memberships = await ctx.db
      .select({ guildId: guildMembers.guildId })
      .from(guildMembers)
      .where(eq(guildMembers.userId, userId));

    if (memberships.length === 0) return [];

    const guildIds = memberships.map((m) => m.guildId);
    return ctx.db
      .select()
      .from(guilds)
      .where(inArray(guilds.id, guildIds));
  }

  // ── Roles ────────────────────────────────────────────────────────────────

  async function createRole(guildId: string, input: CreateRoleInput) {
    const roleId = generateId();

    // Get the highest position for this guild
    const [highest] = await ctx.db
      .select({ position: guildRoles.position })
      .from(guildRoles)
      .where(eq(guildRoles.guildId, guildId))
      .orderBy(sql`${guildRoles.position} DESC`)
      .limit(1);

    const position = (highest?.position ?? 0) + 1;

    const [role] = await ctx.db
      .insert(guildRoles)
      .values({
        id: roleId,
        guildId,
        name: input.name,
        color: input.color ?? 0,
        hoist: input.hoist ?? false,
        mentionable: input.mentionable ?? false,
        permissions: input.permissions ?? 0,
        position,
      })
      .returning();

    return role;
  }

  async function getRoles(guildId: string) {
    return ctx.db
      .select()
      .from(guildRoles)
      .where(eq(guildRoles.guildId, guildId))
      .orderBy(guildRoles.position);
  }

  async function updateRole(roleId: string, input: UpdateRoleInput) {
    const updates: Record<string, unknown> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.color !== undefined) updates.color = input.color;
    if (input.hoist !== undefined) updates.hoist = input.hoist;
    if (input.mentionable !== undefined) updates.mentionable = input.mentionable;
    if (input.permissions !== undefined) updates.permissions = input.permissions;
    if (input.position !== undefined) updates.position = input.position;

    if (Object.keys(updates).length === 0) return null;

    const [updated] = await ctx.db
      .update(guildRoles)
      .set(updates)
      .where(eq(guildRoles.id, roleId))
      .returning();

    return updated ?? null;
  }

  async function deleteRole(roleId: string) {
    await ctx.db.delete(guildRoles).where(eq(guildRoles.id, roleId));
  }

  async function assignRole(guildId: string, userId: string, roleId: string) {
    await ctx.db
      .insert(userRoles)
      .values({ userId, roleId, guildId })
      .onConflictDoNothing();
  }

  async function removeRole(guildId: string, userId: string, roleId: string) {
    await ctx.db
      .delete(userRoles)
      .where(
        and(
          eq(userRoles.userId, userId),
          eq(userRoles.roleId, roleId),
          eq(userRoles.guildId, guildId),
        ),
      );
  }

  async function getMemberRoles(guildId: string, userId: string) {
    const assignments = await ctx.db
      .select({ roleId: userRoles.roleId })
      .from(userRoles)
      .where(and(eq(userRoles.guildId, guildId), eq(userRoles.userId, userId)));

    if (assignments.length === 0) return [];

    const roleIds = assignments.map((a) => a.roleId);
    return ctx.db
      .select()
      .from(guildRoles)
      .where(inArray(guildRoles.id, roleIds));
  }

  // ── Bans ─────────────────────────────────────────────────────────────────

  async function banMember(guildId: string, userId: string, moderatorId: string, reason?: string) {
    await ctx.db.insert(bans).values({
      guildId,
      userId,
      moderatorId,
      reason: reason ?? null,
    });
    // Remove from members
    await removeMember(guildId, userId);
  }

  async function unbanMember(guildId: string, userId: string) {
    await ctx.db
      .delete(bans)
      .where(and(eq(bans.guildId, guildId), eq(bans.userId, userId)));
  }

  async function isBanned(guildId: string, userId: string) {
    const [ban] = await ctx.db
      .select({ guildId: bans.guildId })
      .from(bans)
      .where(and(eq(bans.guildId, guildId), eq(bans.userId, userId)))
      .limit(1);
    return !!ban;
  }

  async function getBans(guildId: string) {
    return ctx.db
      .select()
      .from(bans)
      .where(eq(bans.guildId, guildId));
  }

  // ── Audit log ────────────────────────────────────────────────────────────

  async function createAuditLogEntry(data: {
    guildId: string;
    userId: string;
    targetId?: string;
    actionType: number;
    changes?: unknown;
    reason?: string;
  }) {
    await ctx.db.insert(auditLogEntries).values({
      id: generateId(),
      guildId: data.guildId,
      userId: data.userId,
      targetId: data.targetId ?? null,
      actionType: data.actionType,
      changes: data.changes ?? null,
      reason: data.reason ?? null,
    });
  }

  return {
    createGuild,
    getGuild,
    updateGuild,
    deleteGuild,
    isMember,
    addMember,
    removeMember,
    getMembers,
    getMember,
    getUserGuilds,
    createRole,
    getRoles,
    updateRole,
    deleteRole,
    assignRole,
    removeRole,
    getMemberRoles,
    banMember,
    unbanMember,
    isBanned,
    getBans,
    createAuditLogEntry,
  };
}

export type GuildsService = ReturnType<typeof createGuildsService>;
