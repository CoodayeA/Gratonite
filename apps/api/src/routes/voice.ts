/**
 * routes/voice.ts — Voice channel endpoints using LiveKit.
 *
 * Mounted at /api/v1/voice by src/routes/index.ts.
 *
 * Endpoints:
 *   POST /join   — Join a voice channel, returns LiveKit token + endpoint
 *   POST /leave  — Leave the current voice channel
 *
 * Additional channel-scoped endpoints (mounted separately in routes/index.ts):
 *   GET /channels/:channelId/voice-states — List users in a voice channel
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AccessToken } from 'livekit-server-sdk';
import { and, eq, inArray } from 'drizzle-orm';

import { db } from '../db/index';
import { channels, dmChannelMembers } from '../db/schema/channels';
import { users } from '../db/schema/users';
import { callHistory } from '../db/schema/call-history';
import { Permissions } from '../db/schema/roles';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { getIO } from '../lib/socket-io';
import { hasChannelPermission } from './roles';
import { redis } from '../lib/redis';
import { desc } from 'drizzle-orm';

export const voiceRouter = Router();

/**
 * Separate router for the channel-scoped voice-states endpoint.
 * Mounted at /api/v1/channels/:channelId in routes/index.ts.
 */
export const voiceStatesRouter = Router({ mergeParams: true });

/**
 * asyncHandler — Wraps an async route handler so that rejected promises are
 * forwarded to Express's error middleware via next(err).
 */
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// ---------------------------------------------------------------------------
// LiveKit env var validation
// ---------------------------------------------------------------------------
const LIVEKIT_ENABLED = !!(process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET);
if (!LIVEKIT_ENABLED) {
  console.warn('[voice] WARNING: LIVEKIT_API_KEY and/or LIVEKIT_API_SECRET are not set. Voice features will be disabled.');
}
if (!process.env.LIVEKIT_URL) {
  console.warn('[voice] WARNING: LIVEKIT_URL is not set, falling back to ws://localhost:7880. Set LIVEKIT_URL in production.');
}

// ---------------------------------------------------------------------------
// Redis helpers for voice-state tracking
// ---------------------------------------------------------------------------

/**
 * Voice state stored per user in a voice channel.
 */
interface VoiceStateEntry {
  userId: string;
  username: string;
  displayName: string;
  channelId: string;
  selfMute: boolean;
  selfDeaf: boolean;
  joinedAt: string;
}

const VOICE_STATE_PREFIX = 'voice:channel:';
const VOICE_USER_PREFIX = 'voice:user:';

/**
 * Record a user joining a voice channel.
 */
async function addVoiceState(entry: VoiceStateEntry): Promise<void> {
  const key = `${VOICE_STATE_PREFIX}${entry.channelId}`;
  const userKey = `${VOICE_USER_PREFIX}${entry.userId}`;
  // Store the state as a hash field keyed by userId
  await redis.hset(key, entry.userId, JSON.stringify(entry));
  // Also store which channel this user is in (for quick lookup / leave)
  await redis.set(userKey, entry.channelId, 'EX', 86400); // 24h TTL safety net
}

/**
 * Remove a user from their current voice channel.
 */
async function removeVoiceState(userId: string): Promise<string | null> {
  const userKey = `${VOICE_USER_PREFIX}${userId}`;
  const channelId = await redis.get(userKey);
  if (channelId) {
    const key = `${VOICE_STATE_PREFIX}${channelId}`;
    await redis.hdel(key, userId);
    await redis.del(userKey);
  }
  return channelId;
}

/**
 * Get all voice states for a channel.
 */
async function getVoiceStates(channelId: string): Promise<VoiceStateEntry[]> {
  const key = `${VOICE_STATE_PREFIX}${channelId}`;
  const raw = await redis.hgetall(key);
  return Object.values(raw).map((v) => JSON.parse(v) as VoiceStateEntry);
}

function normalizeChannelType(type: string | null | undefined): string {
  return String(type ?? '').trim().toUpperCase().replace(/-/g, '_');
}

function isVoiceCapableType(type: string | null | undefined): boolean {
  const normalized = normalizeChannelType(type);
  return (
    normalized === 'GUILD_VOICE' ||
    normalized === 'VOICE' ||
    normalized === 'GUILD_STAGE_VOICE' ||
    normalized === 'STAGE' ||
    normalized === 'STAGE_VOICE' ||
    normalized === 'DM' ||
    normalized === 'GROUP_DM'
  );
}

function isDmLikeType(type: string | null | undefined): boolean {
  const normalized = normalizeChannelType(type);
  return normalized === 'DM' || normalized === 'GROUP_DM';
}

