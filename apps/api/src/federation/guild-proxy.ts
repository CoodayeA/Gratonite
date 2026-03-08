/** federation/guild-proxy.ts — Proxies actions to remote guild instances. */

import { db } from '../db/index';
import { remoteGuilds } from '../db/schema/remote-guilds';
import { federatedInstances } from '../db/schema/federation-instances';
import { eq } from 'drizzle-orm';
import { getInstanceDomain } from './index';
import { queueOutboundActivity } from './activities';

/** Forward a message creation to the remote instance that owns the guild. */
export async function proxyMessageToRemoteGuild(
  remoteGuildId: string,
  channelId: string,
  authorFederationAddress: string,
  content: string,
  attachments: unknown[],
): Promise<{ success: boolean; remoteMessageId?: string }> {
  const [rg] = await db
    .select({ remoteGuild: remoteGuilds, instance: federatedInstances })
    .from(remoteGuilds)
    .innerJoin(federatedInstances, eq(federatedInstances.id, remoteGuilds.instanceId))
    .where(eq(remoteGuilds.id, remoteGuildId))
    .limit(1);

  if (!rg || rg.instance.status !== 'active') {
    return { success: false };
  }

  const domain = getInstanceDomain();

  await queueOutboundActivity(rg.instance.id, 'MessageCreate', {
    guildId: rg.remoteGuild.remoteGuildId,
    channelId,
    author: authorFederationAddress,
    content,
    attachments,
    originInstance: `https://${domain}`,
    timestamp: new Date().toISOString(),
  });

  return { success: true };
}

/** Send a guild join request to a remote instance. */
export async function sendGuildJoinRequest(
  instanceId: string,
  remoteGuildId: string,
  userFederationAddress: string,
): Promise<void> {
  await queueOutboundActivity(instanceId, 'GuildJoinRequest', {
    guildId: remoteGuildId,
    user: userFederationAddress,
    originInstance: `https://${getInstanceDomain()}`,
  });
}

/** Send a guild leave notification to a remote instance. */
export async function sendGuildLeaveNotification(
  instanceId: string,
  remoteGuildId: string,
  userFederationAddress: string,
): Promise<void> {
  await queueOutboundActivity(instanceId, 'GuildLeave', {
    guildId: remoteGuildId,
    user: userFederationAddress,
    originInstance: `https://${getInstanceDomain()}`,
  });
}
