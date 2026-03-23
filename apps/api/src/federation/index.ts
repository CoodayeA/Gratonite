/** federation/index.ts — Federation subsystem initialization. */

import { generateKeyPairIfNeeded, getActiveKeyPair, signData, getPublicKeyPem } from './crypto';
import { initRelay, isRelayEnabled } from '../relay/index';
import { db } from '../db';
import { guilds } from '../db/schema/guilds';
import { federatedInstances } from '../db/schema/federation-instances';
import { eq, sql } from 'drizzle-orm';

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

  const domain = getInstanceDomain();
  console.info(`[federation] Federation enabled for domain: ${domain}`);

  // Backfill federation addresses for existing local users who don't have one
  try {
    const result = await db.execute(
      sql`UPDATE users SET federation_address = username || '@' || ${domain}
          WHERE federation_address IS NULL AND is_federated = false`
    );
    const count = (result as any).rowCount ?? 0;
    if (count > 0) {
      console.info(`[federation] Backfilled federation addresses for ${count} users`);
    }
  } catch (err) {
    console.error('[federation] Federation address backfill failed:', err);
  }

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

  // Non-hub: handshake with hub to get OAuth credentials, then push guilds
  if (!isHub()) {
    // Wait 30s for API to be fully ready
    setTimeout(async () => {
      // Handshake with hub to register and get OAuth SSO credentials
      await handshakeWithHub().catch(err => console.error('[federation] Hub handshake failed:', err));
      // Push public guilds to hub Discover
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

/**
 * Non-hub instances handshake with the hub on startup to:
 * 1. Register themselves in the hub's known instances
 * 2. Receive OAuth SSO credentials for "Login with Gratonite"
 */
async function handshakeWithHub(): Promise<void> {
  const hubUrl = getFederationHubUrl();
  const domain = getInstanceDomain();
  if (domain === 'localhost') {
    console.info('[federation] Skipping hub handshake for localhost instance');
    return;
  }

  // Don't handshake if we already have OAuth credentials
  if (process.env.FEDERATION_HUB_CLIENT_ID) {
    console.info('[federation] Hub OAuth credentials already configured');
    return;
  }

  const publicKeyPem = getPublicKeyPem();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    const resp = await fetch(`${hubUrl}/api/v1/federation/handshake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instanceUrl: `https://${domain}`,
        publicKeyPem,
        softwareVersion: process.env.npm_package_version || '1.0.0',
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!resp.ok) {
      console.error(`[federation] Hub handshake failed: ${resp.status} ${resp.statusText}`);
      return;
    }

    const data = await resp.json() as {
      type: string;
      instanceUrl: string;
      publicKeyPem: string;
      oauth?: { clientId: string; clientSecret: string | null };
    };

    console.info(`[federation] Hub handshake successful with ${data.instanceUrl}`);

    // Store OAuth credentials if received
    if (data.oauth?.clientId) {
      // Store in Redis so they persist across restarts (env vars are read-only at runtime)
      const { redis } = await import('../lib/redis');
      await redis.set('federation:hub:oauth_client_id', data.oauth.clientId);
      if (data.oauth.clientSecret) {
        await redis.set('federation:hub:oauth_client_secret', data.oauth.clientSecret);
      }
      // Also set in process.env for immediate use
      process.env.FEDERATION_HUB_CLIENT_ID = data.oauth.clientId;
      if (data.oauth.clientSecret) {
        process.env.FEDERATION_HUB_CLIENT_SECRET = data.oauth.clientSecret;
      }
      console.info(`[federation] OAuth SSO credentials received (client_id: ${data.oauth.clientId})`);
    }

    // Store/update the hub as a known instance
    const [existing] = await db
      .select({ id: federatedInstances.id })
      .from(federatedInstances)
      .where(eq(federatedInstances.baseUrl, data.instanceUrl))
      .limit(1);

    if (!existing) {
      await db.insert(federatedInstances).values({
        baseUrl: data.instanceUrl,
        publicKeyPem: data.publicKeyPem,
        publicKeyId: `${data.instanceUrl}/api/v1/federation/actor#main-key`,
        trustLevel: 'verified', // The hub is always trusted
        status: 'active',
        lastSeenAt: new Date(),
      });
    }
  } catch (err) {
    console.error('[federation] Hub handshake error:', (err as Error).message);
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

      const [existing] = await db.select()
        .from(federatedInstances)
        .where(eq(federatedInstances.baseUrl, `https://${inst.domain}`))
        .limit(1);

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
    const publicGuilds = await db.select()
      .from(guilds)
      .where(eq(guilds.isDiscoverable, true))
      .limit(50);

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