// ---------------------------------------------------------------------------
// POST /join — Join a voice channel
// ---------------------------------------------------------------------------

const joinSchema = z.object({
  channelId: z.string().uuid(),
  selfMute: z.boolean().optional(),
  selfDeaf: z.boolean().optional(),
});

voiceRouter.post(
  '/join',
  requireAuth,
  validate(joinSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { channelId, selfMute, selfDeaf } = req.body;
    const userId = req.userId!;

    // Verify the channel exists and is a voice channel
    const [channel] = await db
      .select()
      .from(channels)
      .where(eq(channels.id, channelId))
      .limit(1);

    if (!channel) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Channel not found' });
      return;
    }

    if (!isVoiceCapableType(channel.type)) {
      res.status(400).json({ code: 'BAD_REQUEST', message: 'Channel is not a voice channel' });
      return;
    }

    // Check CONNECT permission for guild voice channels
    if (channel.guildId) {
      const canConnect = await hasChannelPermission(userId, channel.guildId, channelId, Permissions.CONNECT);
      if (!canConnect) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'Missing CONNECT permission for this voice channel' });
        return;
      }
    }

    // Ensure user is a participant for DM/GROUP_DM voice joins
    if (!channel.guildId && isDmLikeType(channel.type)) {
      const [membership] = await db
        .select({ id: dmChannelMembers.id })
        .from(dmChannelMembers)
        .where(and(
          eq(dmChannelMembers.channelId, channelId),
          eq(dmChannelMembers.userId, userId),
        ))
        .limit(1);

      if (!membership) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'You are not a member of this direct message channel' });
        return;
      }
    }

    // Check voice user limit
    if (channel.userLimit && channel.userLimit > 0) {
      const currentStates = await getVoiceStates(channelId);
      if (currentStates.length >= channel.userLimit) {
        res.status(403).json({ code: 'CHANNEL_FULL', message: 'Voice channel is full' });
        return;
      }
    }

    // Get user info for participant name
    const [user] = await db
      .select({ username: users.username, displayName: users.displayName })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const participantName = user?.displayName || user?.username || userId.slice(0, 8);

    // Room name is the channel ID
    const roomName = channelId;

    // Validate LiveKit is configured before attempting to create a token
    if (!LIVEKIT_ENABLED) {
      res.status(503).json({ code: 'SERVICE_UNAVAILABLE', message: 'Voice features are not configured on this server' });
      return;
    }

    // Create LiveKit access token
    const apiKey = process.env.LIVEKIT_API_KEY!;
    const apiSecret = process.env.LIVEKIT_API_SECRET!;

    const at = new AccessToken(apiKey, apiSecret, {
      identity: userId,
      name: participantName,
    });

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    // The WebSocket URL for the frontend to connect
    const endpoint = process.env.LIVEKIT_URL || 'ws://localhost:7880';

    // Track voice state in Redis
    const voiceState: VoiceStateEntry = {
      userId,
      username: user?.username || 'unknown',
      displayName: participantName,
      channelId,
      selfMute: selfMute ?? false,
      selfDeaf: selfDeaf ?? false,
      joinedAt: new Date().toISOString(),
    };

    // Remove from any previous channel first
    await removeVoiceState(userId);
    await addVoiceState(voiceState);

    // Broadcast VOICE_STATE_UPDATE so other clients can play join sounds / update UI
    try {
      const io = getIO();
      const room = channel.guildId ? `guild:${channel.guildId}` : `channel:${channelId}`;
      io.to(room).emit('VOICE_STATE_UPDATE', {
        type: 'join',
        userId,
        username: user?.username || 'unknown',
        displayName: participantName,
        channelId,
        selfMute: selfMute ?? false,
        selfDeaf: selfDeaf ?? false,
      });
    } catch {
      // Socket.io may not be initialised in tests
    }

    res.json({
      token,
      endpoint,
      voiceState: {
        channelId,
        userId,
        selfMute: selfMute ?? false,
        selfDeaf: selfDeaf ?? false,
        sessionId: roomName,
      },
    });
  }),
);

// ---------------------------------------------------------------------------
// POST /leave — Leave the current voice channel
// ---------------------------------------------------------------------------

voiceRouter.post(
  '/leave',
  requireAuth,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.userId!;

    // Remove voice state from Redis and get the channel they were in
    const channelId = await removeVoiceState(userId);

    if (channelId) {
      // Look up channel to determine which room to broadcast to
      try {
        const [channel] = await db
          .select({ guildId: channels.guildId })
          .from(channels)
          .where(eq(channels.id, channelId))
          .limit(1);

        const io = getIO();
        const room = channel?.guildId ? `guild:${channel.guildId}` : `channel:${channelId}`;
        io.to(room).emit('VOICE_STATE_UPDATE', {
          type: 'leave',
          userId,
          channelId,
        });
      } catch {
        // Socket.io may not be initialised in tests
      }
    }

    res.json({ ok: true });
  }),
);

