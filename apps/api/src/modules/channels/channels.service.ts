import { eq, and, sql } from 'drizzle-orm';
import { channels, channelPermissions } from '@gratonite/db';
import type { AppContext } from '../../lib/context.js';
import { generateId } from '../../lib/snowflake.js';
import type { CreateChannelInput, UpdateChannelInput } from './channels.schemas.js';

export function createChannelsService(ctx: AppContext) {
  async function createChannel(guildId: string, input: CreateChannelInput) {
    const channelId = generateId();

    const [channel] = await ctx.db
      .insert(channels)
      .values({
        id: channelId,
        guildId,
        type: input.type,
        name: input.name,
        topic: input.topic ?? null,
        parentId: input.parentId ?? null,
        nsfw: input.nsfw ?? false,
        rateLimitPerUser: input.rateLimitPerUser ?? 0,
        position: input.position ?? 0,
      })
      .returning();

    return channel;
  }

  async function getChannel(channelId: string) {
    const [channel] = await ctx.db
      .select()
      .from(channels)
      .where(eq(channels.id, channelId))
      .limit(1);
    return channel ?? null;
  }

  async function getGuildChannels(guildId: string) {
    return ctx.db
      .select()
      .from(channels)
      .where(eq(channels.guildId, guildId))
      .orderBy(channels.position);
  }

  async function updateChannel(channelId: string, input: UpdateChannelInput) {
    const updates: Record<string, unknown> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.topic !== undefined) updates.topic = input.topic;
    if (input.nsfw !== undefined) updates.nsfw = input.nsfw;
    if (input.rateLimitPerUser !== undefined) updates.rateLimitPerUser = input.rateLimitPerUser;
    if (input.parentId !== undefined) updates.parentId = input.parentId ?? null;
    if (input.position !== undefined) updates.position = input.position;

    if (Object.keys(updates).length === 0) return null;

    const [updated] = await ctx.db
      .update(channels)
      .set(updates)
      .where(eq(channels.id, channelId))
      .returning();

    return updated ?? null;
  }

  async function deleteChannel(channelId: string) {
    await ctx.db.delete(channels).where(eq(channels.id, channelId));
  }

  async function reorderChannels(
    guildId: string,
    positions: Array<{ id: string; position: number; parentId?: string | null }>,
  ) {
    for (const item of positions) {
      const updates: Record<string, unknown> = { position: item.position };
      if (item.parentId !== undefined) {
        updates.parentId = item.parentId ?? null;
      }
      await ctx.db
        .update(channels)
        .set(updates)
        .where(and(eq(channels.id, item.id), eq(channels.guildId, guildId)));
    }
  }

  // ── Permission overrides ─────────────────────────────────────────────────

  async function getPermissionOverrides(channelId: string) {
    return ctx.db
      .select()
      .from(channelPermissions)
      .where(eq(channelPermissions.channelId, channelId));
  }

  async function setPermissionOverride(
    channelId: string,
    targetId: string,
    targetType: 'role' | 'user',
    allow: string,
    deny: string,
  ) {
    // Upsert: try update first, then insert
    const existing = await ctx.db
      .select()
      .from(channelPermissions)
      .where(
        and(
          eq(channelPermissions.channelId, channelId),
          eq(channelPermissions.targetId, targetId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await ctx.db
        .update(channelPermissions)
        .set({ allow, deny })
        .where(
          and(
            eq(channelPermissions.channelId, channelId),
            eq(channelPermissions.targetId, targetId),
          ),
        )
        .returning();
      return updated;
    }

    const [created] = await ctx.db
      .insert(channelPermissions)
      .values({
        id: generateId(),
        channelId,
        targetId,
        targetType,
        allow,
        deny,
      })
      .returning();

    return created;
  }

  async function deletePermissionOverride(channelId: string, targetId: string) {
    await ctx.db
      .delete(channelPermissions)
      .where(
        and(
          eq(channelPermissions.channelId, channelId),
          eq(channelPermissions.targetId, targetId),
        ),
      );
  }

  return {
    createChannel,
    getChannel,
    getGuildChannels,
    updateChannel,
    deleteChannel,
    reorderChannels,
    getPermissionOverrides,
    setPermissionOverride,
    deletePermissionOverride,
  };
}

export type ChannelsService = ReturnType<typeof createChannelsService>;
