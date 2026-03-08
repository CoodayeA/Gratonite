/**
 * jobs/federationHeartbeat.ts — Pings connected instances to verify availability.
 * Runs every 5 minutes.
 */

import { db } from '../db/index';
import { federatedInstances } from '../db/schema/federation-instances';
import { eq } from 'drizzle-orm';
import { isFederationEnabled, getInstanceDomain } from '../federation/index';
import { signRequest } from '../lib/http-signature';
import { getActiveKeyPair } from '../federation/crypto';

const HEARTBEAT_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MAX_FAILED_HEARTBEATS = 10; // Auto-suspend after 10 failures

export function startFederationHeartbeatJob(): void {
  setInterval(async () => {
    if (!isFederationEnabled()) return;

    try {
      const instances = await db
        .select()
        .from(federatedInstances)
        .where(eq(federatedInstances.status, 'active'));

      if (instances.length === 0) return;

      let kp: ReturnType<typeof getActiveKeyPair>;
      try {
        kp = getActiveKeyPair();
      } catch {
        return; // Not initialized yet
      }

      for (const instance of instances) {
        try {
          const heartbeatUrl = `${instance.baseUrl}/api/v1/federation/heartbeat`;
          const body = JSON.stringify({ origin: `https://${getInstanceDomain()}`, timestamp: new Date().toISOString() });
          const headers = signRequest('POST', heartbeatUrl, body, kp.keyId, kp.privateKeyPem);

          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 10000);

          const resp = await fetch(heartbeatUrl, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body,
            signal: controller.signal,
          });

          clearTimeout(timer);

          if (resp.ok) {
            await db.update(federatedInstances)
              .set({ lastSeenAt: new Date(), failedHeartbeats: 0, updatedAt: new Date() })
              .where(eq(federatedInstances.id, instance.id));
          } else {
            throw new Error(`HTTP ${resp.status}`);
          }
        } catch {
          const newFailCount = instance.failedHeartbeats + 1;
          const updates: Record<string, unknown> = {
            failedHeartbeats: newFailCount,
            updatedAt: new Date(),
          };

          // Auto-suspend after too many failures
          if (newFailCount >= MAX_FAILED_HEARTBEATS) {
            updates.status = 'suspended';
            console.warn(`[federationHeartbeat] Auto-suspended instance ${instance.baseUrl} after ${newFailCount} failed heartbeats`);
          }

          await db.update(federatedInstances)
            .set(updates)
            .where(eq(federatedInstances.id, instance.id));
        }
      }
    } catch (err) {
      console.error('[federationHeartbeat] Error:', err);
    }
  }, HEARTBEAT_INTERVAL).unref();

  console.info('[federationHeartbeat] Started (every 5m)');
}
