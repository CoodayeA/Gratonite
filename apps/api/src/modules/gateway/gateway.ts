import type { Server as SocketIOServer, Socket } from 'socket.io';
import type { AppContext } from '../../lib/context.js';
import { createAuthService } from '../auth/auth.service.js';
import { createBotsService } from '../bots/bots.service.js';
import { dmRecipients, dmChannels, users, userProfiles } from '@gratonite/db';
import { and, eq } from 'drizzle-orm';
import { createGuildsService } from '../guilds/guilds.service.js';
import { createVoiceService } from '../voice/voice.service.js';
import { createChannelsService } from '../channels/channels.service.js';
import { createDndService } from '../users/dnd.service.js';
import { logger } from '../../lib/logger.js';
import {
  GatewayIntents,
  DEFAULT_INTENTS,
  emitRoomWithIntent,
  intentForGuildEvent,
} from '../../lib/gateway-intents.js';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
  sessionId?: string;
  applicationId?: string;
  isBot?: boolean;
  intents?: number;
}


export function setupGateway(ctx: AppContext) {
  const authService = createAuthService(ctx);
  const botsService = createBotsService(ctx);
  const guildsService = createGuildsService(ctx);
  const voiceService = createVoiceService(ctx);
  const channelsService = createChannelsService(ctx);

  ctx.io.on('connection', (rawSocket: Socket) => {
    const socket = rawSocket as AuthenticatedSocket;
    logger.debug({ socketId: socket.id }, 'Socket connected (unauthenticated)');

    // ── IDENTIFY — authenticate the socket connection ────────────────────

    socket.on('IDENTIFY', async (data: { token: string; intents?: number }) => {
      try {
        let userId: string | undefined;
        let username: string | undefined;

        const payload = await authService.verifyAccessToken(data.token);
        if (payload) {
          userId = payload.userId;
          username = payload.username;
        } else {
          const botToken = data.token.startsWith('Bot ') ? data.token.slice(4) : data.token;
          const botRecord = await botsService.verifyBotToken(botToken);
          if (!botRecord) {
            socket.emit('error', { code: 'INVALID_TOKEN', message: 'Authentication failed' });
            socket.disconnect();
            return;
          }

          const [botUser] = await ctx.db
            .select({ id: users.id, username: users.username })
            .from(users)
            .where(eq(users.id, botRecord.userId!))
            .limit(1);

          userId = botUser?.id;
          username = botUser?.username;
          socket.applicationId = botRecord.applicationId;
          socket.isBot = true;
        }

        if (!userId || !username) {
          socket.emit('error', { code: 'INVALID_TOKEN', message: 'Authentication failed' });
          socket.disconnect();
          return;
        }

        socket.userId = userId;
        socket.username = username;
        socket.sessionId = socket.id;
        socket.intents = data.intents ?? DEFAULT_INTENTS;

        // Join personal room for DM notifications and cross-device sync
        socket.join(`user:${userId}`);

        // Join all guild rooms the user is a member of
        const userGuilds = await guildsService.getUserGuilds(userId);
        for (const guild of userGuilds) {
          socket.join(`guild:${guild.id}`);
        }

        // Track online status in Redis
        await ctx.redis.sadd(`online_users`, userId);
        await ctx.redis.set(`user_socket:${userId}`, socket.id, 'EX', 3600);

        socket.emit('READY', {
          userId,
          sessionId: socket.id,
        });

        logger.info({ userId, socketId: socket.id, isBot: socket.isBot, intents: socket.intents }, 'Socket authenticated');
      } catch (err) {
        logger.error({ err }, 'IDENTIFY failed');
        socket.disconnect();
      }
    });

    // ── HEARTBEAT — keep-alive ─────────────────────────────────────────────

    socket.on('HEARTBEAT', (data: { timestamp: number }) => {
      socket.emit('HEARTBEAT', { timestamp: Date.now() } as any);

      // Refresh online status TTL
      if (socket.userId) {
        ctx.redis.expire(`user_socket:${socket.userId}`, 3600);
      }
    });

    // ── TYPING_START — typing indicator ────────────────────────────────────

    socket.on('TYPING_START', async (data: { channelId: string }) => {
      if (!socket.userId) return;

      // Broadcast to the guild or DM channel
      const payload = {
        channelId: data.channelId,
        userId: socket.userId,
        timestamp: Date.now(),
      };

      const rooms = Array.from(socket.rooms).filter((r) => r.startsWith('guild:'));
      for (const room of rooms) {
        await emitRoomWithIntent(ctx.io, room, GatewayIntents.GUILD_MESSAGE_TYPING, 'TYPING_START', payload);
      }

      // Also publish to Redis for multi-server
      ctx.redis.publish(
        `channel:${data.channelId}:typing`,
        JSON.stringify({ userId: socket.userId, timestamp: Date.now() }),
      );
    });

    // ── GUILD_SUBSCRIBE / UNSUBSCRIBE ──────────────────────────────────────

    socket.on('GUILD_SUBSCRIBE', async (data: { guildId: string }) => {
      if (!socket.userId) return;

      // Verify membership before subscribing
      const isMember = await guildsService.isMember(data.guildId, socket.userId);
      if (isMember) {
        socket.join(`guild:${data.guildId}`);
      }
    });

    socket.on('GUILD_UNSUBSCRIBE', (data: { guildId: string }) => {
      socket.leave(`guild:${data.guildId}`);
    });

    // ── PRESENCE_UPDATE ────────────────────────────────────────────────────

    socket.on('PRESENCE_UPDATE', async (data: { status: string }) => {
      if (!socket.userId) return;

      // Store presence in Redis
      await ctx.redis.hset(`presence:${socket.userId}`, {
        status: data.status,
        lastSeen: Date.now().toString(),
      });

      // Broadcast to all guilds the user is in
      const rooms = Array.from(socket.rooms).filter((r) => r.startsWith('guild:'));
      for (const room of rooms) {
        emitRoomWithIntent(
          ctx.io,
          room,
          GatewayIntents.GUILD_PRESENCES,
          'PRESENCE_UPDATE',
          {
            userId: socket.userId,
            status: data.status,
          },
        );
      }
    });

    // ── VOICE_STATE_UPDATE — join/leave/mute voice channels ─────────────────

    socket.on('VOICE_STATE_UPDATE', async (data: {
      guildId?: string;
      channelId: string | null;
      selfMute?: boolean;
      selfDeaf?: boolean;
    }) => {
      if (!socket.userId || !socket.username) return;

      try {
        // channelId === null → leave voice
        if (data.channelId === null) {
          const disconnectedState = await voiceService.leaveChannel(socket.userId);
          if (disconnectedState?.guildId) {
            await emitRoomWithIntent(
              ctx.io,
              `guild:${disconnectedState.guildId}`,
              GatewayIntents.GUILD_VOICE_STATES,
              'VOICE_STATE_UPDATE',
              disconnectedState as any,
            );
          }
          return;
        }

        // Verify channel exists and is a voice channel
        const channel = await channelsService.getChannel(data.channelId);
        if (!channel) return;
        if (channel.type !== 'GUILD_VOICE' && channel.type !== 'GUILD_STAGE_VOICE') return;

        // Must be a guild member
        if (channel.guildId) {
          const isMember = await guildsService.isMember(channel.guildId, socket.userId);
          if (!isMember) return;
        }

        // Join voice channel
        const { token, voiceState } = await voiceService.joinChannel(
          socket.userId,
          socket.username,
          data.channelId,
          channel.guildId,
          `session_${socket.userId}`,
          { channelId: data.channelId, selfMute: data.selfMute ?? false, selfDeaf: data.selfDeaf ?? false },
        );

        // Broadcast voice state to guild
        if (channel.guildId) {
          await emitRoomWithIntent(
            ctx.io,
            `guild:${channel.guildId}`,
            GatewayIntents.GUILD_VOICE_STATES,
            'VOICE_STATE_UPDATE',
            voiceState as any,
          );
        }

        // Send token + endpoint privately to the requesting socket
        socket.emit('VOICE_SERVER_UPDATE', {
          token,
          guildId: channel.guildId,
          channelId: data.channelId,
          endpoint: ctx.env.LIVEKIT_URL,
        });
      } catch (err) {
        logger.error({ err, userId: socket.userId }, 'VOICE_STATE_UPDATE failed');
      }
    });

    // ── SOUNDBOARD_PLAY — play sound in voice channel ─────────────────────

    socket.on('SOUNDBOARD_PLAY', async (data: { guildId: string; soundId: string }) => {
      if (!socket.userId) return;

      try {
        const state = await voiceService.getVoiceState(socket.userId);
        if (!state || state.guildId !== data.guildId) return;

        const sound = await voiceService.getSound(data.soundId);
        if (!sound || sound.guildId !== data.guildId || !sound.available) return;

        await emitRoomWithIntent(
          ctx.io,
          `guild:${data.guildId}`,
          GatewayIntents.GUILD_VOICE_STATES,
          'SOUNDBOARD_PLAY',
          {
            guildId: data.guildId,
            channelId: state.channelId,
            soundId: data.soundId,
            userId: socket.userId,
            volume: sound.volume,
          } as any,
        );
      } catch (err) {
        logger.error({ err, userId: socket.userId }, 'SOUNDBOARD_PLAY failed');
      }
    });

    // ── DM CALLS ───────────────────────────────────────────────────────────

    socket.on('CALL_INVITE', async (data: { channelId: string; type: 'voice' | 'video' }) => {
      if (!socket.userId || !socket.username) return;
      if (!data?.channelId) return;

      const channel = await channelsService.getChannel(data.channelId);
      if (!channel || (channel.type !== 'DM' && channel.type !== 'GROUP_DM')) return;

      const recipients = await ctx.db
        .select({ userId: dmRecipients.userId })
        .from(dmRecipients)
        .innerJoin(dmChannels, eq(dmChannels.id, dmRecipients.channelId))
        .where(eq(dmRecipients.channelId, data.channelId));

      const isRecipient = recipients.some((r) => r.userId === socket.userId);
      if (!isRecipient) return;

      const [caller] = await ctx.db
        .select({
          id: users.id,
          displayName: userProfiles.displayName,
          username: users.username,
        })
        .from(users)
        .innerJoin(userProfiles, eq(userProfiles.userId, users.id))
        .where(eq(users.id, socket.userId))
        .limit(1);

      const payload = {
        channelId: data.channelId,
        type: data.type,
        fromUserId: socket.userId,
        fromDisplayName: caller?.displayName ?? socket.username,
      };

      const dndService = createDndService(ctx);
      for (const recipient of recipients) {
        if (recipient.userId === socket.userId) continue;

        // Check if recipient has DND active
        const schedule = await dndService.getSchedule(recipient.userId);
        if (dndService.isDndActive(schedule)) {
          const isException = schedule?.allowExceptions?.includes(socket.userId ?? '');
          if (!isException) {
            // Auto-decline: notify caller that this recipient is unavailable
            socket.emit('CALL_DECLINE', {
              channelId: data.channelId,
              fromUserId: recipient.userId,
              reason: 'dnd',
            });
            continue;
          }
        }

        ctx.io.to(`user:${recipient.userId}`).emit('CALL_INVITE', payload);
      }
    });

    socket.on('CALL_CANCEL', async (data: { channelId: string }) => {
      if (!socket.userId) return;
      if (!data?.channelId) return;

      const recipients = await ctx.db
        .select({ userId: dmRecipients.userId })
        .from(dmRecipients)
        .where(eq(dmRecipients.channelId, data.channelId));

      for (const recipient of recipients) {
        if (recipient.userId === socket.userId) continue;
        ctx.io.to(`user:${recipient.userId}`).emit('CALL_CANCEL', {
          channelId: data.channelId,
          fromUserId: socket.userId,
        });
      }
    });

    socket.on('CALL_ACCEPT', async (data: { channelId: string; toUserId: string }) => {
      if (!socket.userId) return;
      if (!data?.channelId || !data?.toUserId) return;
      ctx.io.to(`user:${data.toUserId}`).emit('CALL_ACCEPT', {
        channelId: data.channelId,
        fromUserId: socket.userId,
      });
    });

    socket.on('CALL_DECLINE', async (data: { channelId: string; toUserId: string }) => {
      if (!socket.userId) return;
      if (!data?.channelId || !data?.toUserId) return;
      ctx.io.to(`user:${data.toUserId}`).emit('CALL_DECLINE', {
        channelId: data.channelId,
        fromUserId: socket.userId,
      });
    });

    // ── Disconnect ─────────────────────────────────────────────────────────

    socket.on('disconnect', async (reason) => {
      if (socket.userId) {
        // Clean up voice state if user was in a voice channel
        try {
          const disconnectedState = await voiceService.leaveChannel(socket.userId);
          if (disconnectedState?.guildId) {
            await emitRoomWithIntent(
              ctx.io,
              `guild:${disconnectedState.guildId}`,
              GatewayIntents.GUILD_VOICE_STATES,
              'VOICE_STATE_UPDATE',
              disconnectedState as any,
            );
          }
        } catch (err) {
          logger.error({ err, userId: socket.userId }, 'Voice cleanup on disconnect failed');
        }

        // Remove from online users
        await ctx.redis.srem('online_users', socket.userId);
        await ctx.redis.del(`user_socket:${socket.userId}`);

        // Set presence to offline
        await ctx.redis.hset(`presence:${socket.userId}`, {
          status: 'offline',
          lastSeen: Date.now().toString(),
        });

        // Broadcast offline presence
        const rooms = Array.from(socket.rooms).filter((r) => r.startsWith('guild:'));
        for (const room of rooms) {
          await emitRoomWithIntent(
            ctx.io,
            room,
            GatewayIntents.GUILD_PRESENCES,
            'PRESENCE_UPDATE',
            {
              userId: socket.userId,
              status: 'offline',
            } as any,
          );
        }

        logger.info({ userId: socket.userId, reason }, 'Socket disconnected');
      } else {
        logger.debug({ socketId: socket.id, reason }, 'Unauthenticated socket disconnected');
      }
    });
  });

  // ── Redis pub/sub for cross-server events ──────────────────────────────

  setupRedisPubSub(ctx);
}

async function setupRedisPubSub(ctx: AppContext) {
  const { redisSub } = await import('../../lib/redis.js');

  // Connect the subscriber client (uses lazyConnect)
  await redisSub.connect();
  logger.info('Redis pub/sub subscriber connected');

  // Subscribe to patterns for cross-server event distribution
  redisSub.psubscribe('channel:*:messages', 'guild:*:events', 'user:*:sync');

  redisSub.on('pmessage', (pattern: string, channel: string, message: string) => {
    try {
      const data = JSON.parse(message);

      if (pattern === 'channel:*:messages') {
        const channelId = channel.split(':')[1];
        ctx.io.to(`channel:${channelId}`).emit(data.type, data.data);
      } else if (pattern === 'guild:*:events') {
        const guildId = channel.split(':')[1];
        const intent = intentForGuildEvent(String(data.type));
        emitRoomWithIntent(ctx.io, `guild:${guildId}`, intent, data.type, data.data);
      } else if (pattern === 'user:*:sync') {
        const userId = channel.split(':')[1];
        ctx.io.to(`user:${userId}`).emit(data.type, data.data);
      }
    } catch {
      // Ignore malformed messages
    }
  });
}
