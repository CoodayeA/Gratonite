/**
 * routes/channels.ts — Express router for channel management endpoints.
 *
 * Mounted at /api/v1/ (root) in src/routes/index.ts because this router
 * serves two distinct URL shapes:
 *   /api/v1/guilds/:guildId/channels  — list and create guild channels
 *   /api/v1/channels/:channelId       — get, update, and delete a channel
 *
 * Mounting at root keeps the URL structure clean without requiring two
 * separate routers.
 *
 * Endpoints:
 *   GET    /guilds/:guildId/channels       — List all channels in a guild (member required)
 *   POST   /guilds/:guildId/channels       — Create a channel in a guild (owner required)
 *   GET    /channels/:channelId            — Get channel info (member or DM participant)
 *   PATCH  /channels/:channelId            — Update channel settings (guild owner required)
 *   DELETE /channels/:channelId            — Delete a channel (guild owner, not last text ch.)
 *
 * @module routes/channels
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, asc, count, inArray, desc } from 'drizzle-orm';

import { db } from '../db/index';
import { channels } from '../db/schema/channels';
import { dmChannelMembers } from '../db/schema/channels';
import { channelFollowers } from '../db/schema/channel-followers';
import { groupEncryptionKeys } from '../db/schema/group-encryption';
import { channelFeaturedMessages } from '../db/schema/channel-featured-messages';
import { voiceMessages } from '../db/schema/voice-messages';
import { messages } from '../db/schema/messages';
import { users } from '../db/schema/users';
import { guilds } from '../db/schema/guilds';
import { Permissions } from '../db/schema/roles';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { requireMember } from './guilds';
import { hasPermission, hasChannelPermission } from './roles';
import { logAuditEvent, AuditActionTypes } from '../lib/audit';
import { getIO } from '../lib/socket-io';
import { AppError, handleAppError } from '../lib/errors.js';

export const channelsRouter = Router();

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * canAccessChannel — Verify that the user may access the given channel.
 *
 * For guild channels: the user must be a member of the parent guild.
 * For DM channels: the user must be a dm_channel_members participant.
 *
 * @param channel - The channel row fetched from the database.
 * @param userId  - The authenticated user's UUID.
 * @throws {AppError} 403 if the user has no access.
 */
async function canAccessChannel(
  channel: typeof channels.$inferSelect,
  userId: string,
): Promise<void> {
  if (channel.guildId) {
    // Guild channel — verify guild membership.
    await requireMember(channel.guildId, userId);
  } else {
    // DM channel — verify participation.
    const [participation] = await db
      .select({ id: dmChannelMembers.id })
      .from(dmChannelMembers)
      .where(
        and(
          eq(dmChannelMembers.channelId, channel.id),
          eq(dmChannelMembers.userId, userId),
        ),
      )
      .limit(1);

    if (!participation) {
      throw new AppError(403, 'You do not have access to this channel', 'FORBIDDEN');
    }
  }
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

/**
 * Schema for POST /guilds/:guildId/channels — create channel.
 */
const createChannelSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Channel name may only contain lowercase letters, digits, and hyphens'),
  type: z.enum(['GUILD_TEXT', 'GUILD_VOICE', 'GUILD_CATEGORY', 'GUILD_STAGE']),
  parentId: z.string().uuid().optional(),
  createLinkedText: z.boolean().optional(),
});

/**
 * Schema for PATCH /channels/:channelId — update channel.
 */
const updateChannelSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Channel name may only contain lowercase letters, digits, and hyphens')
    .optional(),
  topic: z.string().max(1024).nullable().optional(),
  isNsfw: z.boolean().optional(),
  rateLimitPerUser: z.number().int().min(0).max(21600).optional(),
  position: z.number().int().min(0).optional(),
  backgroundUrl: z.string().url().nullable().optional(),
  backgroundType: z.enum(['image', 'video']).nullable().optional(),
  linkedTextChannelId: z.string().uuid().nullable().optional(),
  isAnnouncement: z.boolean().optional(),
  forumTags: z.array(z.object({ id: z.string(), name: z.string(), color: z.string().optional() })).optional(),
  isEncrypted: z.boolean().optional(),
  attachmentsEnabled: z.boolean().optional(),
  permissionSynced: z.boolean().optional(),
  parentId: z.string().uuid().nullable().optional(),
  archived: z.boolean().optional(),
  autoArchiveDays: z.number().int().min(0).max(365).nullable().optional(),
});

