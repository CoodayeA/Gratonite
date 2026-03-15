/**
 * relay/envelope.ts — Padded relay envelopes with E2E encryption.
 *
 * All relay messages are wrapped in fixed-size envelopes to prevent
 * content-size traffic analysis. Three bucket sizes:
 *   - 4KB:  typing, presence, small signals
 *   - 16KB: normal messages
 *   - 64KB: large payloads (embeds, attachment metadata)
 */

import crypto from 'node:crypto';
import { encrypt, decrypt, edToX25519Private, edToX25519Public, deriveSharedSecret } from './crypto';
import { signData, verifySignature } from '../federation/crypto';

// ---------------------------------------------------------------------------
// Size buckets for traffic padding
// ---------------------------------------------------------------------------

/** Fixed envelope size buckets in bytes. */
export const SIZE_BUCKETS = [4096, 16384, 65536] as const;
export type SizeBucket = typeof SIZE_BUCKETS[number];

/**
 * Select the appropriate size bucket for a given payload size.
 * The smallest bucket that fits the payload is chosen.
 * If the payload exceeds 64KB, it uses the 64KB bucket (will be truncated).
 */
function selectBucket(payloadSize: number): SizeBucket {
  for (const bucket of SIZE_BUCKETS) {
    if (payloadSize <= bucket - 64) return bucket; // 64 bytes overhead for length prefix + padding marker
  }
  return 65536;
}

// ---------------------------------------------------------------------------
// Envelope types
// ---------------------------------------------------------------------------

export interface RelayEnvelope {
  /** Protocol version */
  v: 1;
  /** Sender instance domain */
  from: string;
  /** Recipient instance domain */
  to: string;
  /** Size bucket used */
  bucket: SizeBucket;
  /** Base64-encoded encrypted + padded payload */
  payload: string;
  /** Ed25519 signature of the payload (base64) */
  signature: string;
  /** Timestamp (ISO 8601) */
  ts: string;
  /** Unique envelope ID for deduplication */
  id: string;
  /** Hop counter for mesh routing (max 2) */
  hops: number;
}

export interface EnvelopePayload {
  /** Activity type (e.g. 'MessageCreate', 'TypingStart') */
  type: string;
  /** The actual activity data */
  data: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Padding
// ---------------------------------------------------------------------------

/**
 * Pad plaintext to the target bucket size.
 * Format: [4-byte LE length] [original data] [random padding bytes]
 * Total size equals the bucket size exactly.
 */
function padToSize(data: Buffer, bucketSize: number): Buffer {
  const result = Buffer.alloc(bucketSize);

  // First 4 bytes: original data length (little-endian uint32)
  result.writeUInt32LE(data.length, 0);

  // Copy original data after length prefix
  data.copy(result, 4, 0, Math.min(data.length, bucketSize - 4));

  // Fill remaining space with random bytes
  const paddingStart = 4 + Math.min(data.length, bucketSize - 4);
  if (paddingStart < bucketSize) {
    const randomPad = crypto.randomBytes(bucketSize - paddingStart);
    randomPad.copy(result, paddingStart);
  }

  return result;
}

/**
 * Remove padding and extract original data.
 */
function unpad(padded: Buffer): Buffer {
  const originalLength = padded.readUInt32LE(0);
  if (originalLength > padded.length - 4) {
    throw new Error('Invalid padding: declared length exceeds buffer');
  }
  return padded.subarray(4, 4 + originalLength);
}

// ---------------------------------------------------------------------------
// Create / Open envelopes
// ---------------------------------------------------------------------------

/**
 * Create an encrypted, padded relay envelope.
 *
 * @param to         - Recipient instance domain
 * @param from       - Sender instance domain
 * @param payload    - The activity to send
 * @param senderPrivateKeyPem   - Sender's Ed25519 private key (PEM)
 * @param recipientPublicKeyPem - Recipient's Ed25519 public key (PEM)
 */
export function createEnvelope(
  to: string,
  from: string,
  payload: EnvelopePayload,
  senderPrivateKeyPem: string,
  recipientPublicKeyPem: string,
): RelayEnvelope {
  // Serialize payload
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf-8');

  // Select size bucket and pad
  const bucket = selectBucket(plaintext.length);
  const padded = padToSize(plaintext, bucket);

  // Derive shared secret via X25519 ECDH
  const myX25519Priv = edToX25519Private(senderPrivateKeyPem);
  const theirX25519Pub = edToX25519Public(recipientPublicKeyPem);
  const sharedSecret = deriveSharedSecret(myX25519Priv, theirX25519Pub);

  // Encrypt padded payload
  const encrypted = encrypt(padded, sharedSecret);
  const payloadB64 = encrypted.toString('base64');

  // Sign the payload for authenticity
  const signature = signData(payloadB64);

  return {
    v: 1,
    from,
    to,
    bucket,
    payload: payloadB64,
    signature,
    ts: new Date().toISOString(),
    id: crypto.randomUUID(),
    hops: 0,
  };
}

/**
 * Open (decrypt + unpad) a relay envelope.
 *
 * @param envelope           - The received envelope
 * @param recipientPrivateKeyPem - Recipient's Ed25519 private key (PEM)
 * @param senderPublicKeyPem     - Sender's Ed25519 public key (PEM)
 */
export function openEnvelope(
  envelope: RelayEnvelope,
  recipientPrivateKeyPem: string,
  senderPublicKeyPem: string,
): EnvelopePayload {
  // Verify signature
  if (!verifySignature(envelope.payload, envelope.signature, senderPublicKeyPem)) {
    throw new Error('Invalid envelope signature');
  }

  // Check timestamp freshness (reject > 5 minutes old)
  const age = Math.abs(Date.now() - new Date(envelope.ts).getTime());
  if (age > 5 * 60 * 1000) {
    throw new Error('Stale envelope: timestamp too old');
  }

  // Derive shared secret
  const myX25519Priv = edToX25519Private(recipientPrivateKeyPem);
  const theirX25519Pub = edToX25519Public(senderPublicKeyPem);
  const sharedSecret = deriveSharedSecret(myX25519Priv, theirX25519Pub);

  // Decrypt
  const encrypted = Buffer.from(envelope.payload, 'base64');
  const padded = decrypt(encrypted, sharedSecret);

  // Unpad
  const plaintext = unpad(padded);

  return JSON.parse(plaintext.toString('utf-8')) as EnvelopePayload;
}

/**
 * Validate envelope structure without decrypting.
 * Used by relay servers which cannot read the content.
 */
export function validateEnvelopeStructure(envelope: unknown): envelope is RelayEnvelope {
  if (!envelope || typeof envelope !== 'object') return false;
  const e = envelope as Record<string, unknown>;
  return (
    e.v === 1 &&
    typeof e.from === 'string' &&
    typeof e.to === 'string' &&
    (SIZE_BUCKETS as readonly number[]).includes(e.bucket as number) &&
    typeof e.payload === 'string' &&
    typeof e.signature === 'string' &&
    typeof e.ts === 'string' &&
    typeof e.id === 'string' &&
    typeof e.hops === 'number' &&
    e.hops >= 0 && e.hops <= 2
  );
}
