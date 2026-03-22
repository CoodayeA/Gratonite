/**
 * federation/trust.ts — Trust tier computation for federated instances.
 *
 * Trust tiers determine what an instance can do in the Gratonite network:
 *
 *   Tier  0 (New)       — Can federate, guilds NOT in Discover
 *   Tier  1 (Trusted)   — Can submit guilds for Discover review
 *   Tier  2 (Verified)  — Guilds in Discover with "Verified" badge
 *   Tier -1 (Suspended) — Federation paused, guilds removed from Discover
 *   Tier -2 (Blocked)   — Fully blocked, connection rejected
 *
 * Tier 0 → 1 is automatic when criteria are met.
 * Tier 1 → 2 requires manual review by the Gratonite team.
 * Negative tiers are set by admin action or automated abuse detection.
 */

import type { FederatedInstance } from '../db/schema/federation-instances';

export type TrustTier = -2 | -1 | 0 | 1 | 2;

export interface TrustTierInfo {
  tier: TrustTier;
  label: 'blocked' | 'suspended' | 'new' | 'trusted' | 'verified';
  canFederate: boolean;
  canSubmitToDiscover: boolean;
  appearsInDiscover: boolean;
}

/**
 * Compute the trust tier for a federated instance.
 *
 * @param instance  The instance record from the database
 * @param reportCount  Number of unresolved abuse reports (queried separately)
 * @param totalMembers  Total members across all guilds on the instance (optional)
 */
export function computeTrustTier(
  instance: Pick<FederatedInstance, 'status' | 'trustLevel' | 'createdAt' | 'lastSeenAt' | 'failedHeartbeats'>,
  reportCount: number = 0,
  totalMembers: number = 0,
): TrustTierInfo {
  // Negative tiers: admin-set status overrides everything
  if (instance.status === 'blocked') {
    return { tier: -2, label: 'blocked', canFederate: false, canSubmitToDiscover: false, appearsInDiscover: false };
  }
  if (instance.status === 'suspended') {
    return { tier: -1, label: 'suspended', canFederate: false, canSubmitToDiscover: false, appearsInDiscover: false };
  }

  // Tier 2: manually verified
  if (instance.trustLevel === 'verified') {
    return { tier: 2, label: 'verified', canFederate: true, canSubmitToDiscover: true, appearsInDiscover: true };
  }

  // Tier 1: auto-promoted when criteria are met
  // Requires: 72h+ since creation, 0 unresolved reports, 10+ members
  const hoursSinceCreation = instance.createdAt
    ? (Date.now() - new Date(instance.createdAt).getTime()) / 3_600_000
    : 0;

  if (
    instance.trustLevel === 'manually_trusted' ||
    (hoursSinceCreation >= 72 && reportCount === 0 && totalMembers >= 10)
  ) {
    return { tier: 1, label: 'trusted', canFederate: true, canSubmitToDiscover: true, appearsInDiscover: false };
  }

  // Tier 0: new instance, default
  return { tier: 0, label: 'new', canFederate: true, canSubmitToDiscover: false, appearsInDiscover: false };
}

/**
 * Compute a numeric trust score (0-100) for display and sorting.
 */
export function computeTrustScore(
  instance: Pick<FederatedInstance, 'status' | 'trustLevel' | 'createdAt' | 'lastSeenAt' | 'softwareVersion'>,
  reportCount: number = 0,
  totalMembers: number = 0,
): number {
  if (instance.status === 'blocked') return 0;
  if (instance.status === 'suspended') return 0;

  let score = 0;

  const hoursSinceCreation = instance.createdAt
    ? (Date.now() - new Date(instance.createdAt).getTime()) / 3_600_000
    : 0;

  // Uptime milestones
  if (hoursSinceCreation >= 72) score += 20;   // 3 days
  if (hoursSinceCreation >= 168) score += 10;  // 1 week
  if (hoursSinceCreation >= 720) score += 5;   // 30 days

  // Clean record
  if (reportCount === 0) score += 20;

  // Community size
  if (totalMembers >= 10) score += 10;
  if (totalMembers >= 50) score += 5;

  // Verification bonus
  if (instance.trustLevel === 'verified') score += 15;
  if (instance.trustLevel === 'manually_trusted') score += 10;

  // Penalties
  score -= reportCount * 25;

  // Active connection bonus (seen in last 24h)
  if (instance.lastSeenAt) {
    const hoursSinceLastSeen = (Date.now() - new Date(instance.lastSeenAt).getTime()) / 3_600_000;
    if (hoursSinceLastSeen <= 24) score += 5;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Determine the Discover badge for a guild.
 *
 * @param isLocal  Whether the guild belongs to this instance (not federated)
 * @param hubDomain  The hub instance domain (e.g. 'gratonite.chat')
 * @param instanceDomain  The domain of this Gratonite instance
 * @param sourceTrustLevel  Trust level of the source instance (for remote guilds)
 */
export function getDiscoverBadge(
  isLocal: boolean,
  hubDomain: string,
  instanceDomain: string,
  sourceTrustLevel?: string,
): 'official' | 'verified' | 'community' | null {
  if (isLocal) {
    // Guilds on the hub are "Official"
    if (instanceDomain === hubDomain) return 'official';
    // Local guilds on non-hub instances don't get a badge in their own Discover
    return null;
  }

  // Remote guilds — badge based on source instance trust level
  if (sourceTrustLevel === 'verified') return 'verified';
  if (sourceTrustLevel === 'manually_trusted') return 'community';

  // tier 0 instances shouldn't appear in Discover at all,
  // but if they somehow do, no badge
  return null;
}