// ---------------------------------------------------------------------------
// GET /guilds/:guildId/channels
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/guilds/:guildId/channels
 *
 * Return all channels belonging to the specified guild, ordered by position
 * ascending. The calling user must be a member of the guild.
 *
 * @auth    requireAuth, requireMember
 * @param   guildId {string} — Guild UUID
 * @returns 200 Array of channel rows ordered by position ASC
 * @returns 403 Not a member
 */
channelsRouter.get(
  '/guilds/:guildId/channels',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { guildId } = req.params as Record<string, string>;
      await requireMember(guildId, req.userId!);

      const rows = await db
        .select()
        .from(channels)
        .where(eq(channels.guildId, guildId))
        .orderBy(asc(channels.position));

      // Filter channels by VIEW_CHANNEL permission (categories are always visible
      // if they contain at least one visible child, or if the user can manage channels)
      const visibleChannelIds = new Set<string>();
      const categoryIds = new Set<string>();
      const canManage = await hasPermission(req.userId!, guildId, Permissions.MANAGE_CHANNELS);
      for (const ch of rows) {
        if (ch.type === 'GUILD_CATEGORY') {
          categoryIds.add(ch.id);
          // Users with MANAGE_CHANNELS can always see categories (even empty ones)
          if (canManage) visibleChannelIds.add(ch.id);
          continue;
        }
        const canView = await hasChannelPermission(req.userId!, guildId, ch.id, Permissions.VIEW_CHANNEL);
        if (canView) {
          visibleChannelIds.add(ch.id);
          if (ch.parentId) visibleChannelIds.add(ch.parentId); // include parent category
        }
      }

      const filtered = rows.filter(ch => visibleChannelIds.has(ch.id));

      res.status(200).json(filtered);
    } catch (err) {
      handleAppError(res, err, 'channels');
    }
  },
);

// ---------------------------------------------------------------------------
// POST /guilds/:guildId/channels
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/guilds/:guildId/channels
 *
 * Create a new channel inside a guild. Only the guild owner may create
 * channels. The channel name must consist only of lowercase letters, digits,
 * and hyphens. The position defaults to the number of existing channels
 * (appended at the end).
 *
 * @auth    requireAuth, requireMember, MANAGE_CHANNELS permission
 * @param   guildId {string} — Guild UUID
 * @body    { name: string, type: 'GUILD_TEXT'|'GUILD_VOICE'|'GUILD_CATEGORY', parentId?: string }
 * @returns 201 Created channel row
 * @returns 400 Validation failure
 * @returns 403 Not the owner
 * @returns 404 Guild not found
 *
 * Side effects:
 *   - Inserts a row in `channels`.
 */
