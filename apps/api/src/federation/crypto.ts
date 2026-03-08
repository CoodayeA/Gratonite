/** federation/crypto.ts — Ed25519 keypair management and cryptographic operations. */

import crypto from 'node:crypto';
import { db } from '../db/index';
import { federationKeyPairs } from '../db/schema/federation-key-pairs';
import { eq } from 'drizzle-orm';
import { getInstanceDomain } from './index';

/** Cached active keypair to avoid repeated DB lookups. */
let cachedKeyPair: { keyId: string; publicKeyPem: string; privateKeyPem: string } | null = null;

/** Generate an Ed25519 keypair and store it if no active keypair exists. */
export async function generateKeyPairIfNeeded(): Promise<void> {
  const [existing] = await db
    .select()
    .from(federationKeyPairs)
    .where(eq(federationKeyPairs.isActive, true))
    .limit(1);

  if (existing) {
    cachedKeyPair = {
      keyId: existing.keyId,
      publicKeyPem: existing.publicKeyPem,
      privateKeyPem: existing.privateKeyPem,
    };
    console.info(`[federation:crypto] Loaded existing keypair: ${existing.keyId}`);
    return;
  }

  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const domain = getInstanceDomain();
  const keyId = `https://${domain}/api/v1/federation/actor#main-key`;

  const [row] = await db
    .insert(federationKeyPairs)
    .values({
      keyId,
      publicKeyPem: publicKey,
      privateKeyPem: privateKey,
      algorithm: 'ed25519',
      isActive: true,
    })
    .returning();

  cachedKeyPair = {
    keyId: row.keyId,
    publicKeyPem: row.publicKeyPem,
    privateKeyPem: row.privateKeyPem,
  };

  console.info(`[federation:crypto] Generated new Ed25519 keypair: ${keyId}`);
}

/** Get the active keypair. Throws if federation is not initialized. */
export function getActiveKeyPair() {
  if (!cachedKeyPair) {
    throw new Error('Federation keypair not initialized. Call initFederation() first.');
  }
  return cachedKeyPair;
}

/** Sign a string using the active instance private key (Ed25519). */
export function signData(data: string): string {
  const kp = getActiveKeyPair();
  const privateKey = crypto.createPrivateKey(kp.privateKeyPem);
  const signature = crypto.sign(null, Buffer.from(data), privateKey);
  return signature.toString('base64');
}

/** Verify a signature against a public key (Ed25519 PEM). */
export function verifySignature(data: string, signature: string, publicKeyPem: string): boolean {
  try {
    const publicKey = crypto.createPublicKey(publicKeyPem);
    return crypto.verify(null, Buffer.from(data), publicKey, Buffer.from(signature, 'base64'));
  } catch {
    return false;
  }
}

/** Get the public key PEM for this instance. */
export function getPublicKeyPem(): string {
  return getActiveKeyPair().publicKeyPem;
}

/** Get the key ID for this instance. */
export function getKeyId(): string {
  return getActiveKeyPair().keyId;
}
