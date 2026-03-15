/**
 * relay/turn-proxy.ts — TURN credential generation for voice federation.
 *
 * Relays can optionally act as TURN credential providers for NAT traversal.
 * Generates ephemeral TURN credentials with 1-hour TTL using shared-secret auth.
 */

import crypto from 'node:crypto';

export interface TurnCredentials {
  urls: string[];
  username: string;
  credential: string;
  ttl: number;
}

/**
 * Generate ephemeral TURN credentials using the coturn shared-secret mechanism.
 * username = timestamp:uniqueId
 * credential = HMAC-SHA1(sharedSecret, username)
 */
export function generateTurnCredentials(
  turnServer: string,
  sharedSecret: string,
  userId: string,
  ttlSeconds: number = 3600,
): TurnCredentials {
  const expiry = Math.floor(Date.now() / 1000) + ttlSeconds;
  const username = `${expiry}:${userId}`;
  const credential = crypto
    .createHmac('sha1', sharedSecret)
    .update(username)
    .digest('base64');

  return {
    urls: [
      `turn:${turnServer}:3478?transport=udp`,
      `turn:${turnServer}:3478?transport=tcp`,
      `turns:${turnServer}:5349?transport=tcp`,
    ],
    username,
    credential,
    ttl: ttlSeconds,
  };
}
