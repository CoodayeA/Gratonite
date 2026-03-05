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
import { eq, and, asc, count, inArray } from 'drizzle-orm';

import { db } from '../db/index';
import { channels } from '../db/schema/channels';
import { dmChannelMembers } from '../db/schema/channels';
import { users } from '../db/schema/users';
import { guilds } from '../db/schema/guilds';
import { Permissions } from '../db/schema/roles';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { requireMember } from './guilds';
import { hasPermission, hasChannelPermission } from './roles';
import { logAuditEvent, AuditActionTypes } from '../lib/audit';
import { getIO } from '../lib/socket-io';

export const channelsRouter = Router();

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * AppError — Lightweight error with an HTTP status code.
 * Used to distinguish intentional HTTP errors from unexpected runtime errors.
 */
class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code: string = 'UNKNOWN_ERROR',
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * handleAppError — Shared error handler for all channel route handlers.
 *
 * @param res - Express Response.
 * @param err - The caught error value.
 */
function handleAppError(res: Response, err: unknown): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ code: err.code, message: err.message });
  } else {
    console.error('[channels] unexpected error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
}

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
  type: z.enum(['GUILD_TEXT', 'GUILD_VOICE', 'GUILD_CATEGORY']),
  parentId: z.string().uuid().optional(),
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
      // if they contain at least one visible child)
      const visibleChannelIds = new Set<string>();
      const categoryIds = new Set<string>();
      for (const ch of rows) {
        if (ch.type === 'GUILD_CATEGORY') {
          categoryIds.add(ch.id);
          continue;
        }
        const canView = await hasChannelPermission(req.userId!, guildId, ch.id, Permissions.VIEW_CHANNEL);
        if (canView) {
          visibleChannelIds.add(ch.id);
          if (ch.parentId) visibleChannelIds.add(ch.parentId); // include parent category
        }
      }
      // Include categories that have visible children (or are themselves visible)
      for (const catId of categoryIds) {
        if (visibleChannelIds.has(catId)) continue;
        // Category with no visible children is hidden
      }

      const filtered = rows.filter(ch => {
        if (ch.type === 'GUILD_CATEGORY') return visibleChannelIds.has(ch.id);
        return visibleChannelIds.has(ch.id);
      });

      res.status(200).json(filtered);
    } catch (err) {
      handleAppError(res, err);
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

      const { name, type, parentId } = req.body as z.infer<typeof createChannelSchema>;

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

      res.status(201).json(channel);
    } catch (err) {
      handleAppError(res, err);
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

      res.status(200).json({ code: 'OK', message: 'Positions updated' });
    } catch (err) {
      handleAppError(res, err);
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
      handleAppError(res, err);
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

      const { name, topic, isNsfw, rateLimitPerUser, position, backgroundUrl, backgroundType } = req.body as z.infer<
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
    } catch (err) {
      handleAppError(res, err);
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

      res.status(200).json({ code: 'OK', message: 'Channel deleted' });
    } catch (err) {
      handleAppError(res, err);
    }
  },
);
