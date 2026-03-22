/**
 * jobs/updateCheck.ts — Checks for new Gratonite releases.
 * Runs every 6 hours.
 */

import { redis } from '../lib/redis';

const CHECK_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
const REGISTRY_URL = 'https://registry.gratonite.chat/api/v1/releases/latest';

/** BullMQ processor — checks for new Gratonite releases. */
export async function processUpdateCheck(): Promise<void> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    const resp = await fetch(REGISTRY_URL, { signal: controller.signal });
    clearTimeout(timer);

    if (!resp.ok) return;

    const data = await resp.json() as { version?: string; releaseUrl?: string; changelog?: string };
    if (!data.version) return;

    const currentVersion = process.env.npm_package_version || '0.0.0';
    if (data.version !== currentVersion) {
      await redis.set('gratonite:update_available', JSON.stringify({
        currentVersion,
        latestVersion: data.version,
        releaseUrl: data.releaseUrl || '',
        changelog: data.changelog || '',
        checkedAt: new Date().toISOString(),
      }), 'EX', CHECK_INTERVAL / 1000 + 3600);

      console.info(`[updateCheck] Update available: ${currentVersion} → ${data.version}`);
    } else {
      await redis.del('gratonite:update_available');
    }
  } catch {
    // Non-fatal — registry might be unreachable (e.g. self-hosted without internet)
  }
}

/** @deprecated Use BullMQ scheduler in worker.ts instead. */
export function startUpdateCheckJob(): void {
  setInterval(async () => {
    try {
      await processUpdateCheck();
    } catch {
      // Non-fatal — registry might be unreachable
    }
  }, CHECK_INTERVAL).unref();

  console.info('[updateCheck] Started (every 6h)');
}
