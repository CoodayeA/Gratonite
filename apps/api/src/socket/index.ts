/**
 * socket/index.ts — Socket.io server initialisation and event wiring.
 *
 * This module is responsible for:
 *   1. Authenticating the connecting Socket.io client via JWT (from the
 *      `Authorization` header or the `token` query param).
 *   2. Joining the socket to all relevant rooms on connect:
 *        - `user:<userId>`       — private room for user-targeted events
 *        - `guild:<guildId>`     — one room per guild the user belongs to
 *        - `channel:<channelId>` — one room per DM channel the user is in
 *   3. Emitting a `PRESENCE_UPDATE` event on disconnect so peers can react.
 *
 * Server-emitted events (clients subscribe to these):
 *   MESSAGE_CREATE    — A new message was posted in a channel.
 *   MESSAGE_UPDATE    — An existing message was edited.
 *   MESSAGE_DELETE    — A message was deleted.
 *   TYPING_START      — A user started typing in a channel.
 *   PRESENCE_UPDATE   — A user's online status changed.
 *   NOTIFICATION_CREATE — A notification for the user.
 *   READY             — Handshake complete, client is authenticated.
 *
 * Client-emitted events (server listens for these):
 *   IDENTIFY          — Client sends JWT after connect (ack with READY).
 *   HEARTBEAT         — Keep-alive, refreshes presence TTL in Redis.
 *   CHANNEL_JOIN      — Subscribe to a channel room.
 *   CHANNEL_LEAVE     — Unsubscribe from a channel room.
 *   PRESENCE_UPDATE   — Client sets their own presence status.
 *
 * This function is called once from `src/index.ts` and receives the already-
 * created Socket.io `Server` instance. It does NOT create the server itself —
 * that happens in `src/index.ts` so the HTTP and WebSocket servers share the
 * same port.
 *
 * @module socket/index
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyAccessToken } from '../lib/jwt';
import { db } from '../db/index';
import { guildMembers } from '../db/schema/guilds';
import { channels, dmChannelMembers } from '../db/schema/channels';
import { stageSessions, stageSpeakers } from '../db/schema/stage';
import { eq, and, isNull } from 'drizzle-orm';
import { redis } from '../lib/redis';

/**
 * initSocket — Wire up Socket.io authentication middleware and connection
 * handlers on the provided server instance.
 *
 * @param io - The Socket.io Server instance created in src/index.ts.
 */
