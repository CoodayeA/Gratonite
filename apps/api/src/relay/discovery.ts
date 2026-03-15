/**
 * relay/discovery.ts — Auto-discover and select the best relay.
 *
 * Fetches the relay directory from gratonite.chat, scores relays by
 * reputation + latency + uptime, and auto-selects the best one.
 */

import { db } from '../db/index';
import { relayNodes } from '../db/schema/relay-nodes';
import { eq, desc } from 'drizzle-orm';
import { getFederationHubUrl } from '../federation/index';
import { logger } from '../lib/logger';

export interface RelayInfo {
  domain: string;
  websocketUrl: string;
  reputationScore: number;
  latencyMs: number;
  uptimePercent: number;
  connectedInstances: number;
  turnSupported: boolean;
}

/**
 * Fetch the relay directory from the federation hub.
 */
export async function fetchRelayDirectory(): Promise<RelayInfo[]> {
  const hubUrl = getFederationHubUrl();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    const resp = await fetch(`${hubUrl}/api/v1/relays`, {
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!resp.ok) {
      logger.warn(`[relay:discovery] Failed to fetch directory: ${resp.status}`);
      return [];
    }

    const data = await resp.json() as RelayInfo[];
    return Array.isArray(data) ? data : [];
  } catch (err) {
    logger.error('[relay:discovery] Directory fetch failed:', err);
    return [];
  }
}

/**
 * Score a relay for selection.
 * Formula: reputation * 0.4 + (100 - latency_ms/10) * 0.3 + uptime_pct * 0.3
 */
export function scoreRelay(relay: RelayInfo): number {
  const repScore = relay.reputationScore * 0.4;
  const latScore = Math.max(0, 100 - relay.latencyMs / 10) * 0.3;
  const upScore = relay.uptimePercent * 0.3;
  return Math.round(repScore + latScore + upScore);
}

/**
 * Select the best relay from the directory.
 */
export async function selectBestRelay(): Promise<RelayInfo | null> {
  const relays = await fetchRelayDirectory();
  if (relays.length === 0) {
    // Fall back to local DB
    const [local] = await db.select()
      .from(relayNodes)
      .where(eq(relayNodes.status, 'active'))
      .orderBy(desc(relayNodes.reputationScore))
      .limit(1);
    if (local) {
      return {
        domain: local.domain,
        websocketUrl: local.websocketUrl,
        reputationScore: local.reputationScore,
        latencyMs: local.latencyMs,
        uptimePercent: local.uptimePercent,
        connectedInstances: local.connectedInstances,
        turnSupported: local.turnSupported,
      };
    }
    return null;
  }

  // Score and sort
  const scored = relays
    .filter(r => r.reputationScore >= 20) // Filter out delisted
    .map(r => ({ relay: r, score: scoreRelay(r) }))
    .sort((a, b) => b.score - a.score);

  return scored[0]?.relay ?? null;
}

/**
 * Sync relay directory to local DB.
 */
export async function syncRelayDirectory(): Promise<number> {
  const relays = await fetchRelayDirectory();
  let synced = 0;

  for (const relay of relays) {
    await db.insert(relayNodes).values({
      domain: relay.domain,
      websocketUrl: relay.websocketUrl,
      reputationScore: relay.reputationScore,
      connectedInstances: relay.connectedInstances,
      uptimePercent: relay.uptimePercent,
      latencyMs: relay.latencyMs,
      turnSupported: relay.turnSupported,
      status: relay.reputationScore >= 20 ? 'active' : 'delisted',
      lastHealthCheck: new Date(),
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: relayNodes.domain,
      set: {
        websocketUrl: relay.websocketUrl,
        reputationScore: relay.reputationScore,
        connectedInstances: relay.connectedInstances,
        uptimePercent: relay.uptimePercent,
        latencyMs: relay.latencyMs,
        turnSupported: relay.turnSupported,
        status: relay.reputationScore >= 20 ? 'active' : 'delisted',
        lastHealthCheck: new Date(),
        updatedAt: new Date(),
      },
    });
    synced++;
  }

  return synced;
}