// ---------------------------------------------------------------------------
// GET /voice-states — List users currently in a voice channel
// ---------------------------------------------------------------------------
// Mounted at /api/v1/channels/:channelId/voice-states via voiceStatesRouter

voiceStatesRouter.get(
  '/voice-states',
  requireAuth,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const channelId = req.params.channelId as string;

    if (!channelId) {
      res.status(400).json({ code: 'BAD_REQUEST', message: 'Missing channelId' });
      return;
    }

    // Verify the channel exists
    const [channel] = await db
      .select()
      .from(channels)
      .where(eq(channels.id, channelId))
      .limit(1);

    if (!channel) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Channel not found' });
      return;
    }

    const states = await getVoiceStates(channelId);

    // Enrich any states missing displayName/username by looking them up from DB
    const staleIds = states
      .filter(s => !s.displayName || s.displayName === 'Unknown')
      .map(s => s.userId);

    if (staleIds.length > 0) {
      const dbUsers = await db
        .select({ id: users.id, username: users.username, displayName: users.displayName })
        .from(users)
        .where(inArray(users.id, staleIds));
      const userMap = new Map(dbUsers.map(u => [u.id, u]));
      for (const state of states) {
        if (staleIds.includes(state.userId)) {
          const u = userMap.get(state.userId);
          if (u) {
            state.displayName = u.displayName || u.username || 'Unknown';
            state.username = u.username || 'unknown';
          }
        }
      }
    }

    res.json(states);
  }),
);

// ---------------------------------------------------------------------------
// POST /call-invite — Invite DM/GROUP_DM participants to a call
// ---------------------------------------------------------------------------

const callInviteSchema = z.object({
  channelId: z.string().uuid(),
  withVideo: z.boolean().optional(),
});

voiceRouter.post(
  '/call-invite',
  requireAuth,
  validate(callInviteSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { channelId, withVideo } = req.body;
    const userId = req.userId!;

    // Verify channel exists and is DM/GROUP_DM
    const [channel] = await db
      .select()
      .from(channels)
      .where(eq(channels.id, channelId))
      .limit(1);

    if (!channel) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Channel not found' });
      return;
    }

    if (!isDmLikeType(channel.type)) {
      res.status(400).json({ code: 'BAD_REQUEST', message: 'Call invites are only for DM/GROUP_DM channels' });
      return;
    }

    // Verify caller is a member
    const [membership] = await db
      .select({ id: dmChannelMembers.id })
      .from(dmChannelMembers)
      .where(and(
        eq(dmChannelMembers.channelId, channelId),
        eq(dmChannelMembers.userId, userId),
      ))
      .limit(1);

    if (!membership) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'You are not a member of this channel' });
      return;
    }

    // Get caller info
    const [caller] = await db
      .select({ username: users.username, displayName: users.displayName, avatarHash: users.avatarHash })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    // Store pending call in Redis (60s TTL)
    await redis.set(`pendingCall:${channelId}`, JSON.stringify({
      callerId: userId,
      withVideo: withVideo ?? false,
      startedAt: Date.now(),
    }), 'EX', 60);

    // Get all other members to notify
    const members = await db
      .select({ userId: dmChannelMembers.userId })
      .from(dmChannelMembers)
      .where(and(
        eq(dmChannelMembers.channelId, channelId),
      ));

    // Emit CALL_INVITE to each recipient's personal room
    try {
      const io = getIO();
      const payload = {
        channelId,
        callerId: userId,
        callerName: caller?.displayName || caller?.username || 'Unknown',
        callerAvatar: caller?.avatarHash ?? null,
        withVideo: withVideo ?? false,
      };
      for (const member of members) {
        if (member.userId !== userId) {
          io.to(`user:${member.userId}`).emit('CALL_INVITE', payload);
        }
      }
    } catch {
      // Socket.io may not be initialised in tests
    }

    res.json({ ok: true });
  }),
);

// ---------------------------------------------------------------------------
// POST /call-answer — Accept an incoming call
// ---------------------------------------------------------------------------

const callAnswerSchema = z.object({
  channelId: z.string().uuid(),
});

