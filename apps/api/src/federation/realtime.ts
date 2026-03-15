/** federation/realtime.ts — Federation WebSocket namespace for real-time events. */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { db } from '../db/index';
import { federatedInstances } from '../db/schema/federation-instances';
import { channels } from '../db/schema/channels';
import { eq } from 'drizzle-orm';
import { verifySignature } from './crypto';
import { isFederationEnabled, getFederationFlags } from './index';
import { getIO } from '../lib/socket-io';
import { sanitizeFederationContent } from '../middleware/federation-sanitize';

/** Initialize the /federation/ws namespace on the Socket.IO server. */
export function initFederationNamespace(io: SocketIOServer): void {
  const fedNs = io.of('/federation/ws');

  // Auth middleware — verify instance identity via signed token
  fedNs.use(async (socket: Socket, next) => {
    if (!isFederationEnabled()) {
      return next(new Error('Federation is disabled on this instance'));
    }

    const flags = getFederationFlags();
    if (!flags.allowInbound) {
      return next(new Error('Inbound federation is disabled'));
    }

    try {
      const instanceUrl = socket.handshake.auth?.instanceUrl as string;
      const signature = socket.handshake.auth?.signature as string;
      const timestamp = socket.handshake.auth?.timestamp as string;

      if (!instanceUrl || !signature || !timestamp) {
        return next(new Error('Missing federation auth credentials'));
      }

      // Reject timestamps older than 5 minutes
      const tsAge = Date.now() - new Date(timestamp).getTime();
      if (Math.abs(tsAge) > 5 * 60 * 1000) {
        return next(new Error('Stale federation auth timestamp'));
      }

      const [instance] = await db
        .select()
        .from(federatedInstances)
        .where(eq(federatedInstances.baseUrl, instanceUrl))
        .limit(1);

      if (!instance || instance.status !== 'active' || !instance.publicKeyPem) {
        return next(new Error('Unknown or inactive instance'));
      }

      const signedData = `${instanceUrl}:${timestamp}`;
      if (!verifySignature(signedData, signature, instance.publicKeyPem)) {
        return next(new Error('Invalid federation signature'));
      }

      socket.data.instanceId = instance.id;
      socket.data.instanceUrl = instanceUrl;
      next();
    } catch {
      next(new Error('Federation auth failed'));
    }
  });

  fedNs.on('connection', (socket: Socket) => {
    const instanceId = socket.data.instanceId as string;
    console.info(`[federation:ws] Instance ${socket.data.instanceUrl} connected`);

    socket.join(`instance:${instanceId}`);

    // Track which guilds this instance is subscribed to
    const subscribedGuilds = new Set<string>();

    socket.on('SUBSCRIBE_GUILD', (data: { guildId: string }) => {
      if (data?.guildId) {
        subscribedGuilds.add(data.guildId);
        socket.join(`fed-guild:${data.guildId}`);
      }
    });

    socket.on('UNSUBSCRIBE_GUILD', (data: { guildId: string }) => {
      if (data?.guildId) {
        subscribedGuilds.delete(data.guildId);
        socket.leave(`fed-guild:${data.guildId}`);
      }
    });

    // Validate that the instance has subscribed to the guild before re-emitting
    socket.on('FED_MESSAGE_CREATE', async (data: unknown) => {
      const msg = data as { channelId?: string; guildId?: string; [key: string]: unknown };
      if (!msg.channelId || !msg.guildId) return;

      // Verify the instance is subscribed to this guild
      if (!subscribedGuilds.has(msg.guildId)) return;

      // Verify the channel belongs to the guild
      const [ch] = await db
        .select({ guildId: channels.guildId })
        .from(channels)
        .where(eq(channels.id, msg.channelId))
        .limit(1);
      if (!ch || ch.guildId !== msg.guildId) return;

      // Sanitize content before re-emitting to local clients
      const sanitized = sanitizeFederationContent(msg as Record<string, unknown>);
      getIO().to(`channel:${msg.channelId}`).emit('MESSAGE_CREATE', sanitized);
    });

    socket.on('FED_TYPING_START', (data: unknown) => {
      const d = data as { channelId?: string; guildId?: string; [key: string]: unknown };
      if (!d.channelId || !d.guildId) return;
      if (!subscribedGuilds.has(d.guildId)) return;
      getIO().to(`channel:${d.channelId}`).emit('TYPING_START', d);
    });

    socket.on('FED_PRESENCE_UPDATE', (data: unknown) => {
      const d = data as { guildId?: string; [key: string]: unknown };
      if (!d.guildId) return;
      if (!subscribedGuilds.has(d.guildId)) return;
      getIO().to(`guild:${d.guildId}`).emit('PRESENCE_UPDATE', d);
    });

    socket.on('disconnect', () => {
      console.info(`[federation:ws] Instance ${socket.data.instanceUrl} disconnected`);
    });
  });
}

/** Emit a federation event to connected instances for a specific guild. */
export function emitFederationEvent(guildId: string, event: string, data: unknown): void {
  try {
    const io = getIO();
    io.of('/federation/ws').to(`fed-guild:${guildId}`).emit(event, data);
  } catch {
    // Namespace may not exist if federation not initialized
  }
}

/**
 * Process a relay-delivered envelope that has been decrypted.
 * Re-emits the contained activity to the appropriate local rooms.
 */
export function handleRelayDeliveredActivity(activity: {
  type: string;
  data: Record<string, unknown>;
}): void {
  const io = getIO();

  switch (activity.type) {
    case 'MessageCreate': {
      const d = activity.data as { channelId?: string; [k: string]: unknown };
      if (d.channelId) {
        const sanitized = sanitizeFederationContent(d);
        io.to(`channel:${d.channelId}`).emit('MESSAGE_CREATE', sanitized);
      }
      break;
    }
    case 'TypingStart': {
      const d = activity.data as { channelId?: string; [k: string]: unknown };
      if (d.channelId) {
        io.to(`channel:${d.channelId}`).emit('TYPING_START', d);
      }
      break;
    }
    case 'PresenceUpdate': {
      const d = activity.data as { guildId?: string; [k: string]: unknown };
      if (d.guildId) {
        io.to(`guild:${d.guildId}`).emit('PRESENCE_UPDATE', d);
      }
      break;
    }
    case 'VoiceStateUpdate': {
      const d = activity.data as { channelId?: string; guildId?: string; [k: string]: unknown };
      if (d.guildId) {
        io.to(`guild:${d.guildId}`).emit('VOICE_STATE_UPDATE', d);
      }
      break;
    }
    default:
      // Unknown activity type — log and ignore
      break;
  }
}
