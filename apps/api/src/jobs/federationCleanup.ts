/**
 * jobs/federationCleanup.ts — Prunes old federation activities.
 * Runs every 24 hours.
 */

import { db } from '../db/index';
import { federationActivities } from '../db/schema/federation-activities';
import { and, or, eq, lt } from 'drizzle-orm';
import { isFederationEnabled } from '../federation/index';

const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const RETENTION_DAYS = 30;

export function startFederationCleanupJob(): void {
  setInterval(async () => {
    if (!isFederationEnabled()) return;

    try {
      const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

      const result = await db
        .delete(federationActivities)
        .where(and(
          or(
            eq(federationActivities.status, 'delivered'),
            eq(federationActivities.status, 'dead'),
          ),
          lt(federationActivities.createdAt, cutoff),
        ));

      // Note: Drizzle delete doesn't easily return count, but that's fine
      console.info(`[federationCleanup] Pruned activities older than ${RETENTION_DAYS} days`);
    } catch (err) {
      console.error('[federationCleanup] Error:', err);
    }
  }, CLEANUP_INTERVAL).unref();

  console.info('[federationCleanup] Started (every 24h)');
}
