/**
 * Minimal Web Crypto type stubs for React Native.
 * Replaces types previously provided by react-native-quick-crypto.
 */

interface CryptoKey {
  readonly algorithm: any;
  readonly extractable: boolean;
  readonly type: string;
  readonly usages: string[];
}

interface CryptoKeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

interface JsonWebKey {
  kty?: string;
  crv?: string;
  x?: string;
  y?: string;
  d?: string;
  k?: string;
  alg?: string;
  ext?: boolean;
  key_ops?: string[];
  [key: string]: any;
}