channelsRouter.post(
  '/guilds/:guildId/channels',
  requireAuth,
  validate(createChannelSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { guildId } = req.params as Record<string, string>;
      await requireMember(guildId, req.userId!);

      if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_CHANNELS))) {
        throw new AppError(403, 'Missing MANAGE_CHANNELS permission', 'FORBIDDEN');
      }

      const { name, type, parentId, createLinkedText } = req.body as z.infer<typeof createChannelSchema>;

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
      logAuditEvent(guildId, req.userId!, AuditActionTypes.CHANNEL_CREATE, channel.id, 'CHANNEL', { name, type });

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

        logAuditEvent(guildId, req.userId!, AuditActionTypes.CHANNEL_CREATE, textChannel.id, 'CHANNEL', { name: linkedName, type: 'GUILD_TEXT' });

        getIO().to(`guild:${guildId}`).emit('CHANNEL_CREATE', { ...updated, linkedTextChannel: textChannel });
        res.status(201).json({ ...updated, linkedTextChannel: textChannel });
        return;
      }

      getIO().to(`guild:${guildId}`).emit('CHANNEL_CREATE', channel);
      res.status(201).json(channel);
    } catch (err) {
      handleAppError(res, err, 'channels');
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /guilds/:guildId/channels/positions — Batch reorder/recategorize
// ---------------------------------------------------------------------------

/**
 * Schema for PATCH /guilds/:guildId/channels/positions — batch update positions.
 */
const batchPositionsSchema = z.array(
  z.object({
    id: z.string().uuid(),
    position: z.number().int().min(0),
    parentId: z.string().uuid().nullable().optional(),
  }),
);

/**
 * PATCH /api/v1/guilds/:guildId/channels/positions
 *
 * Batch-update channel positions and parent categories. Accepts an array of
 * { id, position, parentId } objects. All referenced channels must belong to
 * the specified guild. Requires MANAGE_CHANNELS permission.
 *
 * @auth    requireAuth, requireMember, MANAGE_CHANNELS
 * @param   guildId {string}
 * @body    Array<{ id: string, position: number, parentId?: string | null }>
 * @returns 200 { code: 'OK', message: 'Positions updated' }
 */
channelsRouter.patch(
  '/guilds/:guildId/channels/positions',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { guildId } = req.params as Record<string, string>;
      await requireMember(guildId, req.userId!);

      if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_CHANNELS))) {
        throw new AppError(403, 'Missing MANAGE_CHANNELS permission', 'FORBIDDEN');
      }

      const parsed = batchPositionsSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ code: 'VALIDATION_ERROR', message: parsed.error.message });
        return;
      }

      const updates = parsed.data;
      if (updates.length === 0) {
        res.status(200).json({ code: 'OK', message: 'Positions updated' });
        return;
      }

      // Verify all channel IDs belong to this guild
      const channelIds = updates.map((u) => u.id);
      const existingChannels = await db
        .select({ id: channels.id })
        .from(channels)
        .where(and(eq(channels.guildId, guildId), inArray(channels.id, channelIds)));

      const existingIds = new Set(existingChannels.map((c) => c.id));
      for (const u of updates) {
        if (!existingIds.has(u.id)) {
          res.status(400).json({
            code: 'VALIDATION_ERROR',
            message: `Channel ${u.id} does not belong to this guild`,
          });
          return;
        }
      }

      // Apply updates
      for (const u of updates) {
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
        getIO().to(`guild:${guildId}`).emit('CHANNEL_POSITIONS_UPDATE', { guildId, updates });
      } catch { /* socket may not be initialised in tests */ }

      res.status(200).json({ code: 'OK', message: 'Positions updated' });
    } catch (err) {
      handleAppError(res, err, 'channels');
    }
  },
);

// ---------------------------------------------------------------------------
// GET /channels/:channelId
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/channels/:channelId
 *
 * Return detailed information about a channel. The calling user must be
 * either a member of the channel's guild (for guild channels) or a
 * participant in the DM (for DM channels).
 *
 * @auth    requireAuth, canAccessChannel
 * @param   channelId {string} — Channel UUID
 * @returns 200 Channel row
 * @returns 403 No access
 * @returns 404 Channel not found
 */
