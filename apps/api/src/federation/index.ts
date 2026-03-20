/** federation/index.ts — Federation subsystem initialization. */

import { generateKeyPairIfNeeded, getActiveKeyPair, signData, getPublicKeyPem } from './crypto';
import { initRelay, isRelayEnabled } from '../relay/index';
import { db } from '../db';
import { guilds } from '../db/schema/guilds';
import { federatedInstances } from '../db/schema/federation-instances';
import { eq } from 'drizzle-orm';

/** Whether federation is enabled on this instance. */
export function isFederationEnabled(): boolean {
  return process.env.FEDERATION_ENABLED === 'true';
}

/** Feature flags for granular federation control. */
export function getFederationFlags() {
  return {
    enabled: isFederationEnabled(),
    allowInbound: process.env.FEDERATION_ALLOW_INBOUND !== 'false',
    allowOutbound: process.env.FEDERATION_ALLOW_OUTBOUND !== 'false',
    allowJoins: process.env.FEDERATION_ALLOW_JOINS !== 'false',
    allowReplication: process.env.FEDERATION_ALLOW_REPLICATION === 'true',
    discoverRegistration: process.env.FEDERATION_DISCOVER_REGISTRATION === 'true',
    relayEnabled: isRelayEnabled(),
  };
}

/** Get this instance's domain from env. */
export function getInstanceDomain(): string {
  return process.env.INSTANCE_DOMAIN || 'localhost';
}

/** Get the federation hub URL (defaults to gratonite.chat). */
export function getFederationHubUrl(): string {
  return process.env.FEDERATION_HUB_URL || 'https://gratonite.chat';
}

/**
 * Initialize federation subsystem. Called from main index.ts on startup.
 * Generates keypair if none exists, starts background jobs, and connects relay.
 */
export async function initFederation(): Promise<void> {
  if (!isFederationEnabled()) {
    console.info('[federation] Federation is disabled (set FEDERATION_ENABLED=true to enable)');
    return;
  }

  console.info('[federation] Initializing federation subsystem...');

  await generateKeyPairIfNeeded();

  console.info(`[federation] Federation enabled for domain: ${getInstanceDomain()}`);

  // Initialize relay client if enabled
  try {
    await initRelay();
  } catch (err) {
    console.error('[federation] Relay initialization failed:', (err as Error).message);
  }

  // Hub-side: poll relay for discovery-eligible instances
  if (isHub()) {
    console.info('[federation] Hub mode — polling relay for instances');
    setInterval(() => pollRelayForInstances().catch(console.error), 300_000); // 5 min
    pollRelayForInstances().catch(console.error); // immediate first poll
  }

  // Non-hub: periodically push discoverable guilds to the hub
  if (!isHub()) {
    console.info('[federation] Will push public guilds to hub Discover hourly');
    // Wait 30s for API to be fully ready, then push
    setTimeout(() => {
      pushGuildsToHub().catch(console.error);
      setInterval(() => pushGuildsToHub().catch(console.error), 3600_000); // 1 hour
    }, 30_000);
  }
}

/** Check if this instance is the federation hub. */
function isHub(): boolean {
  try {
    const hubHost = new URL(getFederationHubUrl()).hostname;
    return getInstanceDomain() === hubHost;
  } catch {
    return false;
  }
}

/** Hub polls the relay for instances that have been connected long enough. */
async function pollRelayForInstances(): Promise<void> {
  const relayUrl = process.env.RELAY_URL;
  if (!relayUrl) return;

  const healthUrl = relayUrl.replace('wss://', 'https://').replace('ws://', 'http://');
  const hubSecret = process.env.RELAY_HUB_SECRET || '';

  try {
    const headers: Record<string, string> = {};
    if (hubSecret) headers['x-hub-secret'] = hubSecret;

    const res = await fetch(`${healthUrl}/instances`, { headers });
    if (!res.ok) return;

    const data = await res.json() as { instances: Array<{
      domain: string;
      discoveryEligible: boolean;
      publicKeyPem: string | null;
    }> };

    for (const inst of data.instances) {
      if (!inst.discoveryEligible || inst.domain === getInstanceDomain()) continue;

      const existing = await db.query.federatedInstances.findFirst({
        where: eq(federatedInstances.baseUrl, `https://${inst.domain}`),
      });

      if (!existing && inst.publicKeyPem) {
        await db.insert(federatedInstances).values({
          baseUrl: `https://${inst.domain}`,
          publicKeyPem: inst.publicKeyPem,
          trustLevel: 'auto_discovered',
          status: 'active',
          trustScore: 50,
          inDiscover: false,
          softwareVersion: 'unknown',
          lastSeenAt: new Date(),
        } as any).onConflictDoNothing();

        console.log(`[federation] Auto-discovered instance via relay: ${inst.domain}`);
      } else if (existing) {
        await db.update(federatedInstances)
          .set({ lastSeenAt: new Date(), status: 'active' })
          .where(eq(federatedInstances.id, existing.id));
      }
    }
  } catch (err) {
    // Silent fail — relay may be temporarily unreachable
  }
}

/** Non-hub instances push their public guilds to the hub Discover. */
async function pushGuildsToHub(): Promise<void> {
  const hubUrl = getFederationHubUrl();
  const domain = getInstanceDomain();
  if (domain === 'localhost') return; // Local instances skip push for now

  try {
    const publicGuilds = await db.query.guilds.findMany({
      where: eq(guilds.isPrivate, false),
      limit: 50,
    });

    if (publicGuilds.length === 0) return;

    const payload = publicGuilds.map((g: any) => ({
      id: g.id,
      name: g.name,
      description: g.description || '',
      iconUrl: g.iconHash ? `https://${domain}/api/v1/files/${g.iconHash}` : null,
      memberCount: 0,
      tags: [],
      category: 'community',
    }));

    const body = JSON.stringify({ guilds: payload });
    const signature = signData(body);

    const res = await fetch(`${hubUrl}/api/v1/federation/discover/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Instance-Domain': domain,
        'X-Signature': signature,
      },
      body,
    });

    if (res.ok) {
      console.log(`[federation] Pushed ${payload.length} guilds to hub Discover`);
    }
  } catch {
    // Silent fail — hub may be unreachable
  }
}
