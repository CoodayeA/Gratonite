/**
 * relay/crypto.ts — E2E encryption for relay communication.
 *
 * Converts Ed25519 keys to X25519 for ECDH key agreement, then derives
 * AES-256-GCM keys for envelope encryption. Uses Node.js native crypto only.
 */

import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// Ed25519 → X25519 key conversion
// ---------------------------------------------------------------------------

/**
 * Convert an Ed25519 public key (PEM) to an X25519 public key (raw 32 bytes).
 * Uses Node.js native crypto.convertKey (available since Node 15+).
 */
export function edToX25519Public(ed25519Pem: string): Buffer {
  const edPub = crypto.createPublicKey(ed25519Pem);
  // Export raw Ed25519 public key bytes
  const rawEd = edPub.export({ type: 'spki', format: 'der' });
  // The last 32 bytes of the SPKI DER encoding are the raw Ed25519 public key
  const edBytes = rawEd.subarray(rawEd.length - 32);
  // Convert Ed25519 → X25519 using libsodium-compatible math
  // Node.js doesn't expose direct curve conversion, so we use X25519 key gen
  // from the Ed25519 private key. For public keys, we hash the Ed point.
  // Use crypto.diffieHellman with a temporary approach:
  // Actually, use the ed25519 raw key bytes and convert via clamping
  return edwardsToMontgomeryPub(edBytes);
}

/**
 * Convert an Ed25519 private key (PEM) to an X25519 private key (raw 32 bytes).
 */
export function edToX25519Private(ed25519Pem: string): Buffer {
  const edPriv = crypto.createPrivateKey(ed25519Pem);
  const rawDer = edPriv.export({ type: 'pkcs8', format: 'der' });
  // PKCS#8 for Ed25519: the 32-byte seed is at offset 16 in the DER
  const seed = rawDer.subarray(16, 48);
  // Hash the seed with SHA-512 and clamp for X25519
  const hash = crypto.createHash('sha512').update(seed).digest();
  hash[0] &= 248;
  hash[31] &= 127;
  hash[31] |= 64;
  return hash.subarray(0, 32);
}

/**
 * Edwards to Montgomery point conversion for public keys.
 * Converts a 32-byte Ed25519 public key (compressed Edwards y-coordinate)
 * to the equivalent X25519 public key (Montgomery u-coordinate).
 *
 * Formula: u = (1 + y) / (1 - y)  mod p
 * where p = 2^255 - 19
 */
function edwardsToMontgomeryPub(edPubBytes: Buffer): Buffer {
  // Field prime for Curve25519
  const p = BigInt('57896044618658097711785492504343953926634992332820282019728792003956564819949');

  // Read y-coordinate (little-endian, clear top bit which is sign)
  const yBytes = Buffer.from(edPubBytes);
  yBytes[31] &= 0x7f;
  let y = BigInt(0);
  for (let i = 0; i < 32; i++) {
    y += BigInt(yBytes[i]) << BigInt(8 * i);
  }

  // u = (1 + y) * modInverse(1 - y, p) mod p
  const one = BigInt(1);
  const numerator = modP(one + y, p);
  const denominator = modP(one - y + p, p);
  const u = modP(numerator * modInverse(denominator, p), p);

  // Write u as 32-byte little-endian
  const result = Buffer.alloc(32);
  let val = u;
  for (let i = 0; i < 32; i++) {
    result[i] = Number(val & BigInt(0xff));
    val >>= BigInt(8);
  }
  return result;
}

function modP(a: bigint, p: bigint): bigint {
  return ((a % p) + p) % p;
}

function modInverse(a: bigint, p: bigint): bigint {
  // Fermat's little theorem: a^(p-2) mod p
  return modPow(a, p - BigInt(2), p);
}

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = BigInt(1);
  base = modP(base, mod);
  while (exp > BigInt(0)) {
    if (exp & BigInt(1)) {
      result = modP(result * base, mod);
    }
    exp >>= BigInt(1);
    base = modP(base * base, mod);
  }
  return result;
}

// ---------------------------------------------------------------------------
// ECDH shared secret derivation
// ---------------------------------------------------------------------------

/**
 * Derive a shared secret from X25519 ECDH.
 * Returns a 32-byte AES-256 key via HKDF-SHA256.
 */
export function deriveSharedSecret(myX25519Private: Buffer, theirX25519Public: Buffer): Buffer {
  // Create X25519 key objects
  const myPriv = crypto.createPrivateKey({
    key: buildX25519PrivateDer(myX25519Private),
    format: 'der',
    type: 'pkcs8',
  });

  const theirPub = crypto.createPublicKey({
    key: buildX25519PublicDer(theirX25519Public),
    format: 'der',
    type: 'spki',
  });

  // ECDH to get raw shared secret
  const rawSecret = crypto.diffieHellman({
    privateKey: myPriv,
    publicKey: theirPub,
  });

  // HKDF to derive AES-256 key
  const salt = Buffer.alloc(32, 0); // No salt — deterministic
  const info = Buffer.from('gratonite-relay-e2e-v1');
  return Buffer.from(crypto.hkdfSync('sha256', rawSecret, salt, info, 32));
}

/**
 * Build PKCS#8 DER encoding for an X25519 private key from raw 32 bytes.
 */
function buildX25519PrivateDer(raw: Buffer): Buffer {
  // PKCS#8 wrapper for X25519 private key
  const prefix = Buffer.from([
    0x30, 0x2e, // SEQUENCE (46 bytes)
    0x02, 0x01, 0x00, // INTEGER 0 (version)
    0x30, 0x05, // SEQUENCE (5 bytes)
    0x06, 0x03, 0x2b, 0x65, 0x6e, // OID 1.3.101.110 (X25519)
    0x04, 0x22, // OCTET STRING (34 bytes)
    0x04, 0x20, // OCTET STRING (32 bytes) — the actual key
  ]);
  return Buffer.concat([prefix, raw]);
}

/**
 * Build SPKI DER encoding for an X25519 public key from raw 32 bytes.
 */
function buildX25519PublicDer(raw: Buffer): Buffer {
  const prefix = Buffer.from([
    0x30, 0x2a, // SEQUENCE (42 bytes)
    0x30, 0x05, // SEQUENCE (5 bytes)
    0x06, 0x03, 0x2b, 0x65, 0x6e, // OID 1.3.101.110 (X25519)
    0x03, 0x21, 0x00, // BIT STRING (33 bytes, 0 unused bits)
  ]);
  return Buffer.concat([prefix, raw]);
}

// ---------------------------------------------------------------------------
// AES-256-GCM encrypt / decrypt
// ---------------------------------------------------------------------------

/**
 * Encrypt plaintext with AES-256-GCM.
 * Returns: 12-byte IV + ciphertext + 16-byte auth tag.
 */
export function encrypt(plaintext: Buffer, sharedSecret: Buffer): Buffer {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', sharedSecret, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, tag]);
}

/**
 * Decrypt AES-256-GCM ciphertext.
 * Input format: 12-byte IV + ciphertext + 16-byte auth tag.
 */
export function decrypt(ciphertext: Buffer, sharedSecret: Buffer): Buffer {
  const iv = ciphertext.subarray(0, 12);
  const tag = ciphertext.subarray(ciphertext.length - 16);
  const data = ciphertext.subarray(12, ciphertext.length - 16);

  const decipher = crypto.createDecipheriv('aes-256-gcm', sharedSecret, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}
