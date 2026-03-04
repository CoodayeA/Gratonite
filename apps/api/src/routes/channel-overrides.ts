/**
 * routes/channel-overrides.ts — Per-channel permission overrides CRUD.
 *
 * Mounted at /api/v1/channels/:channelId/permissions in src/routes/index.ts.
 *
 * Endpoints:
 *   GET    /                 — List all overrides for a channel
 *   PUT    /:targetId        — Create or update an override (requires MANAGE_CHANNELS)
 *   DELETE /:targetId        — Remove an override (requires MANAGE_CHANNELS)
 *
 * @module routes/channel-overrides
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';

import { db } from '../db/index';
import { channels } from '../db/schema/channels';
import { channelPermissionOverrides } from '../db/schema/channel-overrides';
import { Permissions } from '../db/schema/roles';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { requireMember } from './guilds';
import { hasPermission } from './roles';

export const channelOverridesRouter = Router({ mergeParams: true });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fetch the channel and verify it is a guild channel. Returns the channel row.
 */
async function getGuildChannel(channelId: string, res: Response) {
  const [channel] = await db
    .select()
    .from(channels)
    .where(eq(channels.id, channelId))
    .limit(1);

  if (!channel) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Channel not found' });
    return null;
  }

  if (!channel.guildId) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'Cannot set overrides on a DM channel' });
    return null;
  }

  return channel;
}

// ---------------------------------------------------------------------------
// GET /channels/:channelId/permissions
// ---------------------------------------------------------------------------

channelOverridesRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { channelId } = req.params as Record<string, string>;

  const channel = await getGuildChannel(channelId, res);
  if (!channel) return;

  // Verify the user is a guild member
  try {
    await requireMember(channel.guildId!, req.userId!);
  } catch {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Not a guild member' });
    return;
  }

  const overrides = await db
    .select()
    .from(channelPermissionOverrides)
    .where(eq(channelPermissionOverrides.channelId, channelId));

  res.json(
    overrides.map((o) => ({
      id: o.id,
      channelId: o.channelId,
      targetId: o.targetId,
      targetType: o.targetType,
      allow: o.allow.toString(),
      deny: o.deny.toString(),
    })),
  );
});

// ---------------------------------------------------------------------------
// PUT /channels/:channelId/permissions/:targetId
// ---------------------------------------------------------------------------

const upsertOverrideSchema = z.object({
  type: z.enum(['role', 'member']),
  allow: z.string(),
  deny: z.string(),
});

channelOverridesRouter.put(
  '/:targetId',
  requireAuth,
  validate(upsertOverrideSchema),
  async (req: Request, res: Response): Promise<void> => {
    const { channelId, targetId } = req.params as Record<string, string>;

    const channel = await getGuildChannel(channelId, res);
    if (!channel) return;

    try {
      await requireMember(channel.guildId!, req.userId!);
    } catch {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Not a guild member' });
      return;
    }

    if (!(await hasPermission(req.userId!, channel.guildId!, Permissions.MANAGE_CHANNELS))) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_CHANNELS permission' });
      return;
    }

    const { type, allow, deny } = req.body as z.infer<typeof upsertOverrideSchema>;

    // Upsert: insert or update on conflict
    const [existing] = await db
      .select()
      .from(channelPermissionOverrides)
      .where(
        and(
          eq(channelPermissionOverrides.channelId, channelId),
          eq(channelPermissionOverrides.targetId, targetId),
        ),
      )
      .limit(1);

    let result;
    if (existing) {
      [result] = await db
        .update(channelPermissionOverrides)
        .set({
          targetType: type,
          allow: BigInt(allow),
          deny: BigInt(deny),
        })
        .where(eq(channelPermissionOverrides.id, existing.id))
        .returning();
    } else {
      [result] = await db
        .insert(channelPermissionOverrides)
        .values({
          channelId,
          targetId,
          targetType: type,
          allow: BigInt(allow),
          deny: BigInt(deny),
        })
        .returning();
    }

    res.json({
      id: result.id,
      channelId: result.channelId,
      targetId: result.targetId,
      targetType: result.targetType,
      allow: result.allow.toString(),
      deny: result.deny.toString(),
    });
  },
);

// ---------------------------------------------------------------------------
// DELETE /channels/:channelId/permissions/:targetId
// ---------------------------------------------------------------------------

channelOverridesRouter.delete(
  '/:targetId',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { channelId, targetId } = req.params as Record<string, string>;

    const channel = await getGuildChannel(channelId, res);
    if (!channel) return;

    try {
      await requireMember(channel.guildId!, req.userId!);
    } catch {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Not a guild member' });
      return;
    }

    if (!(await hasPermission(req.userId!, channel.guildId!, Permissions.MANAGE_CHANNELS))) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_CHANNELS permission' });
      return;
    }

    const deleted = await db
      .delete(channelPermissionOverrides)
      .where(
        and(
          eq(channelPermissionOverrides.channelId, channelId),
          eq(channelPermissionOverrides.targetId, targetId),
        ),
      )
      .returning();

    if (deleted.length === 0) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Override not found' });
      return;
    }

    res.json({ code: 'OK', message: 'Override removed' });
  },
);