export function initSocket(io: SocketIOServer): void {
  // ---------------------------------------------------------------------------
  // Authentication middleware
  // ---------------------------------------------------------------------------

  /**
   * Runs before every connection attempt. Extracts the JWT from either the
   * `Authorization` handshake header or the `token` query parameter (useful
   * for clients that cannot set custom headers, e.g. browser WebSocket API).
   *
   * Rejects the connection with an error if the token is missing or invalid.
   */
  io.use((socket: Socket, next) => {
    try {
      // Accept token from: Authorization header, query param, or auth object.
      const authHeader = socket.handshake.headers.authorization as string | undefined;
      const queryToken = socket.handshake.query.token as string | undefined;
      const authToken = (socket.handshake.auth as Record<string, unknown>)?.token as string | undefined;

      let token: string | undefined;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7);
      } else if (authToken) {
        token = authToken;
      } else if (queryToken) {
        token = queryToken;
      }

      if (!token) {
        return next(new Error('Authentication error: no token provided'));
      }

      const { userId } = verifyAccessToken(token);
      socket.data.userId = userId;
      next();
    } catch {
      next(new Error('Authentication error: invalid or expired token'));
    }
  });

  // ---------------------------------------------------------------------------
  // Connection handler
  // ---------------------------------------------------------------------------

  /**
   * Fired once per authenticated connection. Joins the socket to all rooms
   * relevant to this user, then registers disconnect cleanup.
   */
  io.on('connection', async (socket: Socket) => {
    const userId: string = socket.data.userId;

    console.info(`[socket.io] user ${userId} connected (${socket.id})`);

    // -------------------------------------------------------------------------
    // Join personal room
    // -------------------------------------------------------------------------
    await socket.join(`user:${userId}`);

    // -------------------------------------------------------------------------
    // Join guild rooms
    // -------------------------------------------------------------------------
    let userGuildIds: string[] = [];
    try {
      const memberships = await db
        .select({ guildId: guildMembers.guildId })
        .from(guildMembers)
        .where(eq(guildMembers.userId, userId));

      userGuildIds = memberships.map(m => m.guildId);
      for (const guildId of userGuildIds) {
        await socket.join(`guild:${guildId}`);
      }
    } catch (err) {
      console.error(`[socket.io] failed to join guild rooms for user ${userId}:`, err);
    }

    // -------------------------------------------------------------------------
    // Join DM channel rooms
    // -------------------------------------------------------------------------
    try {
      const dmMemberships = await db
        .select({ channelId: dmChannelMembers.channelId })
        .from(dmChannelMembers)
        .where(eq(dmChannelMembers.userId, userId));

      for (const { channelId } of dmMemberships) {
        await socket.join(`channel:${channelId}`);
      }
    } catch (err) {
      console.error(`[socket.io] failed to join DM channel rooms for user ${userId}:`, err);
    }

    // -------------------------------------------------------------------------
    // Set presence to online in Redis and broadcast
    // -------------------------------------------------------------------------
    try {
      await redis.set(`presence:${userId}`, 'online', 'EX', 300);
      for (const guildId of userGuildIds) {
        io.to(`guild:${guildId}`).emit('PRESENCE_UPDATE', { userId, status: 'online' });
      }
    } catch (err) {
      console.error(`[socket.io] failed to set presence for user ${userId}:`, err);
    }

    // Emit READY so the client knows the handshake is complete
    socket.emit('READY', { userId, sessionId: socket.id });

    // -------------------------------------------------------------------------
    // IDENTIFY handler — frontend sends this after connect; we already authed
    // via middleware, so just acknowledge with READY again.
    // -------------------------------------------------------------------------
    socket.on('IDENTIFY', () => {
      socket.emit('READY', { userId, sessionId: socket.id });
    });

    // -------------------------------------------------------------------------
    // HEARTBEAT handler — keep presence alive in Redis
    // -------------------------------------------------------------------------
    socket.on('HEARTBEAT', async () => {
      try {
        await redis.set(`presence:${userId}`, 'online', 'EX', 300);
      } catch {
        // Non-fatal
      }
    });

    // -------------------------------------------------------------------------
    // CHANNEL_JOIN — client subscribes to a channel room for real-time events
    // -------------------------------------------------------------------------
    socket.on('CHANNEL_JOIN', async (data: { channelId: string }) => {
      if (!data?.channelId) return;
      try {
        // Verify the user can access this channel
        const [channel] = await db
          .select({ id: channels.id, guildId: channels.guildId })
          .from(channels)
          .where(eq(channels.id, data.channelId))
          .limit(1);

        if (!channel) return;

        if (channel.guildId) {
          // Guild channel — verify membership
          const [membership] = await db
            .select({ id: guildMembers.id })
            .from(guildMembers)
            .where(and(eq(guildMembers.guildId, channel.guildId), eq(guildMembers.userId, userId)))
            .limit(1);
          if (!membership) return;
        } else {
          // DM channel — verify participation
          const [participation] = await db
            .select({ id: dmChannelMembers.id })
            .from(dmChannelMembers)
            .where(and(eq(dmChannelMembers.channelId, data.channelId), eq(dmChannelMembers.userId, userId)))
            .limit(1);
          if (!participation) return;
        }

        await socket.join(`channel:${data.channelId}`);
      } catch (err) {
        console.error(`[socket.io] CHANNEL_JOIN error:`, err);
      }
    });

    // -------------------------------------------------------------------------
    // CHANNEL_LEAVE — client unsubscribes from a channel room
    // -------------------------------------------------------------------------
    socket.on('CHANNEL_LEAVE', (data: { channelId: string }) => {
      if (!data?.channelId) return;
      socket.leave(`channel:${data.channelId}`);
    });

    // -------------------------------------------------------------------------
    // PRESENCE_UPDATE — client sets their own presence (idle, dnd, etc.)
    // -------------------------------------------------------------------------
    socket.on('PRESENCE_UPDATE', async (data: { status: string }) => {
      if (!data?.status) return;
      const validStatuses = ['online', 'idle', 'dnd', 'invisible'];
      if (!validStatuses.includes(data.status)) return;

      try {
        await redis.set(`presence:${userId}`, data.status, 'EX', 300);
        // Broadcast to all guilds
        for (const guildId of userGuildIds) {
          socket.to(`guild:${guildId}`).emit('PRESENCE_UPDATE', { userId, status: data.status });
        }
      } catch {
        // Non-fatal
      }
    });

    // -------------------------------------------------------------------------
    // STAGE_START — client starts a stage session via socket
    // -------------------------------------------------------------------------
    socket.on('STAGE_START', async (data: { channelId: string; topic?: string }) => {
      if (!data?.channelId) return;
      try {
        // End any existing active session
        const [existing] = await db
          .select({ id: stageSessions.id })
          .from(stageSessions)
          .where(and(eq(stageSessions.channelId, data.channelId), isNull(stageSessions.endedAt)))
          .limit(1);

        if (existing) {
          await db
            .update(stageSessions)
            .set({ endedAt: new Date() })
            .where(eq(stageSessions.id, existing.id));
        }

        const [session] = await db
          .insert(stageSessions)
          .values({
            channelId: data.channelId,
            hostId: userId,
            topic: data.topic ?? null,
          })
          .returning();

        io.to(`channel:${data.channelId}`).emit('STAGE_START', {
          channelId: data.channelId,
          sessionId: session.id,
          hostId: session.hostId,
          topic: session.topic ?? null,
        });
      } catch (err) {
        console.error('[socket.io] STAGE_START error:', err);
      }
    });

    // -------------------------------------------------------------------------
    // STAGE_END — host ends the stage session via socket
    // -------------------------------------------------------------------------
    socket.on('STAGE_END', async (data: { channelId: string; sessionId: string }) => {
      if (!data?.channelId || !data?.sessionId) return;
      try {
        await db
          .update(stageSessions)
          .set({ endedAt: new Date() })
          .where(
            and(
              eq(stageSessions.id, data.sessionId),
              eq(stageSessions.hostId, userId),
            ),
          );

        io.to(`channel:${data.channelId}`).emit('STAGE_END', {
          channelId: data.channelId,
          sessionId: data.sessionId,
        });
      } catch (err) {
        console.error('[socket.io] STAGE_END error:', err);
      }
    });

    // -------------------------------------------------------------------------
    // STAGE_SPEAKER_ADD — host invites a speaker via socket
    // -------------------------------------------------------------------------
    socket.on('STAGE_SPEAKER_ADD', async (data: { channelId: string; sessionId: string; userId: string }) => {
      if (!data?.channelId || !data?.sessionId || !data?.userId) return;
      try {
        await db
          .insert(stageSpeakers)
          .values({
            sessionId: data.sessionId,
            userId: data.userId,
            invitedBy: userId,
          })
          .onConflictDoNothing();

        io.to(`channel:${data.channelId}`).emit('STAGE_SPEAKER_ADD', {
          channelId: data.channelId,
          sessionId: data.sessionId,
          userId: data.userId,
          invitedBy: userId,
        });
      } catch (err) {
        console.error('[socket.io] STAGE_SPEAKER_ADD error:', err);
      }
    });

    // -------------------------------------------------------------------------
    // STAGE_SPEAKER_REMOVE — host removes a speaker via socket
    // -------------------------------------------------------------------------
    socket.on('STAGE_SPEAKER_REMOVE', async (data: { channelId: string; sessionId: string; userId: string }) => {
      if (!data?.channelId || !data?.sessionId || !data?.userId) return;
      try {
        await db
          .delete(stageSpeakers)
          .where(
            and(
              eq(stageSpeakers.sessionId, data.sessionId),
              eq(stageSpeakers.userId, data.userId),
            ),
          );

        io.to(`channel:${data.channelId}`).emit('STAGE_SPEAKER_REMOVE', {
          channelId: data.channelId,
          sessionId: data.sessionId,
          userId: data.userId,
        });
      } catch (err) {
        console.error('[socket.io] STAGE_SPEAKER_REMOVE error:', err);
      }
    });

    // -------------------------------------------------------------------------
    // STAGE_HAND_RAISE — audience member raises hand via socket
    // -------------------------------------------------------------------------
    socket.on('STAGE_HAND_RAISE', async (data: { channelId: string; sessionId: string }) => {
      if (!data?.channelId || !data?.sessionId) return;
      try {
        io.to(`channel:${data.channelId}`).emit('STAGE_HAND_RAISE', {
          channelId: data.channelId,
          sessionId: data.sessionId,
          userId,
        });
      } catch (err) {
        console.error('[socket.io] STAGE_HAND_RAISE error:', err);
      }
    });

    // -------------------------------------------------------------------------
    // Disconnect handler
    // -------------------------------------------------------------------------
    socket.on('disconnect', async () => {
      console.info(`[socket.io] user ${userId} disconnected (${socket.id})`);

      // Check if the user has other active sockets
      const userRoom = io.sockets.adapter.rooms.get(`user:${userId}`);
      if (!userRoom || userRoom.size === 0) {
        // No more connections — set offline
        try {
          await redis.del(`presence:${userId}`);
        } catch {
          // Non-fatal
        }
        for (const guildId of userGuildIds) {
          io.to(`guild:${guildId}`).emit('PRESENCE_UPDATE', { userId, status: 'offline' });
        }
      }
    });
  });
}
