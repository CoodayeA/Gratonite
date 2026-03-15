/**
 * relay/router.ts — Routing decision engine for federation delivery.
 *
 * Determines whether to deliver an activity directly via HTTP POST
 * or via the relay network. Maintains a heartbeat-based reachability
 * cache in Redis (5 minute TTL).
 */

import { redis } from '../lib/redis';
import { logger } from '../lib/logger';

type DeliveryMethod = 'direct' | 'relay' | 'unreachable';

const REACHABILITY_TTL = 300; // 5 minutes
const REACHABILITY_PREFIX = 'fed:reachable:';

/**
 * Determine the best delivery method for a target domain.
 *
 * Priority:
 *   1. Direct HTTP POST (if target is directly reachable)
 *   2. Relay (if relay is enabled and connected)
 *   3. Unreachable (neither direct nor relay available)
 */
export async function getDeliveryMethod(
  targetDomain: string,
  relayConnected: boolean,
): Promise<DeliveryMethod> {
  // Check direct reachability cache
  const cached = await redis.get(`${REACHABILITY_PREFIX}${targetDomain}`);

  if (cached === 'true') {
    return 'direct';
  }

  if (cached === 'false') {
    // Cached as unreachable directly — use relay if available
    return relayConnected ? 'relay' : 'unreachable';
  }

  // No cache — probe the target
  const reachable = await probeDirectReachability(targetDomain);

  // Cache the result
  await redis.set(
    `${REACHABILITY_PREFIX}${targetDomain}`,
    reachable ? 'true' : 'false',
    'EX',
    REACHABILITY_TTL,
  );

  if (reachable) return 'direct';
  return relayConnected ? 'relay' : 'unreachable';
}

/**
 * Probe whether a target instance is directly reachable via HTTP.
 * Sends a lightweight GET to /.well-known/gratonite with a 5s timeout.
 */
async function probeDirectReachability(domain: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    const resp = await fetch(`https://${domain}/.well-known/gratonite`, {
      signal: controller.signal,
      method: 'GET',
    });

    clearTimeout(timer);
    return resp.ok;
  } catch {
    return false;
  }
}

/**
 * Mark a domain as directly reachable (called after successful HTTP delivery).
 */
export async function markReachable(domain: string): Promise<void> {
  await redis.set(`${REACHABILITY_PREFIX}${domain}`, 'true', 'EX', REACHABILITY_TTL);
}

/**
 * Mark a domain as not directly reachable (called after failed HTTP delivery).
 */
export async function markUnreachable(domain: string): Promise<void> {
  await redis.set(`${REACHABILITY_PREFIX}${domain}`, 'false', 'EX', REACHABILITY_TTL);
}

/**
 * Invalidate reachability cache for a domain.
 */
export async function invalidateReachability(domain: string): Promise<void> {
  await redis.del(`${REACHABILITY_PREFIX}${domain}`);
}
