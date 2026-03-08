/** federation/sync.ts — Guild replication sync between primary and secondary instances. */

import { db } from '../db/index';
import { guildReplicas } from '../db/schema/guild-replicas';
import { federatedInstances } from '../db/schema/federation-instances';
import { eq, and } from 'drizzle-orm';
import { signRequest } from '../lib/http-signature';
import { getActiveKeyPair } from './crypto';
import { getInstanceDomain, getFederationFlags } from './index';
import { queueOutboundActivity } from './activities';

/** Sync a guild replica — fetch new operations from primary since last cursor. */
export async function syncReplica(replicaId: string): Promise<void> {
  const flags = getFederationFlags();
  if (!flags.allowReplication) return;

  const [result] = await db
    .select({ replica: guildReplicas, instance: federatedInstances })
    .from(guildReplicas)
    .innerJoin(federatedInstances, eq(federatedInstances.id, guildReplicas.instanceId))
    .where(and(
      eq(guildReplicas.id, replicaId),
      eq(guildReplicas.enabled, true),
      eq(guildReplicas.role, 'secondary'),
    ))
    .limit(1);

  if (!result) return;

  const { replica, instance } = result;
  const kp = getActiveKeyPair();
  const guildIdParam = replica.guildId ?? replica.remoteGuildId;
  const syncUrl = `${instance.baseUrl}/api/v1/federation/sync/${guildIdParam}`;
  const cursor = replica.syncCursor || '0';

  try {
    const headers = signRequest('GET', `${syncUrl}?cursor=${cursor}`, '', kp.keyId, kp.privateKeyPem);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);

    const resp = await fetch(`${syncUrl}?cursor=${cursor}`, {
      headers: { ...headers, Accept: 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!resp.ok) {
      await db.update(guildReplicas)
        .set({ syncState: 'error' })
        .where(eq(guildReplicas.id, replicaId));
      return;
    }

    const data = (await resp.json()) as {
      operations: Array<{ type: string; data: unknown; sequence: string }>;
      cursor: string;
    };

    if (data.operations.length > 0) {
      await db.update(guildReplicas)
        .set({
          syncCursor: data.cursor,
          syncState: 'synced',
          lastSyncedAt: new Date(),
        })
        .where(eq(guildReplicas.id, replicaId));
    }

    // Send ack to primary
    if (replica.guildId) {
      await queueOutboundActivity(instance.id, 'ReplicaAck', {
        guildId: replica.guildId,
        cursor: data.cursor,
        originInstance: `https://${getInstanceDomain()}`,
      });
    }
  } catch (err) {
    console.error(`[federation:sync] Replica sync failed for ${replicaId}:`, err);
    await db.update(guildReplicas)
      .set({ syncState: 'error' })
      .where(eq(guildReplicas.id, replicaId));
  }
}
