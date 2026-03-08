/**
 * jobs/replicaSync.ts — Syncs guild replicas with their primary instances.
 * Runs every 30 seconds.
 */

import { db } from '../db/index';
import { guildReplicas } from '../db/schema/guild-replicas';
import { eq, and } from 'drizzle-orm';
import { syncReplica } from '../federation/sync';
import { isFederationEnabled, getFederationFlags } from '../federation/index';

const SYNC_INTERVAL = 30_000; // 30 seconds

export function startReplicaSyncJob(): void {
  setInterval(async () => {
    if (!isFederationEnabled()) return;
    const flags = getFederationFlags();
    if (!flags.allowReplication) return;

    try {
      // Find enabled secondary replicas that need syncing
      const replicas = await db
        .select({ id: guildReplicas.id })
        .from(guildReplicas)
        .where(and(
          eq(guildReplicas.role, 'secondary'),
          eq(guildReplicas.enabled, true),
        ))
        .limit(10);

      if (replicas.length === 0) return;

      await Promise.allSettled(
        replicas.map(r => syncReplica(r.id)),
      );
    } catch (err) {
      console.error('[replicaSync] Error:', err);
    }
  }, SYNC_INTERVAL).unref();

  console.info('[replicaSync] Started (every 30s)');
}