voiceRouter.post(
  '/call-answer',
  requireAuth,
  validate(callAnswerSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { channelId } = req.body;
    const userId = req.userId!;

    // Verify membership
    const [answerMembership] = await db
      .select({ id: dmChannelMembers.id })
      .from(dmChannelMembers)
      .where(and(
        eq(dmChannelMembers.channelId, channelId),
        eq(dmChannelMembers.userId, userId),
      ))
      .limit(1);

    if (!answerMembership) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'You are not a member of this channel' });
      return;
    }

    // Check pending call exists
    const pendingRaw = await redis.get(`pendingCall:${channelId}`);
    if (!pendingRaw) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'No pending call for this channel' });
      return;
    }

    const pending = JSON.parse(pendingRaw);

    // Clear pending call
    await redis.del(`pendingCall:${channelId}`);

    // Notify the caller
    try {
      const io = getIO();
      io.to(`user:${pending.callerId}`).emit('CALL_ANSWER', { channelId, userId });
    } catch {
      // Socket.io may not be initialised in tests
    }

    // Generate LiveKit token for the answerer
    if (!LIVEKIT_ENABLED) {
      res.status(503).json({ code: 'SERVICE_UNAVAILABLE', message: 'Voice features are not configured' });
      return;
    }

    const [user] = await db
      .select({ username: users.username, displayName: users.displayName })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const participantName = user?.displayName || user?.username || userId.slice(0, 8);
    const at = new AccessToken(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!, {
      identity: userId,
      name: participantName,
    });
    at.addGrant({ room: channelId, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true });
    const token = await at.toJwt();
    const endpoint = process.env.LIVEKIT_URL || 'ws://localhost:7880';

    res.json({ token, endpoint });
  }),
);

// ---------------------------------------------------------------------------
// POST /call-reject — Decline an incoming call
// ---------------------------------------------------------------------------

const callRejectSchema = z.object({
  channelId: z.string().uuid(),
});

voiceRouter.post(
  '/call-reject',
  requireAuth,
  validate(callRejectSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { channelId } = req.body;
    const userId = req.userId!;

    // Verify membership
    const [rejectMembership] = await db
      .select({ id: dmChannelMembers.id })
      .from(dmChannelMembers)
      .where(and(
        eq(dmChannelMembers.channelId, channelId),
        eq(dmChannelMembers.userId, userId),
      ))
      .limit(1);

    if (!rejectMembership) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'You are not a member of this channel' });
      return;
    }

    const pendingRaw = await redis.get(`pendingCall:${channelId}`);
    if (pendingRaw) {
      const pending = JSON.parse(pendingRaw);
      await redis.del(`pendingCall:${channelId}`);

      // Notify caller
      try {
        const io = getIO();
        io.to(`user:${pending.callerId}`).emit('CALL_REJECT', { channelId, userId });
      } catch {
        // Socket.io may not be initialised in tests
      }
    }

    res.json({ ok: true });
  }),
);

// ---------------------------------------------------------------------------
// POST /call-cancel — Caller cancels outgoing call
// ---------------------------------------------------------------------------

const callCancelSchema = z.object({
  channelId: z.string().uuid(),
});

voiceRouter.post(
  '/call-cancel',
  requireAuth,
  validate(callCancelSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { channelId } = req.body;
    const userId = req.userId!;

    // Verify the canceller is the original caller
    const cancelPendingRaw = await redis.get(`pendingCall:${channelId}`);
    if (cancelPendingRaw) {
      const cancelPending = JSON.parse(cancelPendingRaw);
      if (cancelPending.callerId !== userId) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'Only the caller can cancel the call' });
        return;
      }
    }

    await redis.del(`pendingCall:${channelId}`);

    // Notify all members in the channel
    const members = await db
      .select({ userId: dmChannelMembers.userId })
      .from(dmChannelMembers)
      .where(eq(dmChannelMembers.channelId, channelId));

    try {
      const io = getIO();
      for (const member of members) {
        if (member.userId !== userId) {
          io.to(`user:${member.userId}`).emit('CALL_CANCEL', { channelId, userId });
        }
      }
    } catch {
      // Socket.io may not be initialised in tests
    }

    res.json({ ok: true });
  }),
);

// ---------------------------------------------------------------------------
// GET /channels/:channelId/call-history — Call history for a channel
// ---------------------------------------------------------------------------

voiceStatesRouter.get(
  '/call-history',
  requireAuth,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const channelId = req.params.channelId as string;
    const limit = Math.min(Number(req.query.limit) || 20, 50);

    const records = await db
      .select()
      .from(callHistory)
      .where(eq(callHistory.channelId, channelId))
      .orderBy(desc(callHistory.startedAt))
      .limit(limit);

    res.json(records);
  }),
);
