/**
 * jobs/federationDiscoverSync.ts — Periodically pushes discoverable guilds
 * to the federation hub (gratonite.chat) so they appear in the Discover directory.
 *
 * Runs every 30 minutes when FEDERATION_DISCOVER_REGISTRATION is enabled.
 */

import { db } from '../db/index';
import { logger } from '../lib/logger';
import { guilds } from '../db/schema/guilds';
import { federatedInstances } from '../db/schema/federation-instances';
import { remoteGuilds } from '../db/schema/remote-guilds';
import { eq } from 'drizzle-orm';
import { isFederationEnabled, getFederationFlags, getInstanceDomain, getFederationHubUrl } from '../federation/index';
import { getActiveKeyPair } from '../federation/crypto';
import { signRequest } from '../lib/http-signature';

const SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

async function ensureHubHandshake(hubUrl: string): Promise<void> {
  const domain = getInstanceDomain();

  // Check if hub instance is already known
  const [existing] = await db
    .select({ id: federatedInstances.id })
    .from(federatedInstances)
    .where(eq(federatedInstances.baseUrl, hubUrl))
    .limit(1);

  if (existing) return;

  // Perform handshake with hub
  let keyPair: ReturnType<typeof getActiveKeyPair>;
  try {
    keyPair = getActiveKeyPair();
  } catch {
    console.warn('[federation-discover] No active keypair, cannot handshake with hub');
    return;
  }

  const body = JSON.stringify({
    instanceUrl: `https://${domain}`,
    publicKeyPem: keyPair.publicKeyPem,
    softwareVersion: process.env.npm_package_version || '1.0.0',
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const resp = await fetch(`${hubUrl}/api/v1/federation/handshake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!resp.ok) {
      console.warn(`[federation-discover] Hub handshake failed: ${resp.status}`);
    } else {
      console.info('[federation-discover] Hub handshake completed');
    }
  } catch (err) {
    clearTimeout(timer);
    console.warn('[federation-discover] Hub handshake error:', err);
  }
}

async function syncDiscoverableGuilds(): Promise<void> {
  if (!isFederationEnabled()) return;
  const flags = getFederationFlags();
  if (!flags.discoverRegistration) return;

  const hubUrl = getFederationHubUrl();
  const domain = getInstanceDomain();

  let keyPair: ReturnType<typeof getActiveKeyPair>;
  try {
    keyPair = getActiveKeyPair();
  } catch {
    console.warn('[federation-discover] No active keypair, skipping sync');
    return;
  }

  // Ensure we have a handshake with the hub
  await ensureHubHandshake(hubUrl);

  // Fetch local discoverable guilds
  const discoverableGuilds = await db
    .select({
      id: guilds.id,
      name: guilds.name,
      description: guilds.description,
      iconHash: guilds.iconHash,
      bannerHash: guilds.bannerHash,
      memberCount: guilds.memberCount,
      category: guilds.category,
    })
    .from(guilds)
    .where(eq(guilds.isDiscoverable, true))
    .limit(100);

  if (discoverableGuilds.length === 0) {
    console.info('[federation-discover] No discoverable guilds to sync');
    return;
  }

  const payload = {
    guilds: discoverableGuilds.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description ?? undefined,
      iconUrl: g.iconHash ? `https://${domain}/api/v1/files/${g.iconHash}` : undefined,
      bannerUrl: g.bannerHash ? `https://${domain}/api/v1/files/${g.bannerHash}` : undefined,
      memberCount: g.memberCount,
      category: g.category ?? undefined,
    })),
  };

  const body = JSON.stringify(payload);
  const url = `${hubUrl}/api/v1/federation/discover/register`;
  const signatureHeaders = signRequest('POST', url, body, keyPair.keyId, keyPair.privateKeyPem);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...signatureHeaders,
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (resp.ok) {
      const result = await resp.json() as { registered: number; removed: number };
      console.info(`[federation-discover] Synced ${result.registered} guilds to hub (${result.removed} stale removed)`);
    } else {
      const errBody = await resp.text().catch(() => '');
      console.warn(`[federation-discover] Hub registration failed: ${resp.status} ${errBody}`);
    }
  } catch (err) {
    clearTimeout(timer);
    console.warn('[federation-discover] Hub sync error:', err);
  }
}

/** BullMQ processor — syncs discoverable guilds with the federation hub. */
export async function processFederationDiscoverSync(): Promise<void> {
  await syncDiscoverableGuilds();
}

/**
 * Pulls the hub's discoverable guilds into the local remote_guilds table.
 * Runs on startup and every 30 minutes. Safe to call in background — never throws.
 */
