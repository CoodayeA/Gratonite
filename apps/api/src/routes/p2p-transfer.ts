import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { db } from '../db/index';
import { guildMembers } from '../db/schema/guilds';
import { dmChannelMembers } from '../db/schema/channels';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { getIO } from '../lib/socket-io';
import { z } from 'zod';

export const p2pTransferRouter = Router();

const signalSchema = z.object({
  targetUserId: z.string().uuid(),
  signal: z.any(),
  transferId: z.string().min(1).max(100),
  fileName: z.string().min(1).max(500),
  fileSize: z.number().int().min(0),
});

// POST /p2p/signal — relay WebRTC signaling data to target user
p2pTransferRouter.post('/signal', requireAuth, validate(signalSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { targetUserId, signal, transferId, fileName, fileSize } = req.body;

    // Verify sender and target share at least one guild
    const senderGuilds = await db.select({ guildId: guildMembers.guildId }).from(guildMembers)
      .where(eq(guildMembers.userId, req.userId!));
    const senderGuildIds = senderGuilds.map(g => g.guildId);

    let hasRelationship = false;

    if (senderGuildIds.length > 0) {
      const [shared] = await db.select({ id: guildMembers.id }).from(guildMembers)
        .where(and(eq(guildMembers.userId, targetUserId), inArray(guildMembers.guildId, senderGuildIds)))
        .limit(1);
      if (shared) hasRelationship = true;
    }

    if (!hasRelationship) {
      // Check for shared DM channel
      const senderDms = await db.select({ channelId: dmChannelMembers.channelId }).from(dmChannelMembers)
        .where(eq(dmChannelMembers.userId, req.userId!));
      const senderDmIds = senderDms.map(d => d.channelId);

      if (senderDmIds.length > 0) {
        const [sharedDm] = await db.select({ id: dmChannelMembers.id }).from(dmChannelMembers)
          .where(and(eq(dmChannelMembers.userId, targetUserId), inArray(dmChannelMembers.channelId, senderDmIds)))
          .limit(1);
        if (sharedDm) hasRelationship = true;
      }
    }

    if (!hasRelationship) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'No shared guild or DM with target user' });
      return;
    }

    const io = getIO();
    io.to(`user:${targetUserId}`).emit('P2P_SIGNAL', {
      fromUserId: req.userId,
      signal,
      transferId,
      fileName,
      fileSize,
    });

    res.json({ ok: true });
  } catch (err) {
    logger.error('[p2p-transfer] POST signal error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});