channelsRouter.get(
  '/channels/:channelId',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { channelId } = req.params as Record<string, string>;

      const [channel] = await db
        .select()
        .from(channels)
        .where(eq(channels.id, channelId))
        .limit(1);

      if (!channel) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Channel not found' });
        return;
      }

      await canAccessChannel(channel, req.userId!);

      // For group DMs, include participants
      if (channel.isGroup) {
        const participantRows = await db
          .select({
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            avatarHash: users.avatarHash,
            status: users.status,
          })
          .from(dmChannelMembers)
          .innerJoin(users, eq(users.id, dmChannelMembers.userId))
          .where(eq(dmChannelMembers.channelId, channelId));

        res.status(200).json({ ...channel, participants: participantRows });
        return;
      }

      res.status(200).json(channel);
    } catch (err) {
      handleAppError(res, err, 'channels');
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /channels/:channelId
// ---------------------------------------------------------------------------

/**
 * PATCH /api/v1/channels/:channelId
 *
 * Update channel settings. The calling user must be the owner of the
 * channel's guild. All body fields are optional; fields not present are
 * left unchanged.
 *
 * @auth    requireAuth, requireMember, MANAGE_CHANNELS permission
 * @param   channelId {string} — Channel UUID
 * @body    { name?, topic?, isNsfw?, rateLimitPerUser?, position? }
 * @returns 200 Updated channel row
 * @returns 400 Validation failure
 * @returns 403 Not the guild owner
 * @returns 404 Channel not found
 *
 * Side effects:
 *   - Updates `channels` row and bumps updatedAt.
 */
channelsRouter.patch(
  '/channels/:channelId',
  requireAuth,
  validate(updateChannelSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { channelId } = req.params as Record<string, string>;

      const [channel] = await db
        .select()
        .from(channels)
        .where(eq(channels.id, channelId))
        .limit(1);

      if (!channel) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Channel not found' });
        return;
      }

      if (!channel.guildId) {
        res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Cannot modify a DM channel' });
        return;
      }

      await requireMember(channel.guildId, req.userId!);

      if (!(await hasPermission(req.userId!, channel.guildId, Permissions.MANAGE_CHANNELS))) {
        throw new AppError(403, 'Missing MANAGE_CHANNELS permission', 'FORBIDDEN');
      }

      const { name, topic, isNsfw, rateLimitPerUser, position, backgroundUrl, backgroundType, linkedTextChannelId, isAnnouncement, forumTags, isEncrypted, attachmentsEnabled, permissionSynced, parentId, archived, autoArchiveDays } = req.body as z.infer<
        typeof updateChannelSchema
      >;

      const updateData: Partial<typeof channels.$inferInsert> = { updatedAt: new Date() };
      if (name !== undefined) updateData.name = name;
      if (topic !== undefined) updateData.topic = topic;
      if (isNsfw !== undefined) updateData.isNsfw = isNsfw;
      if (rateLimitPerUser !== undefined) updateData.rateLimitPerUser = rateLimitPerUser;
      if (position !== undefined) updateData.position = position;
      if (backgroundUrl !== undefined) updateData.backgroundUrl = backgroundUrl;
      if (backgroundType !== undefined) updateData.backgroundType = backgroundType;
      if (linkedTextChannelId !== undefined) updateData.linkedTextChannelId = linkedTextChannelId;
      if (isAnnouncement !== undefined) updateData.isAnnouncement = isAnnouncement;
      if (forumTags !== undefined) updateData.forumTags = forumTags;
      if (isEncrypted !== undefined) updateData.isEncrypted = isEncrypted;
      if (attachmentsEnabled !== undefined) updateData.attachmentsEnabled = attachmentsEnabled;
      if (permissionSynced !== undefined) updateData.permissionSynced = permissionSynced;
      if (parentId !== undefined) updateData.parentId = parentId;
      if (archived !== undefined) updateData.archived = archived;
      if (autoArchiveDays !== undefined) updateData.autoArchiveDays = autoArchiveDays;

      const [updated] = await db
        .update(channels)
        .set(updateData)
        .where(eq(channels.id, channelId))
        .returning();

      // Audit log
      const changes: Record<string, unknown> = {};
      if (name !== undefined) changes.name = name;
      if (topic !== undefined) changes.topic = topic;
      if (isNsfw !== undefined) changes.isNsfw = isNsfw;
      logAuditEvent(channel.guildId, req.userId!, AuditActionTypes.CHANNEL_UPDATE, channelId, 'CHANNEL', changes);

      // Broadcast background update to all members in the channel
      if (backgroundUrl !== undefined || backgroundType !== undefined) {
        try {
          const room = channel.guildId ? `guild:${channel.guildId}` : `channel:${channelId}`;
          getIO().to(room).emit('CHANNEL_BACKGROUND_UPDATED', {
            channelId,
            backgroundUrl: updated.backgroundUrl ?? null,
            backgroundType: updated.backgroundType ?? null,
          });
        } catch { /* socket may not be initialised in tests */ }
      }

      res.status(200).json(updated);

      // Emit real-time channel update to guild members
      if (channel.guildId) {
        try {
          getIO().to(`guild:${channel.guildId}`).emit('CHANNEL_UPDATE', { ...updated, channelId, guildId: channel.guildId });
        } catch { /* socket may not be initialised in tests */ }
      }
    } catch (err) {
      handleAppError(res, err, 'channels');
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /channels/:channelId
// ---------------------------------------------------------------------------

/**
 * DELETE /api/v1/channels/:channelId
 *
 * Delete a guild channel. The calling user must be the guild owner. Deletion
 * is blocked if the channel is the last GUILD_TEXT channel in its guild —
 * every guild must have at least one text channel.
 *
 * @auth    requireAuth, requireMember, MANAGE_CHANNELS permission
 * @param   channelId {string} — Channel UUID
 * @returns 200 { message: 'Channel deleted' }
 * @returns 400 Cannot delete the last text channel, or cannot delete DM channel
 * @returns 403 Not the guild owner
 * @returns 404 Channel not found
 *
 * Side effects:
 *   - Deletes `channels` row (cascades to messages).
 */
channelsRouter.delete(
  '/channels/:channelId',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { channelId } = req.params as Record<string, string>;

      const [channel] = await db
        .select()
        .from(channels)
        .where(eq(channels.id, channelId))
        .limit(1);

      if (!channel) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Channel not found' });
        return;
      }

      if (!channel.guildId) {
        res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Cannot delete a DM channel' });
        return;
      }

      await requireMember(channel.guildId, req.userId!);

      if (!(await hasPermission(req.userId!, channel.guildId, Permissions.MANAGE_CHANNELS))) {
        throw new AppError(403, 'Missing MANAGE_CHANNELS permission', 'FORBIDDEN');
      }

      // Guard: do not delete the last text channel in the guild.
      if (channel.type === 'GUILD_TEXT') {
        const [{ value: textChannelCount }] = await db
          .select({ value: count() })
          .from(channels)
          .where(and(eq(channels.guildId, channel.guildId), eq(channels.type, 'GUILD_TEXT')));

        if (Number(textChannelCount) <= 1) {
          res.status(400).json({
            code: 'VALIDATION_ERROR',
            message: 'Cannot delete the last text channel in a guild',
          });
          return;
        }
      }

      // Audit log (before delete so we still have the channel data)
      logAuditEvent(channel.guildId, req.userId!, AuditActionTypes.CHANNEL_DELETE, channelId, 'CHANNEL', { name: channel.name, type: channel.type });

      await db.delete(channels).where(eq(channels.id, channelId));

      // Emit real-time channel delete to guild members
      try {
        getIO().to(`guild:${channel.guildId}`).emit('CHANNEL_DELETE', { channelId, guildId: channel.guildId });
      } catch { /* socket may not be initialised in tests */ }

      res.status(200).json({ code: 'OK', message: 'Channel deleted' });
    } catch (err) {
      handleAppError(res, err, 'channels');
    }
  },
);

