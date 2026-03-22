/**
 * jobs/trustScoring.ts — Automated trust score computation for federated instances.
 *
 * Runs every 6 hours. Computes trust scores, auto-promotes tier 0 → tier 1
 * when criteria are met (72h+ uptime, 0 reports, 10+ members), and
 * auto-suspends instances with 3+ unresolved abuse reports.
 *
 * Never auto-promotes to tier 2 (Verified) — that requires manual review.
 */

import { eq, sql, and, ne } from 'drizzle-orm';
import { db } from '../db/index';
import { federatedInstances } from '../db/schema/federation-instances';
import { instanceReports } from '../db/schema/instance-reports';
import { remoteGuilds } from '../db/schema/remote-guilds';
import { computeTrustScore, computeTrustTier } from '../federation/trust';
import { logger } from '../lib/logger';

/**
 * BullMQ processor — recompute trust scores for all active federated instances.
 */
export async function processTrustScoring(): Promise<void> {
  try {
    const instances = await db
      .select()
      .from(federatedInstances)
      .where(ne(federatedInstances.status, 'blocked'));

    let promoted = 0;
    let suspended = 0;
    let scored = 0;

    for (const instance of instances) {
      // Count unresolved reports for this instance
      const [reportResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(instanceReports)
        .where(and(
          eq(instanceReports.instanceId, instance.id),
          eq(instanceReports.status, 'pending'),
        ));
      const reportCount = Number(reportResult.count);

      // Count total members across remote guilds from this instance
      const [memberResult] = await db
        .select({ total: sql<number>`coalesce(sum(${remoteGuilds.memberCount}), 0)` })
        .from(remoteGuilds)
        .where(eq(remoteGuilds.instanceId, instance.id));
      const totalMembers = Number(memberResult.total);

      // Compute trust score
      const score = computeTrustScore(instance, reportCount, totalMembers);
      const tierInfo = computeTrustTier(instance, reportCount, totalMembers);

      // Update score in DB
      await db.update(federatedInstances)
        .set({ trustScore: score, updatedAt: new Date() })
        .where(eq(federatedInstances.id, instance.id));
      scored++;

      // Auto-promote tier 0 → tier 1 (never auto-promote to tier 2)
      if (
        instance.trustLevel === 'auto_discovered' &&
        instance.status === 'active' &&
        tierInfo.tier >= 1
      ) {
        await db.update(federatedInstances)
          .set({ trustLevel: 'manually_trusted', updatedAt: new Date() })
          .where(eq(federatedInstances.id, instance.id));
        promoted++;
        logger.info(`[trust] Auto-promoted instance ${instance.baseUrl} to Trusted (tier 1)`);
      }

      // Auto-suspend on 3+ unresolved reports (if not already suspended/blocked)
      if (reportCount >= 3 && instance.status === 'active') {
        await db.update(federatedInstances)
          .set({ status: 'suspended', updatedAt: new Date() })
          .where(eq(federatedInstances.id, instance.id));

        // Un-approve all guilds from suspended instance
        await db.update(remoteGuilds)
          .set({ isApproved: false, updatedAt: new Date() })
          .where(eq(remoteGuilds.instanceId, instance.id));

        suspended++;
        logger.warn(`[trust] Auto-suspended instance ${instance.baseUrl} — ${reportCount} unresolved reports`);
      }
    }

    if (promoted > 0 || suspended > 0) {
      logger.info(`[trust] Scoring complete: ${scored} scored, ${promoted} promoted, ${suspended} suspended`);
    }
  } catch (err) {
    logger.error('[trust] Trust scoring failed:', err);
  }
}
