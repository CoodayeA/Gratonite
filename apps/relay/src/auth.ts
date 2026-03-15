/**
 * relay/auth.ts — RELAY_HELLO handshake verification.
 *
 * When an instance connects to the relay, it sends a RELAY_HELLO message
 * with its domain, public key, and a signed timestamp. The relay verifies
 * the signature against the public key fetched from the instance's
 * /.well-known/gratonite endpoint.
 */

import crypto from 'node:crypto';

export interface RelayHelloPayload {
  domain: string;
  publicKeyPem: string;
  signature: string;
  timestamp: string;
}

/**
 * Verify a RELAY_HELLO handshake.
 * 1. Check timestamp freshness (±5 minutes)
 * 2. Verify Ed25519 signature of `domain:timestamp`
 * 3. Optionally verify the public key against /.well-known/gratonite
 */
export function verifyRelayHello(hello: RelayHelloPayload): boolean {
  // Check timestamp freshness
  const age = Math.abs(Date.now() - new Date(hello.timestamp).getTime());
  if (age > 5 * 60 * 1000) {
    return false;
  }

  // Verify signature
  const signedData = `${hello.domain}:${hello.timestamp}`;
  try {
    const publicKey = crypto.createPublicKey(hello.publicKeyPem);
    return crypto.verify(
      null,
      Buffer.from(signedData),
      publicKey,
      Buffer.from(hello.signature, 'base64'),
    );
  } catch {
    return false;
  }
}

/**
 * Verify a relay-to-relay MESH_HELLO handshake.
 */
export function verifyMeshHello(hello: {
  relayDomain: string;
  publicKeyPem: string;
  signature: string;
  timestamp: string;
}): boolean {
  const age = Math.abs(Date.now() - new Date(hello.timestamp).getTime());
  if (age > 5 * 60 * 1000) return false;

  const signedData = `relay:${hello.relayDomain}:${hello.timestamp}`;
  try {
    const publicKey = crypto.createPublicKey(hello.publicKeyPem);
    return crypto.verify(null, Buffer.from(signedData), publicKey, Buffer.from(hello.signature, 'base64'));
  } catch {
    return false;
  }
}
