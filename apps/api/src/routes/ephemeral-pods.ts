import { Router, Request, Response } from 'express';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db/index';
import { channels } from '../db/schema/channels';
import { guildMembers } from '../db/schema/guilds';
import { requireAuth } from '../middleware/auth';
import { getIO } from '../lib/socket-io';
import { redis } from '../lib/redis';
import { logger } from '../lib/logger';

export const ephemeralPodsRouter = Router({ mergeParams: true });

const EPHEMERAL_VOICE_TYPE = 'EPHEMERAL_VOICE';
const VOICE_STATE_PREFIX = 'voice:channel:';

/**
 * Clean up empty ephemeral pods for a guild.
 * Checks each EPHEMERAL_VOICE channel for voice states in Redis;
 * deletes channels with no active participants.
 */
export async function cleanupEmptyPods(guildId: string): Promise<number> {
  const pods = await db
    .select({ id: channels.id })
    .from(channels)
    .where(and(eq(channels.guildId, guildId), eq(channels.type, EPHEMERAL_VOICE_TYPE)));

  let deleted = 0;

  for (const pod of pods) {
    const stateCount = await redis.hlen(`${VOICE_STATE_PREFIX}${pod.id}`);
    if (stateCount === 0) {
      await db.delete(channels).where(eq(channels.id, pod.id));
      deleted++;

      const io = getIO();
      io.to(`guild:${guildId}`).emit('CHANNEL_DELETE', { id: pod.id, guildId });
    }
  }

  return deleted;
}

// POST /guilds/:guildId/pods — create ephemeral voice channel
ephemeralPodsRouter.post(
  '/',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const guildId = req.params.guildId as string;
      const { name } = req.body as { name?: string };

      // Verify guild membership
      const [membership] = await db.select({ id: guildMembers.id }).from(guildMembers)
        .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, req.userId!)))
        .limit(1);
      if (!membership) { res.status(403).json({ code: 'FORBIDDEN', message: 'Not a member of this guild' }); return; }

      // Get current max position for ordering
      const [maxPos] = await db
        .select({ max: sql<number>`coalesce(max(${channels.position}), 0)` })
        .from(channels)
        .where(eq(channels.guildId, guildId));

      const podName = name?.slice(0, 100) || `Pod ${Date.now().toString(36).slice(-4).toUpperCase()}`;

      const [pod] = await db
        .insert(channels)
        .values({
          guildId,
          name: podName,
          type: EPHEMERAL_VOICE_TYPE,
          position: (maxPos?.max ?? 0) + 1,
        })
        .returning();

      const io = getIO();
      io.to(`guild:${guildId}`).emit('CHANNEL_CREATE', pod);

      res.status(201).json(pod);
    } catch (err) {
      logger.error('[ephemeral-pods] POST error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

// GET /guilds/:guildId/pods — list active ephemeral pods
ephemeralPodsRouter.get(
  '/',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const guildId = req.params.guildId as string;

      const pods = await db
        .select()
        .from(channels)
        .where(and(eq(channels.guildId, guildId), eq(channels.type, EPHEMERAL_VOICE_TYPE)))
        .orderBy(desc(channels.createdAt));

      res.json(pods);
    } catch (err) {
      logger.error('[ephemeral-pods] GET error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

// DELETE /guilds/:guildId/pods/:channelId — manually delete a pod
ephemeralPodsRouter.delete(
  '/:channelId',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const guildId = req.params.guildId as string;
      const channelId = req.params.channelId as string;

      // Verify guild membership
      const [membership] = await db.select({ id: guildMembers.id }).from(guildMembers)
        .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, req.userId!)))
        .limit(1);
      if (!membership) { res.status(403).json({ code: 'FORBIDDEN', message: 'Not a member of this guild' }); return; }

      // Verify this is an ephemeral pod belonging to the guild
      const [pod] = await db
        .select()
        .from(channels)
        .where(
          and(
            eq(channels.id, channelId),
            eq(channels.guildId, guildId),
            eq(channels.type, EPHEMERAL_VOICE_TYPE),
          ),
        )
        .limit(1);

      if (!pod) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Ephemeral pod not found' });
        return;
      }

      await db.delete(channels).where(eq(channels.id, channelId));

      // Clean up any lingering voice state in Redis
      await redis.del(`${VOICE_STATE_PREFIX}${channelId}`);

      const io = getIO();
      io.to(`guild:${guildId}`).emit('CHANNEL_DELETE', { id: channelId, guildId });

      res.json({ ok: true });
    } catch (err) {
      logger.error('[ephemeral-pods] DELETE error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);
