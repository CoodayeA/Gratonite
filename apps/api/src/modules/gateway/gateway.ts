import type { Server as SocketIOServer, Socket } from 'socket.io';
import type { AppContext } from '../../lib/context.js';
import { createAuthService } from '../auth/auth.service.js';
import { createGuildsService } from '../guilds/guilds.service.js';
import { logger } from '../../lib/logger.js';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
  sessionId?: string;
}

export function setupGateway(ctx: AppContext) {
  const authService = createAuthService(ctx);
  const guildsService = createGuildsService(ctx);

  ctx.io.on('connection', (rawSocket: Socket) => {
    const socket = rawSocket as AuthenticatedSocket;
    logger.debug({ socketId: socket.id }, 'Socket connected (unauthenticated)');

    // ── IDENTIFY — authenticate the socket connection ────────────────────

    socket.on('IDENTIFY', async (data: { token: string }) => {
      try {
        const payload = await authService.verifyAccessToken(data.token);
        if (!payload) {
          socket.emit('error', { code: 'INVALID_TOKEN', message: 'Authentication failed' });
          socket.disconnect();
          return;
        }

        socket.userId = payload.userId;
        socket.username = payload.username;
        socket.sessionId = socket.id;

        // Join personal room for DM notifications and cross-device sync
        socket.join(`user:${payload.userId}`);

        // Join all guild rooms the user is a member of
        const userGuilds = await guildsService.getUserGuilds(payload.userId);
        for (const guild of userGuilds) {
          socket.join(`guild:${guild.id}`);
        }

        // Track online status in Redis
        await ctx.redis.sadd(`online_users`, payload.userId);
        await ctx.redis.set(`user_socket:${payload.userId}`, socket.id, 'EX', 3600);

        socket.emit('READY', {
          userId: payload.userId,
          sessionId: socket.id,
        });

        logger.info({ userId: payload.userId, socketId: socket.id }, 'Socket authenticated');
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

    socket.on('TYPING_START', (data: { channelId: string }) => {
      if (!socket.userId) return;

      // Broadcast to the guild or DM channel
      socket.broadcast.to(`guild:*`).emit('TYPING_START', {
        channelId: data.channelId,
        userId: socket.userId,
        timestamp: Date.now(),
      });

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
        socket.broadcast.to(room).emit('PRESENCE_UPDATE', {
          userId: socket.userId,
          status: data.status,
        } as any);
      }
    });

    // ── Disconnect ─────────────────────────────────────────────────────────

    socket.on('disconnect', async (reason) => {
      if (socket.userId) {
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
          socket.broadcast.to(room).emit('PRESENCE_UPDATE', {
            userId: socket.userId,
            status: 'offline',
          } as any);
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
        ctx.io.to(`guild:${guildId}`).emit(data.type, data.data);
      } else if (pattern === 'user:*:sync') {
        const userId = channel.split(':')[1];
        ctx.io.to(`user:${userId}`).emit(data.type, data.data);
      }
    } catch {
      // Ignore malformed messages
    }
  });
}
