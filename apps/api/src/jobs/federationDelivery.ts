/**
 * jobs/federationDelivery.ts — Delivers pending outbound federation activities.
 * Runs every 10 seconds.
 */

import { db } from '../db/index';
import { logger } from '../lib/logger';
import { federationActivities } from '../db/schema/federation-activities';
import { eq, and, lte, or, isNull } from 'drizzle-orm';
import { deliverActivity } from '../federation/activities';
import { isFederationEnabled } from '../federation/index';

export function startFederationDeliveryJob(): void {
  setInterval(async () => {
    if (!isFederationEnabled()) return;

    try {
      const now = new Date();

      // Find pending activities ready for delivery
      const pending = await db
        .select({ id: federationActivities.id })
        .from(federationActivities)
        .where(and(
          eq(federationActivities.direction, 'outbound'),
          eq(federationActivities.status, 'pending'),
          or(
            isNull(federationActivities.nextAttemptAt),
            lte(federationActivities.nextAttemptAt, now),
          ),
        ))
        .limit(20);

      if (pending.length === 0) return;

      // Deliver each activity (concurrently, but capped)
      await Promise.allSettled(
        pending.map(a => deliverActivity(a.id)),
      );
    } catch (err) {
      logger.error('[federationDelivery] Error:', err);
    }
  }, 10_000).unref();

  console.info('[federationDelivery] Started (every 10s)');
}
