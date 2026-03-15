/**
 * relay/index.ts — Relay subsystem initialization and feature flags.
 */

import { RelayClient } from './client';
import { isFederationEnabled, getInstanceDomain } from '../federation/index';
import { logger } from '../lib/logger';

let relayClient: RelayClient | null = null;

/** Whether the relay subsystem is enabled. */
export function isRelayEnabled(): boolean {
  return process.env.RELAY_ENABLED === 'true' && isFederationEnabled();
}

/** Relay configuration. */
export function getRelayConfig() {
  return {
    enabled: isRelayEnabled(),
    mode: (process.env.RELAY_MODE || 'official') as 'official' | 'custom' | 'self-host',
    domain: process.env.RELAY_DOMAIN || 'wss://relay.gratonite.chat',
    fallback: process.env.RELAY_FALLBACK || '',
  };
}

/** Get the active relay client instance. */
export function getRelayClient(): RelayClient | null {
  return relayClient;
}

/** Initialize the relay subsystem. Called from main index.ts after federation init. */
export async function initRelay(): Promise<void> {
  if (!isRelayEnabled()) {
    logger.info('[relay] Relay disabled (set RELAY_ENABLED=true to enable)');
    return;
  }

  const config = getRelayConfig();
  const instanceDomain = getInstanceDomain();

  logger.info(`[relay] Initializing relay client (mode: ${config.mode}, relay: ${config.domain})`);

  relayClient = new RelayClient({
    instanceDomain,
    primaryRelayUrl: config.domain,
    fallbackRelayUrl: config.fallback || undefined,
  });

  await relayClient.connect();
}

/** Shutdown relay client. */
export async function shutdownRelay(): Promise<void> {
  if (relayClient) {
    relayClient.disconnect();
    relayClient = null;
  }
}
