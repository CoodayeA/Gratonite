/** federation/index.ts — Federation subsystem initialization. */

import { generateKeyPairIfNeeded } from './crypto';
import { initRelay, isRelayEnabled } from '../relay/index';

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
}