// ---------------------------------------------------------------------------
// POST /channels/:channelId/followers — Follow an announcement channel
// ---------------------------------------------------------------------------

const followSchema = z.object({
  targetChannelId: z.string().uuid(),
});

channelsRouter.post(
  '/channels/:channelId/followers',
  requireAuth,
  validate(followSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { channelId } = req.params as Record<string, string>;
      const { targetChannelId } = req.body as z.infer<typeof followSchema>;

      const [source] = await db.select().from(channels).where(eq(channels.id, channelId)).limit(1);
      if (!source || !source.guildId) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Source channel not found' }); return;
      }

      if (!(await hasPermission(req.userId!, source.guildId, Permissions.MANAGE_CHANNELS))) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_CHANNELS permission' }); return;
      }

      await db.insert(channelFollowers).values({
        sourceChannelId: channelId,
        targetChannelId,
      }).onConflictDoNothing();

      res.status(201).json({ sourceChannelId: channelId, targetChannelId });
    } catch (err) {
      handleAppError(res, err, 'channels');
    }
  },
);

// ---------------------------------------------------------------------------
// POST /channels/:channelId/messages/:messageId/crosspost — Crosspost to followers
// ---------------------------------------------------------------------------

channelsRouter.post(
  '/channels/:channelId/messages/:messageId/crosspost',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { channelId, messageId } = req.params as Record<string, string>;

      const [channel] = await db.select().from(channels).where(eq(channels.id, channelId)).limit(1);
      if (!channel || !channel.guildId) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Channel not found' }); return;
      }

      if (!channel.isAnnouncement) {
        res.status(400).json({ code: 'BAD_REQUEST', message: 'Channel is not an announcement channel' }); return;
      }

      if (!(await hasPermission(req.userId!, channel.guildId, Permissions.MANAGE_MESSAGES))) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_MESSAGES permission' }); return;
      }

      const [message] = await db.select().from(messages).where(and(eq(messages.id, messageId), eq(messages.channelId, channelId))).limit(1);
      if (!message) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Message not found' }); return;
      }

      // Find all followers
      const followers = await db.select().from(channelFollowers).where(eq(channelFollowers.sourceChannelId, channelId));

      // Copy message to each target channel
      for (const f of followers) {
        const [copied] = await db.insert(messages).values({
          channelId: f.targetChannelId,
          authorId: message.authorId,
          content: message.content,
          attachments: message.attachments,
        }).returning();

        try {
          getIO().to(`channel:${f.targetChannelId}`).emit('MESSAGE_CREATE', {
            ...copied,
            crossposted: true,
            sourceChannelId: channelId,
          });
        } catch { /* non-fatal */ }
      }

      res.json({ crossposted: followers.length });
    } catch (err) {
      handleAppError(res, err, 'channels');
    }
  },
);

