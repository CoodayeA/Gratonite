/** jobs/relayReputationCalc.ts — Recalculate relay reputation every 5 min. */

import { db } from '../db/index';
import { relayNodes } from '../db/schema/relay-nodes';
import { eq, lt } from 'drizzle-orm';
import { isRelayEnabled } from '../relay/index';
import { delistLowReputationRelays } from '../relay/reputation';
import { logger } from '../lib/logger';

export async function processRelayReputationCalc(): Promise<void> {
  if (!isRelayEnabled()) return;

  try {
    // Auto-delist relays below threshold
    const delisted = await delistLowReputationRelays();

    // Log summary
    const [activeCount] = await db.select({ count: db.$count(relayNodes, eq(relayNodes.status, 'active')) }).from(relayNodes).limit(1);
    logger.debug(`[relay:reputation] Active relays: ${activeCount?.count ?? 0}, delisted this cycle: ${delisted}`);
  } catch (err) {
    logger.error('[relay:reputation] Reputation calc failed:', err);
  }
}

/** @deprecated Legacy setInterval starter — use BullMQ. */
export function startRelayReputationCalcJob(): void {
  setInterval(() => processRelayReputationCalc(), 5 * 60_000);
}
