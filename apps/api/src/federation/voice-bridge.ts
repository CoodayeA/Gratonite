/**
 * federation/voice-bridge.ts — Federation voice activity types and handlers.
 *
 * Adds voice-specific activity types for federated voice channel participation.
 */

import { queueOutboundActivity, type ActivityType } from './activities';
import { handleFederatedVoiceJoin, handleFederatedVoiceLeave } from '../relay/voice';
import { getIO } from '../lib/socket-io';
import { logger } from '../lib/logger';

/** Extended activity types for voice federation. */
export type VoiceActivityType =
  | 'VoiceJoinRequest'
  | 'VoiceJoinApproved'
  | 'VoiceJoinDenied'
  | 'VoiceLeave'
  | 'VoiceStateUpdate';

/**
 * Process an inbound voice federation activity.
 */
export async function processVoiceActivity(
  instanceId: string,
  activityType: string,
  payload: Record<string, unknown>,
  instanceDomain: string,
): Promise<Record<string, unknown>> {
  switch (activityType) {
    case 'VoiceJoinRequest': {
      const { channelId, userId, federationAddress } = payload as {
        channelId?: string; userId?: string; federationAddress?: string;
      };

      if (!channelId || !userId || !federationAddress) {
        return { type: 'VoiceJoinDenied', reason: 'Missing required fields' };
      }

      const result = await handleFederatedVoiceJoin(
        instanceId,
        userId,
        channelId,
        federationAddress,
        instanceDomain,
      );

      if (result) {
        // Send the token back via outbound activity
        await queueOutboundActivity(instanceId, 'GuildJoinApproved' as ActivityType, {
          type: 'VoiceJoinApproved',
          channelId,
          userId,
          federationAddress,
          token: result.token,
          endpoint: result.endpoint,
        });

        return {
          type: 'VoiceJoinApproved',
          channelId,
          token: result.token,
          endpoint: result.endpoint,
        };
      }

      return { type: 'VoiceJoinDenied', reason: 'Voice not available or channel not found' };
    }

    case 'VoiceLeave': {
      const { channelId: leaveChannelId, userId: leaveUserId } = payload as {
        channelId?: string; userId?: string;
      };

      if (leaveChannelId && leaveUserId) {
        await handleFederatedVoiceLeave(leaveUserId, leaveChannelId, instanceDomain);
      }
      return { status: 'ok' };
    }

    case 'VoiceStateUpdate': {
      // Broadcast voice state update to local guild members
      const { channelId: stateChannelId, guildId: stateGuildId } = payload as {
        channelId?: string; guildId?: string;
      };

      if (stateGuildId) {
        try {
          const io = getIO();
          io.to(`guild:${stateGuildId}`).emit('VOICE_STATE_UPDATE', {
            ...payload,
            isFederated: true,
          });
        } catch { /* socket may not be available */ }
      }
      return { status: 'ok' };
    }

    default:
      return { status: 'unknown_voice_activity' };
  }
}
