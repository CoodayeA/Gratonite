import { db } from '../db/index';
import { logger } from '../lib/logger';
import { guilds } from '../db/schema/guilds';
import { channels } from '../db/schema/channels';
import { redis } from '../lib/redis';
import { getIO } from '../lib/socket-io';
import { isNotNull, eq } from 'drizzle-orm';

const VOICE_STATE_PREFIX = 'voice:channel:';
const VOICE_USER_PREFIX = 'voice:user:';
const VOICE_ACTIVITY_PREFIX = 'voice:activity:';

/** BullMQ processor — executes the AFK mover logic. */
export async function processAfkMover(): Promise<void> {
  await runAfkMover();
}

/** @deprecated Use BullMQ scheduler in worker.ts instead. */
export function startAfkMoverJob() {
  setInterval(async () => {
    try {
      await runAfkMover();
    } catch (err) {
      logger.error('[afk-mover] Job error:', err);
    }
  }, 30_000);
}

async function runAfkMover(): Promise<void> {
  // Find guilds with an AFK channel configured
  const afkGuilds = await db
    .select({
      id: guilds.id,
      afkChannelId: guilds.afkChannelId,
      afkTimeout: guilds.afkTimeout,
    })
    .from(guilds)
    .where(isNotNull(guilds.afkChannelId));

  for (const guild of afkGuilds) {
    if (!guild.afkChannelId) continue;
    const timeout = guild.afkTimeout ?? 300;

    // Get all voice channels in this guild
    const guildChannels = await db
      .select({ id: channels.id })
      .from(channels)
      .where(eq(channels.guildId, guild.id));

    for (const ch of guildChannels) {
      // Skip the AFK channel itself
      if (ch.id === guild.afkChannelId) continue;

      const key = `${VOICE_STATE_PREFIX}${ch.id}`;
      const raw = await redis.hgetall(key);
      if (!raw || Object.keys(raw).length === 0) continue;

      const now = Date.now();

      for (const [userId, stateJson] of Object.entries(raw)) {
        const state = JSON.parse(stateJson);

        // Check last activity timestamp
        const activityKey = `${VOICE_ACTIVITY_PREFIX}${userId}`;
        const lastActivity = await redis.get(activityKey);
        const lastActiveMs = lastActivity ? Number(lastActivity) : new Date(state.joinedAt).getTime();

        if (now - lastActiveMs < timeout * 1000) continue;

        // Move user to AFK channel
        // Remove from current channel
        await redis.hdel(key, userId);

        // Add to AFK channel
        const afkState = { ...state, channelId: guild.afkChannelId };
        const afkKey = `${VOICE_STATE_PREFIX}${guild.afkChannelId}`;
        await redis.hset(afkKey, userId, JSON.stringify(afkState));

        // Update user channel mapping
        const userKey = `${VOICE_USER_PREFIX}${userId}`;
        await redis.set(userKey, guild.afkChannelId, 'EX', 86400);

        // Broadcast voice state updates
        try {
          const io = getIO();
          const room = `guild:${guild.id}`;
          io.to(room).emit('VOICE_STATE_UPDATE', {
            type: 'move',
            userId,
            fromChannelId: ch.id,
            channelId: guild.afkChannelId,
            reason: 'afk',
          });
        } catch {
          // Socket.io may not be initialised
        }
      }
    }
  }
}
