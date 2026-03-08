/**
 * cryptoPolyfill.ts — Pure JS drop-in replacement for react-native-quick-crypto's
 * `subtle` and `getRandomValues`, using @noble libraries.
 *
 * Works without native modules — no prebuild/pod install required.
 * Supports: ECDH P-256, AES-GCM 256, SHA-256.
 * Wire format is identical to Web Crypto API output.
 */

import { p256 } from '@noble/curves/p256';
import { gcm } from '@noble/ciphers/aes';
import { sha256 } from '@noble/hashes/sha256';
import { randomBytes } from '@noble/hashes/utils';
import { Buffer } from 'buffer';

// ---------------------------------------------------------------------------
// Helpers: base64url <-> Uint8Array (for JWK conversion)
// ---------------------------------------------------------------------------

function toBase64Url(buf: Uint8Array): string {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(str: string): Uint8Array {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

// ---------------------------------------------------------------------------
// Internal key wrapper (structurally compatible with CryptoKey interface)
// ---------------------------------------------------------------------------

class PolyKey {
  readonly algorithm: any;
  readonly type: string;
  readonly extractable: boolean;
  readonly usages: string[];
  /** @internal raw key bytes */
  readonly _raw: Uint8Array;
  /** @internal for ECDH private keys: corresponding uncompressed public key */
  readonly _pub?: Uint8Array;

  constructor(
    algorithm: any,
    type: string,
    extractable: boolean,
    usages: string[],
    raw: Uint8Array,
    pub?: Uint8Array,
  ) {
    this.algorithm = algorithm;
    this.type = type;
    this.extractable = extractable;
    this.usages = usages;
    this._raw = raw;
    this._pub = pub;
  }
}

// ---------------------------------------------------------------------------
// subtle — implements the subset used by crypto.ts, offlineDb.ts, keyVerification.ts
// ---------------------------------------------------------------------------

export const subtle = {
  async generateKey(
    algorithm: any,
    extractable: boolean,
    usages: string[],
  ): Promise<any> {
    if (algorithm.name === 'ECDH' && algorithm.namedCurve === 'P-256') {
      const privBytes = p256.utils.randomPrivateKey();
      const pubBytes = p256.getPublicKey(privBytes, false); // uncompressed 65 bytes
      return {
        publicKey: new PolyKey(algorithm, 'public', true, [], pubBytes),
        privateKey: new PolyKey(algorithm, 'private', extractable, usages, privBytes, pubBytes),
      };
    }
    if (algorithm.name === 'AES-GCM') {
      const keyBytes = randomBytes(algorithm.length / 8);
      return new PolyKey(algorithm, 'secret', extractable, usages, keyBytes);
    }
    throw new Error(`Unsupported generateKey: ${algorithm.name}`);
  },

  async exportKey(format: string, key: any): Promise<any> {
    const k = key as PolyKey;
    if (format === 'jwk') {
      if (k.algorithm.name === 'ECDH') {
        if (k.type === 'public') {
          return {
            kty: 'EC',
            crv: 'P-256',
            x: toBase64Url(k._raw.slice(1, 33)),
            y: toBase64Url(k._raw.slice(33, 65)),
            ext: true,
          };
        }
        // private key
        const pub = k._pub || p256.getPublicKey(k._raw, false);
        return {
          kty: 'EC',
          crv: 'P-256',
          x: toBase64Url(pub.slice(1, 33)),
          y: toBase64Url(pub.slice(33, 65)),
          d: toBase64Url(k._raw),
          ext: true,
        };
      }
    }
    if (format === 'raw') {
      if (k.algorithm.name === 'AES-GCM') {
        return k._raw.buffer.slice(
          k._raw.byteOffset,
          k._raw.byteOffset + k._raw.byteLength,
        );
      }
      if (k.algorithm.name === 'ECDH' && k.type === 'public') {
        // Uncompressed point bytes (65 bytes)
        return k._raw.buffer.slice(
          k._raw.byteOffset,
          k._raw.byteOffset + k._raw.byteLength,
        );
      }
    }
    throw new Error(`Unsupported exportKey(${format}, ${k.algorithm.name}/${k.type})`);
  },

  async importKey(
    format: string,
    keyData: any,
    algorithm: any,
    extractable: boolean,
    usages: string[],
  ): Promise<any> {
    if (format === 'jwk') {
      if (algorithm.name === 'ECDH') {
        const jwk = keyData;
        const x = fromBase64Url(jwk.x);
        const y = fromBase64Url(jwk.y);
        if (jwk.d) {
          // Private key
          const privBytes = fromBase64Url(jwk.d);
          const pubBytes = new Uint8Array(65);
          pubBytes[0] = 0x04;
          pubBytes.set(x, 1);
          pubBytes.set(y, 33);
          return new PolyKey(algorithm, 'private', extractable, usages, privBytes, pubBytes);
        }
        // Public key
        const pubBytes = new Uint8Array(65);
        pubBytes[0] = 0x04;
        pubBytes.set(x, 1);
        pubBytes.set(y, 33);
        return new PolyKey(algorithm, 'public', extractable, usages, pubBytes);
      }
    }
    if (format === 'raw') {
      if (algorithm.name === 'AES-GCM') {
        const raw =
          keyData instanceof ArrayBuffer
            ? new Uint8Array(keyData)
            : new Uint8Array(keyData);
        return new PolyKey(algorithm, 'secret', extractable, usages, raw);
      }
    }
    throw new Error(`Unsupported importKey(${format}, ${algorithm.name})`);
  },

  async deriveKey(
    algorithm: any,
    baseKey: any,
    derivedAlgorithm: any,
    extractable: boolean,
    usages: string[],
  ): Promise<any> {
    if (algorithm.name === 'ECDH') {
      const theirPub = (algorithm.public as PolyKey)._raw; // uncompressed 65 bytes
      const myPriv = (baseKey as PolyKey)._raw; // 32 bytes
      // ECDH shared secret = x-coordinate of shared point (matches Web Crypto spec)
      const sharedPoint = p256.getSharedSecret(myPriv, theirPub, false);
      const xCoord = sharedPoint.slice(1, 33); // 32 bytes = 256 bits
      return new PolyKey(derivedAlgorithm, 'secret', extractable, usages, xCoord);
    }
    throw new Error(`Unsupported deriveKey: ${algorithm.name}`);
  },

  async encrypt(
    algorithm: any,
    key: any,
    data: Uint8Array | ArrayBuffer,
  ): Promise<ArrayBuffer> {
    if (algorithm.name === 'AES-GCM') {
      const iv = new Uint8Array(algorithm.iv);
      const plaintext = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
      const aes = gcm((key as PolyKey)._raw, iv);
      const ct = aes.encrypt(plaintext);
      return ct.buffer.slice(ct.byteOffset, ct.byteOffset + ct.byteLength);
    }
    throw new Error(`Unsupported encrypt: ${algorithm.name}`);
  },

  async decrypt(
    algorithm: any,
    key: any,
    data: Uint8Array | ArrayBuffer,
  ): Promise<ArrayBuffer> {
    if (algorithm.name === 'AES-GCM') {
      const iv = new Uint8Array(algorithm.iv);
      const ct = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
      const aes = gcm((key as PolyKey)._raw, iv);
      const pt = aes.decrypt(ct);
      return pt.buffer.slice(pt.byteOffset, pt.byteOffset + pt.byteLength);
    }
    throw new Error(`Unsupported decrypt: ${algorithm.name}`);
  },

  async digest(
    algorithm: string,
    data: Uint8Array | ArrayBuffer,
  ): Promise<ArrayBuffer> {
    if (algorithm === 'SHA-256') {
      const input = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
      const hash = sha256(input);
      return hash.buffer.slice(hash.byteOffset, hash.byteOffset + hash.byteLength);
    }
    throw new Error(`Unsupported digest: ${algorithm}`);
  },
};

// ---------------------------------------------------------------------------
// getRandomValues — drop-in for crypto.getRandomValues
// ---------------------------------------------------------------------------

export function getRandomValues<T extends ArrayBufferView>(array: T): T {
  const bytes = randomBytes(array.byteLength);
  new Uint8Array(array.buffer, array.byteOffset, array.byteLength).set(bytes);
  return array;
}
