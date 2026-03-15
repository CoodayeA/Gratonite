/**
 * relay/reputation.ts — Instance-side relay reputation tracking.
 *
 * Tracks relay performance from this instance's perspective and
 * submits reports for bad relays.
 */

import { db } from '../db/index';
import { relayNodes } from '../db/schema/relay-nodes';
import { eq, lt } from 'drizzle-orm';
import { logger } from '../lib/logger';

/**
 * Update a relay's reputation based on observed performance.
 */
export async function updateRelayReputation(
  relayDomain: string,
  metrics: {
    latencyMs?: number;
    deliverySuccess?: boolean;
    healthCheckSuccess?: boolean;
  },
): Promise<void> {
  const [relay] = await db.select()
    .from(relayNodes)
    .where(eq(relayNodes.domain, relayDomain))
    .limit(1);

  if (!relay) return;

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (metrics.latencyMs !== undefined) {
    // Exponential moving average
    updates.latencyMs = Math.round(relay.latencyMs * 0.7 + metrics.latencyMs * 0.3);
  }

  if (metrics.healthCheckSuccess !== undefined) {
    if (metrics.healthCheckSuccess) {
      updates.uptimePercent = Math.min(100, relay.uptimePercent + 1);
    } else {
      updates.uptimePercent = Math.max(0, relay.uptimePercent - 5);
    }
  }

  await db.update(relayNodes).set(updates).where(eq(relayNodes.id, relay.id));
}

/**
 * Auto-delist relays with reputation below 20.
 */
export async function delistLowReputationRelays(): Promise<number> {
  const delisted = await db.update(relayNodes)
    .set({ status: 'delisted', updatedAt: new Date() })
    .where(lt(relayNodes.reputationScore, 20))
    .returning({ id: relayNodes.id });

  if (delisted.length > 0) {
    logger.info(`[relay:reputation] Auto-delisted ${delisted.length} relay(s) with score < 20`);
  }

  return delisted.length;
}