export async function pullGuildsFromHub(): Promise<void> {
  try {
    if (!isFederationEnabled()) return;
    const flags = getFederationFlags();
    if (!flags.discoverRegistration) return;

    const hubUrl = getFederationHubUrl();

    let keyPair: ReturnType<typeof getActiveKeyPair>;
    try {
      keyPair = getActiveKeyPair();
    } catch {
      console.warn('[federation-discover-pull] No active keypair, skipping pull');
      return;
    }

    // Find or create the hub's federated_instances row, ensuring inDiscover=true
    // so pulled guilds appear on the local Discover page.
    const [existingHub] = await db
      .select({ id: federatedInstances.id })
      .from(federatedInstances)
      .where(eq(federatedInstances.baseUrl, hubUrl))
      .limit(1);

    let hubInstanceId: string;
    if (existingHub) {
      hubInstanceId = existingHub.id;
      await db
        .update(federatedInstances)
        .set({ inDiscover: true, status: 'active', lastSeenAt: new Date() })
        .where(eq(federatedInstances.id, hubInstanceId));
    } else {
      const [inserted] = await db
        .insert(federatedInstances)
        .values({
          baseUrl: hubUrl,
          trustLevel: 'verified',
          status: 'active',
          inDiscover: true,
          trustScore: 100,
          lastSeenAt: new Date(),
        })
        .returning({ id: federatedInstances.id });
      hubInstanceId = inserted.id;
    }

    // Authenticated GET to the hub's federation guilds endpoint
    const url = `${hubUrl}/api/v1/federation/guilds?limit=100`;
    const signatureHeaders = signRequest('GET', url, '', keyPair.keyId, keyPair.privateKeyPem);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);

    let guildList: any[];
    try {
      const resp = await fetch(url, {
        method: 'GET',
        headers: signatureHeaders,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!resp.ok) {
        console.warn(`[federation-discover-pull] Hub returned ${resp.status}, skipping pull`);
        return;
      }

      guildList = await resp.json() as any[];
    } catch (err) {
      clearTimeout(timer);
      console.warn('[federation-discover-pull] Hub unreachable:', err);
      return;
    }

    if (!Array.isArray(guildList) || guildList.length === 0) {
      console.info('[federation-discover-pull] No guilds returned from hub');
      return;
    }

    const hubDomain = new URL(hubUrl).hostname;
    let upsertCount = 0;

    for (const guild of guildList) {
      if (!guild.id || !guild.name) continue;

      const federationAddress: string = guild.federationAddress || `${guild.id}@${hubDomain}`;
      const iconUrl: string | null = guild.iconUrl
        ? ((guild.iconUrl as string).startsWith('http') ? guild.iconUrl : `${hubUrl}${guild.iconUrl}`)
        : null;

      try {
        await db
          .insert(remoteGuilds)
          .values({
            instanceId: hubInstanceId,
            remoteGuildId: String(guild.id),
            federationAddress,
            name: String(guild.name).slice(0, 100),
            description: guild.description ?? null,
            iconUrl,
            bannerUrl: null,
            memberCount: guild.memberCount ?? 0,
            onlineCount: 0,
            category: guild.category ?? null,
            tags: Array.isArray(guild.tags) ? guild.tags : [],
            isApproved: true,
            lastSyncedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: remoteGuilds.federationAddress,
            set: {
              name: String(guild.name).slice(0, 100),
              description: guild.description ?? null,
              iconUrl,
              memberCount: guild.memberCount ?? 0,
              category: guild.category ?? null,
              tags: Array.isArray(guild.tags) ? guild.tags : [],
              isApproved: true,
              lastSyncedAt: new Date(),
              updatedAt: new Date(),
            },
          });
        upsertCount++;
      } catch (err) {
        console.warn(`[federation-discover-pull] Failed to upsert guild ${guild.id}:`, err);
      }
    }

    console.info(`[federation-discover-pull] Upserted ${upsertCount} guilds from hub`);
  } catch (err) {
    console.error('[federation-discover-pull] Pull job error:', err);
  }
}

/** BullMQ processor — pulls discoverable guilds from the federation hub. */
export async function processFederationDiscoverPull(): Promise<void> {
  await pullGuildsFromHub();
}

let syncTimer: ReturnType<typeof setInterval> | null = null;

/** @deprecated Use BullMQ scheduler in worker.ts instead. */
export function startFederationDiscoverSyncJob(): void {
  if (syncTimer) return;

  console.info('[federation-discover] Starting discover sync job (every 30m)');

  // Initial push after 10 seconds to let the server finish starting
  setTimeout(() => {
    syncDiscoverableGuilds().catch((err) =>
      logger.error('[federation-discover] Sync error:', err),
    );
  }, 10_000);

  syncTimer = setInterval(() => {
    syncDiscoverableGuilds().catch((err) =>
      logger.error('[federation-discover] Sync error:', err),
    );
  }, SYNC_INTERVAL_MS);

  // Pull from hub after 5 seconds and then every 30 minutes
  setTimeout(() => {
    pullGuildsFromHub().catch((err) =>
      logger.error('[federation-discover-pull] Pull error:', err),
    );
  }, 5_000);

  setInterval(() => {
    pullGuildsFromHub().catch((err) =>
      logger.error('[federation-discover-pull] Pull error:', err),
    );
  }, SYNC_INTERVAL_MS);
}
