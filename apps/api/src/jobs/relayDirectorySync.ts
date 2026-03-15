/** jobs/relayDirectorySync.ts — Sync relay directory every 30 min. */

import { syncRelayDirectory } from '../relay/discovery';
import { isRelayEnabled } from '../relay/index';
import { logger } from '../lib/logger';

export async function processRelayDirectorySync(): Promise<void> {
  if (!isRelayEnabled()) return;
  try {
    const synced = await syncRelayDirectory();
    logger.info(`[relay:sync] Synced ${synced} relay(s) from directory`);
  } catch (err) {
    logger.error('[relay:sync] Directory sync failed:', err);
  }
}

/** @deprecated Legacy setInterval starter — use BullMQ. */
export function startRelayDirectorySyncJob(): void {
  setInterval(() => processRelayDirectorySync(), 30 * 60_000);
}
