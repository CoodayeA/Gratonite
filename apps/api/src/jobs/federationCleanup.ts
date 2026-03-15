/**
 * jobs/federationCleanup.ts — Prunes old federation activities.
 * Runs every 24 hours.
 */

import { db } from '../db/index';
import { logger } from '../lib/logger';
import { federationActivities } from '../db/schema/federation-activities';
import { and, or, eq, lt } from 'drizzle-orm';
import { isFederationEnabled } from '../federation/index';

const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const RETENTION_DAYS = 30;

/** BullMQ processor — prunes old federation activities. */
export async function processFederationCleanup(): Promise<void> {
  if (!isFederationEnabled()) return;

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  await db
    .delete(federationActivities)
    .where(and(
      or(
        eq(federationActivities.status, 'delivered'),
        eq(federationActivities.status, 'dead'),
      ),
      lt(federationActivities.createdAt, cutoff),
    ));

  console.info(`[federationCleanup] Pruned activities older than ${RETENTION_DAYS} days`);
}

/** @deprecated Use BullMQ scheduler in worker.ts instead. */
export function startFederationCleanupJob(): void {
  setInterval(async () => {
    try {
      await processFederationCleanup();
    } catch (err) {
      logger.error('[federationCleanup] Error:', err);
    }
  }, CLEANUP_INTERVAL).unref();

  console.info('[federationCleanup] Started (every 24h)');
}