// ============================================================
// WAVE 3: Featured Messages
// ============================================================

// GET /channels/:channelId/featured
channelsRouter.get('/channels/:channelId/featured', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const { channelId } = req.params as Record<string, string>;
  try {
    const [channel] = await db.select().from(channels).where(eq(channels.id, channelId)).limit(1);
    if (!channel) { res.status(404).json({ code: 'NOT_FOUND', message: 'Channel not found' }); return; }
    await canAccessChannel(channel, userId);
    const featured = await db.select().from(channelFeaturedMessages).where(eq(channelFeaturedMessages.channelId, channelId));
    res.json(featured);
  } catch {
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// POST /channels/:channelId/featured
channelsRouter.post('/channels/:channelId/featured', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const { channelId } = req.params as Record<string, string>;
  const { messageId, note } = req.body;
  if (!messageId) { res.status(400).json({ code: 'VALIDATION_ERROR', message: 'messageId is required' }); return; }
  try {
    const [channel] = await db.select().from(channels).where(eq(channels.id, channelId)).limit(1);
    if (!channel) { res.status(404).json({ code: 'NOT_FOUND', message: 'Channel not found' }); return; }
    await canAccessChannel(channel, userId);
    const [row] = await db.insert(channelFeaturedMessages)
      .values({ channelId, messageId, featuredBy: userId, note })
      .onConflictDoNothing()
      .returning();
    res.status(201).json(row);
  } catch {
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// DELETE /channels/:channelId/featured/:messageId
channelsRouter.delete('/channels/:channelId/featured/:messageId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const { channelId, messageId } = req.params as Record<string, string>;
  try {
    const [channel] = await db.select().from(channels).where(eq(channels.id, channelId)).limit(1);
    if (!channel) { res.status(404).json({ code: 'NOT_FOUND', message: 'Channel not found' }); return; }
    await canAccessChannel(channel, userId);
    await db.delete(channelFeaturedMessages).where(
      and(eq(channelFeaturedMessages.channelId, channelId), eq(channelFeaturedMessages.messageId, messageId))
    );
    res.status(204).send();
  } catch {
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// ============================================================
// WAVE 3: Voice Channel Text Chat
// ============================================================

// GET /channels/:channelId/voice-messages
channelsRouter.get('/channels/:channelId/voice-messages', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const { channelId } = req.params as Record<string, string>;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  try {
    const [channel] = await db.select().from(channels).where(eq(channels.id, channelId)).limit(1);
    if (!channel) { res.status(404).json({ code: 'NOT_FOUND', message: 'Channel not found' }); return; }
    await canAccessChannel(channel, userId);
    const msgs = await db.select({
      id: voiceMessages.id,
      channelId: voiceMessages.channelId,
      content: voiceMessages.content,
      createdAt: voiceMessages.createdAt,
      authorId: voiceMessages.authorId,
      authorUsername: users.username,
      authorDisplayName: users.displayName,
      authorAvatarHash: users.avatarHash,
    }).from(voiceMessages)
      .leftJoin(users, eq(voiceMessages.authorId, users.id))
      .where(eq(voiceMessages.channelId, channelId))
      .orderBy(desc(voiceMessages.createdAt))
      .limit(limit);
    res.json(msgs.reverse());
  } catch {
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// POST /channels/:channelId/voice-messages
channelsRouter.post('/channels/:channelId/voice-messages', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const { channelId } = req.params as Record<string, string>;
  const { content } = req.body;
  if (!content || typeof content !== 'string' || content.length > 4000) {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: 'content is required (max 4000 chars)' });
    return;
  }
  try {
    const [channel] = await db.select().from(channels).where(eq(channels.id, channelId)).limit(1);
    if (!channel) { res.status(404).json({ code: 'NOT_FOUND', message: 'Channel not found' }); return; }
    await canAccessChannel(channel, userId);
    const [msg] = await db.insert(voiceMessages)
      .values({ channelId, authorId: userId, content })
      .returning();

    try {
      const io = getIO();
      io.to(channelId).emit('VOICE_MESSAGE_CREATE', msg);
    } catch { /* non-fatal */ }

    res.status(201).json(msg);
  } catch {
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// POST /channels/:channelId/duplicate
channelsRouter.post('/channels/:channelId/duplicate', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const { channelId } = req.params as Record<string, string>;
  try {
    // Fetch source channel
    const [source] = await db.select().from(channels).where(eq(channels.id, channelId)).limit(1);
    if (!source) { res.status(404).json({ code: 'NOT_FOUND', message: 'Channel not found' }); return; }
    if (!source.guildId) { res.status(400).json({ code: 'BAD_REQUEST', message: 'Cannot duplicate DM channels' }); return; }

    // Check MANAGE_CHANNELS permission
    const hasPerm = await hasPermission(userId, source.guildId, Permissions.MANAGE_CHANNELS);
    if (!hasPerm) { res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_CHANNELS permission' }); return; }

    // Insert duplicate
    const [newChannel] = await db.insert(channels).values({
      guildId: source.guildId,
      name: `${source.name}-copy`,
      type: source.type,
      topic: source.topic,
      parentId: source.parentId,
      isNsfw: source.isNsfw,
      rateLimitPerUser: source.rateLimitPerUser,
      userLimit: source.userLimit,
      position: (source.position ?? 0) + 1,
    }).returning();

    // Emit socket event
    try {
      const io = getIO();
      io.to(source.guildId).emit('CHANNEL_CREATE', newChannel);
    } catch { /* non-fatal */ }

    res.status(201).json(newChannel);
  } catch (err) {
    handleAppError(res, err, 'channels');
  }
});

// ---------------------------------------------------------------------------
// POST /guilds/:guildId/channels/:channelId/encryption-keys — Upload group E2E key
// ---------------------------------------------------------------------------
channelsRouter.post(
  '/guilds/:guildId/channels/:channelId/encryption-keys',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { guildId, channelId } = req.params as Record<string, string>;
      await requireMember(guildId, req.userId!);

      // Require guild owner or MANAGE_CHANNELS permission
      const [guild] = await db.select({ ownerId: guilds.ownerId }).from(guilds).where(eq(guilds.id, guildId)).limit(1);
      const isOwner = guild?.ownerId === req.userId!;
      if (!isOwner && !(await hasPermission(req.userId!, guildId, Permissions.MANAGE_CHANNELS))) {
        throw new AppError(403, 'Missing MANAGE_CHANNELS permission', 'FORBIDDEN');
      }

      // Verify channel belongs to this guild
      const [channel] = await db.select({ id: channels.id }).from(channels).where(and(eq(channels.id, channelId), eq(channels.guildId, guildId))).limit(1);
      if (!channel) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Channel not found in this guild' });
        return;
      }

      const { version, keyData } = req.body as { version: number; keyData: Record<string, string> };

      if (!version || !keyData || typeof keyData !== 'object') {
        res.status(400).json({ code: 'VALIDATION_ERROR', message: 'version and keyData are required' });
        return;
      }

      const [inserted] = await db.insert(groupEncryptionKeys).values({
        channelId,
        version,
        keyData,
      }).returning();

      res.status(201).json(inserted);
    } catch (err) {
      handleAppError(res, err, 'channels');
    }
  },
);

// ---------------------------------------------------------------------------
// GET /guilds/:guildId/channels/:channelId/encryption-keys — Get latest E2E key
// ---------------------------------------------------------------------------
channelsRouter.get(
  '/guilds/:guildId/channels/:channelId/encryption-keys',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { guildId, channelId } = req.params as Record<string, string>;
      await requireMember(guildId, req.userId!);

      // Verify channel belongs to this guild
      const [channel] = await db.select({ id: channels.id }).from(channels).where(and(eq(channels.id, channelId), eq(channels.guildId, guildId))).limit(1);
      if (!channel) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Channel not found in this guild' });
        return;
      }

      const keys = await db
        .select()
        .from(groupEncryptionKeys)
        .where(eq(groupEncryptionKeys.channelId, channelId))
        .orderBy(desc(groupEncryptionKeys.version))
        .limit(1);

      if (keys.length === 0) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'No encryption keys found' });
        return;
      }

      res.json(keys[0]);
    } catch (err) {
      handleAppError(res, err, 'channels');
    }
  },
);

