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
import { users } from '../db/schema/users';
import { eq, and, isNull } from 'drizzle-orm';
import { redis } from '../lib/redis';
import { executeWorkflows } from '../lib/workflow-executor';
import { activeWebSocketConnections } from '../lib/metrics';
import { logger } from '../lib/logger';

// In-memory spatial positions: channelId → Map<userId, {x, y}>
// Ephemeral — not persisted to Redis (too high frequency: ~15 updates/sec/user)
const spatialPositions = new Map<string, Map<string, { x: number; y: number }>>();

// ---------------------------------------------------------------------------
// Per-user, per-event WebSocket rate limiter
// ---------------------------------------------------------------------------

/** Rate limit config: [maxEvents, windowMs] */
const WS_RATE_LIMITS: Record<string, [number, number]> = {
  PRESENCE_UPDATE: [5, 10_000],          // max 5 per 10 seconds
  SPATIAL_POSITION_UPDATE: [10, 5_000],  // max 10 per 5 seconds
  // TYPING_START is handled via HTTP POST, not a socket event — rate limit there instead
};

/**
 * Returns true if the event should be allowed, false if rate-limited.
 * Uses Redis INCR with TTL for distributed rate limiting.
 * Silently drops events that exceed the limit.
 */
async function checkWsRateLimit(userId: string, eventType: string): Promise<boolean> {
  const config = WS_RATE_LIMITS[eventType];
  if (!config) return true; // no limit configured for this event
  const [maxEvents, windowMs] = config;
  const key = `ws_rate:${userId}:${eventType}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.pexpire(key, windowMs);
    }
    return count <= maxEvents;
  } catch {
    return true; // Allow on Redis failure
  }
}

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
  io.use((socket: Socket, next: any) => {
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
        console.warn(`[socket.io] DEPRECATION: client connected with token via query parameter (socket ${socket.id}). Prefer using the auth handshake object instead.`);
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
    activeWebSocketConnections.inc();

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

      userGuildIds = memberships.map((m: any) => m.guildId);
      for (const guildId of userGuildIds) {
        await socket.join(`guild:${guildId}`);
      }
    } catch (err) {
      logger.error(`[socket.io] failed to join guild rooms for user ${userId}:`, err);
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
      logger.error(`[socket.io] failed to join DM channel rooms for user ${userId}:`, err);
    }

    // -------------------------------------------------------------------------
    // Set presence in Redis and broadcast — respect stored status (invisible)
    // -------------------------------------------------------------------------
    let desiredStatus = 'online';
    try {
      // Respect the user's saved status preference from the database
      const [dbUser] = await db
        .select({ status: users.status })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      const savedStatus = dbUser?.status || 'online';
      desiredStatus = ['online', 'idle', 'dnd', 'invisible'].includes(savedStatus) ? savedStatus : 'online';
      await redis.set(`presence:${userId}`, desiredStatus, 'EX', 600);
      console.info(`[socket.io] presence set for ${userId}: ${desiredStatus} (guilds: ${userGuildIds.length})`);
      // Broadcast — invisible appears as "offline" to others
      const broadcastStatus = desiredStatus === 'invisible' ? 'offline' : desiredStatus;
      for (const guildId of userGuildIds) {
        io.to(`guild:${guildId}`).emit('PRESENCE_UPDATE', { userId, status: broadcastStatus });
      }
    } catch (err) {
      logger.error(`[socket.io] failed to set presence for user ${userId}:`, err);
    }

    // Emit READY so the client knows the handshake is complete
    socket.emit('READY', { userId, sessionId: socket.id, status: desiredStatus });

    // -------------------------------------------------------------------------
    // IDENTIFY handler — frontend sends this after connect; we already authed
    // via middleware, so just acknowledge with READY again.
    // Trigger 'member_join' workflows for all guilds this user is in.
    // -------------------------------------------------------------------------
    socket.on('IDENTIFY', () => {
      socket.emit('READY', { userId, sessionId: socket.id, status: desiredStatus });

      // Fire member_join workflows (non-blocking)
      for (const guildId of userGuildIds) {
        executeWorkflows(guildId, 'member_join', { guildId, userId }, io).catch((err) => {
          logger.error(`[socket.io] workflow member_join error guild=${guildId}:`, err);
        });
      }
    });

    // -------------------------------------------------------------------------
    // HEARTBEAT handler — keep presence alive in Redis
    // -------------------------------------------------------------------------
    socket.on('HEARTBEAT', async () => {
      try {
        // Preserve current status (idle/dnd/invisible) — don't force 'online'
        const current = await redis.get(`presence:${userId}`);
        const status = current || 'online';
        await redis.set(`presence:${userId}`, status, 'EX', 600);
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
        logger.error(`[socket.io] CHANNEL_JOIN error:`, err);
      }
    });

    // -------------------------------------------------------------------------
    // JOIN_GUILD_ROOM — client joins a guild room after being added to a guild
    // -------------------------------------------------------------------------
    socket.on('JOIN_GUILD_ROOM', async (data: { guildId: string }) => {
      if (!data?.guildId) return;
      try {
        // Verify the user is actually a member of this guild
        const [membership] = await db
          .select({ id: guildMembers.id })
          .from(guildMembers)
          .where(and(eq(guildMembers.guildId, data.guildId), eq(guildMembers.userId, userId)))
          .limit(1);
        if (!membership) return;
        await socket.join(`guild:${data.guildId}`);
        // Also add to the tracked list so disconnect cleanup works
        userGuildIds.push(data.guildId);
      } catch (err) {
        logger.error(`[socket.io] JOIN_GUILD_ROOM error:`, err);
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
    socket.on('PRESENCE_UPDATE', async (data: { status: string; auto?: boolean; activity?: { name: string; type: string } | null }) => {
      if (!data?.status) return;
      if (!await checkWsRateLimit(userId, 'PRESENCE_UPDATE')) return;
      const validStatuses = ['online', 'idle', 'dnd', 'invisible'];
      if (!validStatuses.includes(data.status)) return;

      // Validate activity if provided
      const validActivityTypes = ['PLAYING', 'WATCHING', 'LISTENING', 'STREAMING'];
      let activity: { name: string; type: string } | null = null;
      if (data.activity && typeof data.activity.name === 'string' && validActivityTypes.includes(data.activity.type)) {
        activity = { name: data.activity.name.slice(0, 128), type: data.activity.type };
      }

      try {
        await redis.set(`presence:${userId}`, data.status, 'EX', 600);
        if (activity) {
          await redis.set(`presence:${userId}:activity`, JSON.stringify(activity), 'EX', 600);
        } else if (data.activity === null) {
          await redis.del(`presence:${userId}:activity`);
        }
        // Persist to DB only for explicit user-initiated status changes (not auto idle/online)
        if (!data.auto) {
          await db.update(users).set({ status: data.status }).where(eq(users.id, userId));
        }
        // Broadcast to all guilds — invisible users appear "offline" to others
        const broadcastStatus = data.status === 'invisible' ? 'offline' : data.status;
        const payload: { userId: string; status: string; activity?: { name: string; type: string } | null } = { userId, status: broadcastStatus };
        if (activity !== undefined && data.status !== 'invisible') payload.activity = activity;
        for (const guildId of userGuildIds) {
          io.to(`guild:${guildId}`).emit('PRESENCE_UPDATE', payload);
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
        logger.error('[socket.io] STAGE_START error:', err);
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
        logger.error('[socket.io] STAGE_END error:', err);
      }
    });

    // -------------------------------------------------------------------------
    // STAGE_SPEAKER_ADD — host invites a speaker via socket
    // -------------------------------------------------------------------------
    socket.on('STAGE_SPEAKER_ADD', async (data: { channelId: string; sessionId: string; userId: string }) => {
      if (!data?.channelId || !data?.sessionId || !data?.userId) return;
      try {
        // Verify the requesting user is the session host
        const [session] = await db.select({ hostId: stageSessions.hostId })
          .from(stageSessions).where(eq(stageSessions.id, data.sessionId)).limit(1);
        if (!session || session.hostId !== userId) return;

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
        logger.error('[socket.io] STAGE_SPEAKER_ADD error:', err);
      }
    });

    // -------------------------------------------------------------------------
    // STAGE_SPEAKER_REMOVE — host removes a speaker via socket
    // -------------------------------------------------------------------------
    socket.on('STAGE_SPEAKER_REMOVE', async (data: { channelId: string; sessionId: string; userId: string }) => {
      if (!data?.channelId || !data?.sessionId || !data?.userId) return;
      try {
        // Verify the requesting user is the session host
        const [session] = await db.select({ hostId: stageSessions.hostId })
          .from(stageSessions).where(eq(stageSessions.id, data.sessionId)).limit(1);
        if (!session || session.hostId !== userId) return;

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
        logger.error('[socket.io] STAGE_SPEAKER_REMOVE error:', err);
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
        logger.error('[socket.io] STAGE_HAND_RAISE error:', err);
      }
    });

    // -------------------------------------------------------------------------
    // SPATIAL_POSITION_UPDATE — relay spatial position to channel peers
    // -------------------------------------------------------------------------
    socket.on('SPATIAL_POSITION_UPDATE', async (data: { channelId: string; x: number; y: number }) => {
      if (!data?.channelId || typeof data.x !== 'number' || typeof data.y !== 'number') return;
      if (!await checkWsRateLimit(userId, 'SPATIAL_POSITION_UPDATE')) return;
      if (!Number.isFinite(data.x) || !Number.isFinite(data.y)) return;
      if (!socket.rooms.has(`channel:${data.channelId}`)) return;
      // Clamp to 0–1
      const x = Math.max(0, Math.min(1, data.x));
      const y = Math.max(0, Math.min(1, data.y));
      // Store in memory
      if (!spatialPositions.has(data.channelId)) {
        spatialPositions.set(data.channelId, new Map());
      }
      spatialPositions.get(data.channelId)!.set(userId, { x, y });
      // Relay to others in the channel (exclude sender)
      socket.to(`channel:${data.channelId}`).emit('SPATIAL_POSITION_UPDATE', {
        channelId: data.channelId,
        userId,
        x,
        y,
      });
    });

    // -------------------------------------------------------------------------
    // SPATIAL_POSITIONS_REQUEST — send all current positions for a channel
    // -------------------------------------------------------------------------
    socket.on('SPATIAL_POSITIONS_REQUEST', (data: { channelId: string }) => {
      if (!data?.channelId) return;
      if (!socket.rooms.has(`channel:${data.channelId}`)) return;
      const channelPositions = spatialPositions.get(data.channelId);
      const positions: Record<string, { x: number; y: number }> = {};
      if (channelPositions) {
        for (const [uid, pos] of channelPositions) {
          positions[uid] = pos;
        }
      }
      socket.emit('SPATIAL_POSITIONS_SYNC', {
        channelId: data.channelId,
        positions,
      });
    });

    // -------------------------------------------------------------------------
    // SCREENSHOT_TAKEN — relay screenshot notification to channel members
    // -------------------------------------------------------------------------
    socket.on('SCREENSHOT_TAKEN', (data: { channelId: string }) => {
      if (!data?.channelId) return;
      socket.to(`channel:${data.channelId}`).emit('SCREENSHOT_TAKEN', {
        channelId: data.channelId,
        userId,
        timestamp: Date.now(),
      });
    });

    // -------------------------------------------------------------------------
    // WATCH_PARTY_SYNC — host broadcasts play/pause/seek to all viewers
    // -------------------------------------------------------------------------
    socket.on('WATCH_PARTY_SYNC', (data: { channelId: string; partyId: string; action: 'play' | 'pause' | 'seek'; currentTime: number }) => {
      if (!data?.channelId || !data?.partyId || !data?.action) return;
      if (!socket.rooms.has(`channel:${data.channelId}`)) return;
      socket.to(`channel:${data.channelId}`).emit('WATCH_PARTY_SYNC', {
        channelId: data.channelId,
        partyId: data.partyId,
        action: data.action,
        currentTime: data.currentTime ?? 0,
        userId,
      });
    });

    // -------------------------------------------------------------------------
    // WATCH_PARTY_REACTION — emoji reactions during watch party
    // -------------------------------------------------------------------------
    socket.on('WATCH_PARTY_REACTION', (data: { channelId: string; emoji: string }) => {
      if (!data?.channelId || !data?.emoji) return;
      if (!socket.rooms.has(`channel:${data.channelId}`)) return;
      socket.to(`channel:${data.channelId}`).emit('WATCH_PARTY_REACTION', {
        channelId: data.channelId,
        emoji: String(data.emoji).slice(0, 4),
        userId,
      });
    });

    // -------------------------------------------------------------------------
    // PLAYLIST_UPDATE — real-time playlist queue changes
    // -------------------------------------------------------------------------
    socket.on('PLAYLIST_UPDATE', (data: { channelId: string; playlistId: string; action: string; track?: any }) => {
      if (!data?.channelId || !data?.playlistId) return;
      if (!socket.rooms.has(`channel:${data.channelId}`)) return;
      socket.to(`channel:${data.channelId}`).emit('PLAYLIST_UPDATE', {
        channelId: data.channelId,
        playlistId: data.playlistId,
        action: data.action,
        track: data.track || null,
        userId,
      });
    });

    // -------------------------------------------------------------------------
    // PLAYLIST_VOTE — real-time vote to skip
    // -------------------------------------------------------------------------
    socket.on('PLAYLIST_VOTE', (data: { channelId: string; trackId: string; vote: 'skip' | 'keep' }) => {
      if (!data?.channelId || !data?.trackId) return;
      if (!socket.rooms.has(`channel:${data.channelId}`)) return;
      io.to(`channel:${data.channelId}`).emit('PLAYLIST_VOTE', {
        channelId: data.channelId,
        trackId: data.trackId,
        vote: data.vote,
        userId,
      });
    });

    // -------------------------------------------------------------------------
    // SCREEN_ANNOTATION — draw/highlight events on shared screen
    // -------------------------------------------------------------------------
    socket.on('SCREEN_ANNOTATION', (data: { channelId: string; tool: string; points: number[]; color: string; width: number; id: string }) => {
      if (!data?.channelId || !data?.points) return;
      if (!socket.rooms.has(`channel:${data.channelId}`)) return;
      socket.to(`channel:${data.channelId}`).emit('SCREEN_ANNOTATION', {
        channelId: data.channelId,
        tool: data.tool,
        points: data.points,
        color: data.color,
        width: data.width,
        id: data.id,
        userId,
      });
    });

    // -------------------------------------------------------------------------
    // SCREEN_ANNOTATION_CLEAR — clear annotations
    // -------------------------------------------------------------------------
    socket.on('SCREEN_ANNOTATION_CLEAR', (data: { channelId: string }) => {
      if (!data?.channelId) return;
      if (!socket.rooms.has(`channel:${data.channelId}`)) return;
      io.to(`channel:${data.channelId}`).emit('SCREEN_ANNOTATION_CLEAR', {
        channelId: data.channelId,
        userId,
      });
    });

    // Track which channels this user has presence in (for efficient cleanup on disconnect)
    const presenceChannels = new Set<string>();

    // -------------------------------------------------------------------------
    // CHANNEL_PRESENCE_JOIN — track user viewing a channel
    // -------------------------------------------------------------------------
    socket.on('CHANNEL_PRESENCE_JOIN', async (data: { channelId: string }) => {
      if (!data?.channelId) return;
      try {
        await redis.sadd(`channel-presence:${data.channelId}`, userId);
        await redis.expire(`channel-presence:${data.channelId}`, 3600);
        const [user] = await db
          .select({ id: users.id, username: users.username, avatarHash: users.avatarHash })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);
        presenceChannels.add(data.channelId);
        if (user) {
          socket.to(`channel:${data.channelId}`).emit('CHANNEL_PRESENCE_UPDATE', {
            channelId: data.channelId,
            action: 'join',
            user: { userId: user.id, username: user.username, avatarHash: user.avatarHash },
          });
        }
      } catch (err) {
        logger.error('[socket.io] CHANNEL_PRESENCE_JOIN error:', err);
      }
    });

    // -------------------------------------------------------------------------
    // CHANNEL_PRESENCE_LEAVE — stop tracking user viewing a channel
    // -------------------------------------------------------------------------
    socket.on('CHANNEL_PRESENCE_LEAVE', async (data: { channelId: string }) => {
      if (!data?.channelId) return;
      try {
        presenceChannels.delete(data.channelId);
        await redis.srem(`channel-presence:${data.channelId}`, userId);
        socket.to(`channel:${data.channelId}`).emit('CHANNEL_PRESENCE_UPDATE', {
          channelId: data.channelId,
          action: 'leave',
          user: { userId },
        });
      } catch (err) {
        logger.error('[socket.io] CHANNEL_PRESENCE_LEAVE error:', err);
      }
    });

    // -------------------------------------------------------------------------
    // VOICE_REACTION — audio emoji reaction in voice channel
    // -------------------------------------------------------------------------
    socket.on('VOICE_REACTION', (data: { channelId: string; reactionId: string; emoji: string }) => {
      if (!data?.channelId || !data?.reactionId) return;
      if (!socket.rooms.has(`channel:${data.channelId}`)) return;
      io.to(`channel:${data.channelId}`).emit('VOICE_REACTION', {
        channelId: data.channelId,
        userId,
        reactionId: data.reactionId,
        emoji: String(data.emoji || '').slice(0, 4),
      });
    });

    // -------------------------------------------------------------------------
    // FOCUS_SESSION_UPDATE — sync focus timer state across participants
    // -------------------------------------------------------------------------
    socket.on('FOCUS_SESSION_UPDATE', (data: { channelId: string; sessionId: string; phase: string; roundNumber?: number }) => {
      if (!data?.channelId || !data?.sessionId) return;
      if (!socket.rooms.has(`channel:${data.channelId}`)) return;
      io.to(`channel:${data.channelId}`).emit('FOCUS_SESSION_UPDATE', {
        channelId: data.channelId,
        sessionId: data.sessionId,
        phase: data.phase,
        roundNumber: data.roundNumber,
        updatedBy: userId,
      });
    });

    // -------------------------------------------------------------------------
    // AMBIENT_ROOM_UPDATE — broadcast ambient room changes
    // -------------------------------------------------------------------------
    socket.on('AMBIENT_ROOM_UPDATE', (data: { channelId: string; action: string; theme?: string; status?: string }) => {
      if (!data?.channelId) return;
      if (!socket.rooms.has(`channel:${data.channelId}`)) return;
      io.to(`channel:${data.channelId}`).emit('AMBIENT_ROOM_UPDATE', {
        channelId: data.channelId,
        action: data.action,
        userId,
        theme: data.theme,
        status: data.status,
      });
    });

    // -------------------------------------------------------------------------
    // P2P_SIGNAL — relay WebRTC signaling data for peer-to-peer file transfer
    // -------------------------------------------------------------------------
    socket.on('P2P_SIGNAL', (data: { targetUserId: string; signal: any; transferId: string; fileName?: string; fileSize?: number }) => {
      if (!data?.targetUserId || !data?.signal || !data?.transferId) return;
      io.to(`user:${data.targetUserId}`).emit('P2P_SIGNAL', {
        fromUserId: userId,
        signal: data.signal,
        transferId: data.transferId,
        fileName: data.fileName,
        fileSize: data.fileSize,
      });
    });

    // -------------------------------------------------------------------------
    // DOCUMENT_JOIN — user opens a collaborative document channel
    // -------------------------------------------------------------------------
    const joinedDocChannels = new Set<string>();

    socket.on('DOCUMENT_JOIN', async (data: { channelId: string }) => {
      if (!data?.channelId) return;
      try {
        await redis.sadd(`doc-presence:${data.channelId}`, userId);
        await redis.expire(`doc-presence:${data.channelId}`, 3600);
        joinedDocChannels.add(data.channelId);

        const [user] = await db
          .select({ id: users.id, username: users.username, avatarHash: users.avatarHash })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (user) {
          socket.to(`channel:${data.channelId}`).emit('DOCUMENT_PRESENCE_UPDATE', {
            channelId: data.channelId,
            action: 'join',
            user: { userId: user.id, username: user.username, avatarHash: user.avatarHash },
          });
        }
      } catch (err) {
        logger.error('[socket.io] DOCUMENT_JOIN error:', err);
      }
    });

    // -------------------------------------------------------------------------
    // DOCUMENT_LEAVE — user closes a collaborative document channel
    // -------------------------------------------------------------------------
    socket.on('DOCUMENT_LEAVE', async (data: { channelId: string }) => {
      if (!data?.channelId) return;
      try {
        joinedDocChannels.delete(data.channelId);
        await redis.srem(`doc-presence:${data.channelId}`, userId);
        socket.to(`channel:${data.channelId}`).emit('DOCUMENT_PRESENCE_UPDATE', {
          channelId: data.channelId,
          action: 'leave',
          user: { userId },
        });
      } catch (err) {
        logger.error('[socket.io] DOCUMENT_LEAVE error:', err);
      }
    });

    // -------------------------------------------------------------------------
    // DOCUMENT_UPDATE — relay Yjs update binary to peers (CRDT sync)
    // -------------------------------------------------------------------------
    socket.on('DOCUMENT_UPDATE', (data: { channelId: string; update: string }) => {
      if (!data?.channelId || !data?.update) return;
      if (!socket.rooms.has(`channel:${data.channelId}`)) return;
      // Relay the Yjs update (base64-encoded) to all other clients on the same channel
      socket.to(`channel:${data.channelId}`).emit('DOCUMENT_UPDATE', {
        channelId: data.channelId,
        update: data.update,
        userId,
      });
    });

    // -------------------------------------------------------------------------
    // DOCUMENT_AWARENESS — relay Yjs awareness state (cursor positions, selections)
    // -------------------------------------------------------------------------
    socket.on('DOCUMENT_AWARENESS', (data: { channelId: string; state: string }) => {
      if (!data?.channelId || !data?.state) return;
      if (!socket.rooms.has(`channel:${data.channelId}`)) return;
      socket.to(`channel:${data.channelId}`).emit('DOCUMENT_AWARENESS', {
        channelId: data.channelId,
        state: data.state,
        userId,
      });
    });

    // -------------------------------------------------------------------------
    // DOCUMENT_TITLE_UPDATE — relay title changes in real time
    // -------------------------------------------------------------------------
    socket.on('DOCUMENT_TITLE_UPDATE', (data: { channelId: string; title: string }) => {
      if (!data?.channelId || typeof data.title !== 'string') return;
      if (!socket.rooms.has(`channel:${data.channelId}`)) return;
      socket.to(`channel:${data.channelId}`).emit('DOCUMENT_TITLE_UPDATE', {
        channelId: data.channelId,
        title: data.title.slice(0, 200),
        userId,
      });
    });

    // -------------------------------------------------------------------------
    // Disconnect handler
    // -------------------------------------------------------------------------
    socket.on('disconnect', async () => {
      // Clean up document presence
      for (const channelId of joinedDocChannels) {
        try {
          await redis.srem(`doc-presence:${channelId}`, userId);
          socket.to(`channel:${channelId}`).emit('DOCUMENT_PRESENCE_UPDATE', {
            channelId,
            action: 'leave',
            user: { userId },
          });
        } catch {
          // Non-fatal
        }
      }
      joinedDocChannels.clear();
      activeWebSocketConnections.dec();
      // Clean up spatial positions for this user
      for (const [channelId, posMap] of spatialPositions) {
        posMap.delete(userId);
        if (posMap.size === 0) spatialPositions.delete(channelId);
      }
      // Clean up channel presence for this user (O(k) where k = channels joined, not O(N) keyspace)
      for (const channelId of presenceChannels) {
        try {
          await redis.srem(`channel-presence:${channelId}`, userId);
        } catch {
          // Non-fatal
        }
      }
      presenceChannels.clear();
      // Check if the user has other active sockets
      const userRoom = io.sockets.adapter.rooms.get(`user:${userId}`);
      if (!userRoom || userRoom.size === 0) {
        // No more connections — set a 30s grace period instead of deleting immediately.
        // If the user reconnects within 30s, heartbeat resumes and refreshes to 600s.
        // If not, the key expires naturally and they go offline.
        try {
          await redis.expire(`presence:${userId}`, 30);
          await redis.expire(`presence:${userId}:activity`, 30);
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
