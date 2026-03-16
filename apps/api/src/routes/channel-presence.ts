import { Router, Request, Response } from 'express';
import { inArray } from 'drizzle-orm';
import { db } from '../db/index';
import { users } from '../db/schema/users';
import { requireAuth } from '../middleware/auth';
import { redis } from '../lib/redis';
import { logger } from '../lib/logger';

export const channelPresenceRouter = Router({ mergeParams: true });

const CHANNEL_PRESENCE_PREFIX = 'channel-presence:';

// GET /channels/:channelId/presence — get list of users currently viewing this channel
channelPresenceRouter.get(
  '/',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const channelId = req.params.channelId as string;

      // Read user IDs from Redis set
      const userIds = await redis.smembers(`${CHANNEL_PRESENCE_PREFIX}${channelId}`);

      if (userIds.length === 0) {
        res.json([]);
        return;
      }

      // Join with users table to get usernames and avatar hashes
      const presentUsers = await db
        .select({
          userId: users.id,
          username: users.username,
          avatarHash: users.avatarHash,
        })
        .from(users)
        .where(inArray(users.id, userIds));

      res.json(presentUsers);
    } catch (err) {
      logger.error('[channel-presence] GET error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);
