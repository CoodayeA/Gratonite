/**
 * Key verification utilities for verifying contact identity.
 * Uses SHA-256 fingerprints of public keys.
 */

import { subtle } from './cryptoPolyfill';
import * as SecureStore from 'expo-secure-store';

const TRUSTED_CONTACTS_KEY = 'gratonite_trusted_contacts';

export async function getFingerprint(publicKeyJwk: string): Promise<string> {
  const encoded = new TextEncoder().encode(publicKeyJwk);
  const hash = new Uint8Array(await subtle.digest('SHA-256', encoded));
  return Array.from(hash).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function getFingerprintEmoji(publicKeyJwk: string): Promise<string> {
  const hex = await getFingerprint(publicKeyJwk);
  const EMOJIS = ['🔐', '🛡️', '🔑', '🗝️', '🔒', '🔓', '✅', '⚡', '🌟', '💎', '🎯', '🏆', '💜', '🦋', '🌺', '🍀'];
  // Take pairs of hex chars and map to emojis
  const emojiStr = [];
  for (let i = 0; i < 16; i += 2) {
    const idx = parseInt(hex.slice(i, i + 2), 16) % EMOJIS.length;
    emojiStr.push(EMOJIS[idx]);
  }
  return emojiStr.join(' ');
}

export function compareFingerprints(a: string, b: string): boolean {
  return a === b;
}

// --- Trusted contacts persistence ---

async function loadTrustedContacts(): Promise<Record<string, string>> {
  try {
    const json = await SecureStore.getItemAsync(TRUSTED_CONTACTS_KEY);
    return json ? JSON.parse(json) : {};
  } catch {
    return {};
  }
}

async function saveTrustedContacts(contacts: Record<string, string>): Promise<void> {
  await SecureStore.setItemAsync(TRUSTED_CONTACTS_KEY, JSON.stringify(contacts));
}

export async function markAsTrusted(userId: string, fingerprint: string): Promise<void> {
  const contacts = await loadTrustedContacts();
  contacts[userId] = fingerprint;
  await saveTrustedContacts(contacts);
}

export async function isTrusted(userId: string): Promise<boolean> {
  const contacts = await loadTrustedContacts();
  return !!contacts[userId];
}

export async function getTrustedFingerprint(userId: string): Promise<string | null> {
  const contacts = await loadTrustedContacts();
  return contacts[userId] ?? null;
}

export async function clearTrustedContacts(): Promise<void> {
  await SecureStore.deleteItemAsync(TRUSTED_CONTACTS_KEY);
}
