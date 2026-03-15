/**
 * relay/voice.ts — Voice federation coordinator.
 *
 * Handles federated voice channel joins via relay-mediated LiveKit token exchange.
 * Flow:
 *   1. Remote user requests voice join via their instance
 *   2. Their instance sends VoiceJoinRequest via relay
 *   3. This instance generates a LiveKit token for the remote user
 *   4. Token sent back via relay as VoiceJoinApproved
 *   5. Remote user connects directly to LiveKit server
 *   6. If NAT blocks WebRTC → use relay's TURN proxy
 */

import { AccessToken } from 'livekit-server-sdk';
import { db } from '../db/index';
import { channels } from '../db/schema/channels';
import { users } from '../db/schema/users';
import { guildMembers } from '../db/schema/guilds';
import { eq, and } from 'drizzle-orm';
import { redis } from '../lib/redis';
import { getIO } from '../lib/socket-io';
import { queueOutboundActivity, type ActivityType } from '../federation/activities';
import { logger } from '../lib/logger';

const LIVEKIT_ENABLED = !!(process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET);

/**
 * Handle a federated voice join request.
 * Called when a remote instance sends VoiceJoinRequest to our inbox.
 */
export async function handleFederatedVoiceJoin(
  instanceId: string,
  remoteUserId: string,
  channelId: string,
  federationAddress: string,
  instanceDomain: string,
): Promise<{ token: string; endpoint: string } | null> {
  if (!LIVEKIT_ENABLED) {
    logger.warn('[voice:federation] LiveKit not configured, rejecting federated voice join');
    return null;
  }

  // Verify the channel exists and is voice-capable
  const [channel] = await db.select({ id: channels.id, guildId: channels.guildId, type: channels.type })
    .from(channels)
    .where(eq(channels.id, channelId))
    .limit(1);

  if (!channel || !channel.guildId) {
    logger.warn(`[voice:federation] Channel ${channelId} not found or not a guild channel`);
    return null;
  }

  const type = String(channel.type ?? '').trim().toUpperCase().replace(/-/g, '_');
  if (!['GUILD_VOICE', 'VOICE', 'GUILD_STAGE_VOICE', 'STAGE', 'STAGE_VOICE'].includes(type)) {
    logger.warn(`[voice:federation] Channel ${channelId} is not voice-capable (type: ${channel.type})`);
    return null;
  }

  // Create federated participant identity
  const identity = `fed:${instanceDomain}:${remoteUserId}`;
  const participantName = federationAddress;

  // Generate LiveKit token with limited permissions
  const at = new AccessToken(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!, {
    identity,
    name: participantName,
    ttl: 3600, // 1 hour
  });

  at.addGrant({
    room: channelId,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: false, // Restricted for federated users
  });

  const token = await at.toJwt();
  const endpoint = process.env.LIVEKIT_URL || 'ws://localhost:7880';

  // Track federated voice state in Redis
  const voiceState = {
    userId: identity,
    username: federationAddress,
    displayName: federationAddress,
    channelId,
    selfMute: false,
    selfDeaf: false,
    joinedAt: new Date().toISOString(),
    isFederated: true,
    instanceDomain,
  };

  await redis.hset(`voice:channel:${channelId}`, identity, JSON.stringify(voiceState));
  await redis.set(`voice:user:${identity}`, channelId, 'EX', 86400);

  // Broadcast voice state update to guild members
  try {
    const io = getIO();
    io.to(`guild:${channel.guildId}`).emit('VOICE_STATE_UPDATE', {
      type: 'join',
      ...voiceState,
    });
  } catch { /* socket may not be available */ }

  logger.info(`[voice:federation] ${federationAddress} joined voice channel ${channelId}`);

  return { token, endpoint };
}

/**
 * Handle a federated voice leave.
 */
export async function handleFederatedVoiceLeave(
  remoteUserId: string,
  channelId: string,
  instanceDomain: string,
): Promise<void> {
  const identity = `fed:${instanceDomain}:${remoteUserId}`;

  // Remove from Redis
  await redis.hdel(`voice:channel:${channelId}`, identity);
  await redis.del(`voice:user:${identity}`);

  // Get channel's guild for broadcasting
  const [channel] = await db.select({ guildId: channels.guildId })
    .from(channels).where(eq(channels.id, channelId)).limit(1);

  if (channel?.guildId) {
    try {
      const io = getIO();
      io.to(`guild:${channel.guildId}`).emit('VOICE_STATE_UPDATE', {
        type: 'leave',
        userId: identity,
        channelId,
        isFederated: true,
        instanceDomain,
      });
    } catch { /* socket may not be available */ }
  }

  logger.info(`[voice:federation] fed:${instanceDomain}:${remoteUserId} left voice channel ${channelId}`);
}
