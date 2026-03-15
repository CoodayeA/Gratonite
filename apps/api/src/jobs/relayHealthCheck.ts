/** jobs/relayHealthCheck.ts — Check relay health every 60s. */

import { db } from '../db/index';
import { relayNodes } from '../db/schema/relay-nodes';
import { eq } from 'drizzle-orm';
import { isRelayEnabled } from '../relay/index';
import { updateRelayReputation } from '../relay/reputation';
import { logger } from '../lib/logger';

export async function processRelayHealthCheck(): Promise<void> {
  if (!isRelayEnabled()) return;

  const activeRelays = await db.select({ id: relayNodes.id, domain: relayNodes.domain, websocketUrl: relayNodes.websocketUrl })
    .from(relayNodes)
    .where(eq(relayNodes.status, 'active'))
    .limit(50);

  for (const relay of activeRelays) {
    const start = Date.now();
    try {
      const healthUrl = relay.websocketUrl.replace(/^wss?:\/\//, 'https://').replace(/:\d+$/, '') + '/health';
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);

      const resp = await fetch(healthUrl, { signal: controller.signal });
      clearTimeout(timer);

      const latencyMs = Date.now() - start;

      if (resp.ok) {
        await updateRelayReputation(relay.domain, { latencyMs, healthCheckSuccess: true });
        await db.update(relayNodes).set({ lastHealthCheck: new Date() }).where(eq(relayNodes.id, relay.id));
      } else {
        await updateRelayReputation(relay.domain, { healthCheckSuccess: false });
      }
    } catch {
      await updateRelayReputation(relay.domain, { healthCheckSuccess: false });
    }
  }
}

/** @deprecated Legacy setInterval starter — use BullMQ. */
export function startRelayHealthCheckJob(): void {
  setInterval(() => processRelayHealthCheck(), 60_000);
}