// ---------------------------------------------------------------------------
// POST /channels/:channelId/e2e-toggle — Toggle E2E encryption for a DM channel
// ---------------------------------------------------------------------------

const e2eToggleSchema = z.object({
  enabled: z.boolean(),
});

channelsRouter.post(
  '/channels/:channelId/e2e-toggle',
  requireAuth,
  validate(e2eToggleSchema),
  async (req: Request, res: Response) => {
    try {
      const channelId = req.params.channelId as string;
      const userId = req.userId!;
      const { enabled } = req.body as z.infer<typeof e2eToggleSchema>;

      // Verify channel exists and is a DM
      const [channel] = await db
        .select()
        .from(channels)
        .where(eq(channels.id, channelId))
        .limit(1);

      if (!channel) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Channel not found' });
        return;
      }

      const type = (channel.type ?? '').toUpperCase().replace(/-/g, '_');
      if (type !== 'DM' && type !== 'GROUP_DM') {
        res.status(400).json({ code: 'BAD_REQUEST', message: 'E2E toggle is only for DM channels' });
        return;
      }

      // Verify user is a member of this DM
      const [membership] = await db
        .select({ id: dmChannelMembers.id })
        .from(dmChannelMembers)
        .where(and(
          eq(dmChannelMembers.channelId, channelId),
          eq(dmChannelMembers.userId, userId),
        ))
        .limit(1);

      if (!membership) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'You are not a member of this channel' });
        return;
      }

      // Update channel isEncrypted flag
      await db
        .update(channels)
        .set({ isEncrypted: enabled })
        .where(eq(channels.id, channelId));

      // Get toggler's info for the notification
      const [toggler] = await db
        .select({ username: users.username, displayName: users.displayName })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const togglerName = toggler?.displayName || toggler?.username || 'Someone';

      // Broadcast to all DM members via the channel room
      try {
        getIO().to(`channel:${channelId}`).emit('E2E_STATE_CHANGED', {
          channelId,
          enabled,
          toggledBy: userId,
          toggledByName: togglerName,
        });
      } catch { /* socket may not be initialised in tests */ }

      res.json({ ok: true, enabled });
    } catch (err) {
      handleAppError(res, err, 'channels');
    }
  },
);

