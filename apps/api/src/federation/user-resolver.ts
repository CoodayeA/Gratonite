/** federation/user-resolver.ts — Resolves federated users and creates shadow users. */

import crypto from 'node:crypto';
import { db } from '../db/index';
import { users } from '../db/schema/users';
import { remoteUsers } from '../db/schema/remote-users';
import { federatedInstances } from '../db/schema/federation-instances';
import { eq } from 'drizzle-orm';
import { signRequest } from '../lib/http-signature';
import { getActiveKeyPair } from './crypto';
import { getInstanceDomain } from './index';

/** Parse a federation address like "alice@chat.example.com". */
export function parseFederationAddress(address: string): { username: string; domain: string } | null {
  const cleaned = address.startsWith('@') ? address.slice(1) : address;
  const parts = cleaned.split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { username: parts[0], domain: parts[1] };
}

/**
 * Look up or create a shadow user for a remote federation address.
 * Returns the local user ID (shadow user) or null if resolution fails.
 */
export async function resolveRemoteUser(federationAddress: string): Promise<string | null> {
  const parsed = parseFederationAddress(federationAddress);
  if (!parsed) return null;

  // Check if we already have a remote user record
  const [existing] = await db
    .select({ id: remoteUsers.id, localFedAddr: remoteUsers.federationAddress })
    .from(remoteUsers)
    .where(eq(remoteUsers.federationAddress, federationAddress))
    .limit(1);

  if (existing) {
    // Look up the shadow user by matching federation address in the username convention
    const shadowUsername = buildShadowUsername(parsed.username, parsed.domain);
    const [shadowUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, shadowUsername))
      .limit(1);
    if (shadowUser) return shadowUser.id;
  }

  // Need to look up the remote instance
  const baseUrl = `https://${parsed.domain}`;
  const [instance] = await db
    .select()
    .from(federatedInstances)
    .where(eq(federatedInstances.baseUrl, baseUrl))
    .limit(1);

  if (!instance || instance.status !== 'active') return null;

  // Fetch user profile from remote instance
  const profileUrl = `${baseUrl}/api/v1/federation/users/${encodeURIComponent(parsed.username)}`;
  const kp = getActiveKeyPair();
  const headers = signRequest('GET', profileUrl, '', kp.keyId, kp.privateKeyPem);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    const resp = await fetch(profileUrl, {
      headers: { ...headers, Accept: 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timer);
    if (!resp.ok) return null;

    const profile = (await resp.json()) as {
      id: string;
      username: string;
      displayName?: string;
      avatarUrl?: string;
      publicKeyPem?: string;
    };

    return await createShadowUser(instance.id, profile, federationAddress);
  } catch {
    return null;
  }
}

/** Build a deterministic shadow username from federation address parts. */
function buildShadowUsername(username: string, domain: string): string {
  return `${username}_${domain.replace(/\./g, '_')}`.slice(0, 32);
}

/**
 * Create a shadow user row in the users table and a remote_users tracking row.
 * Shadow users cannot log in — they exist only to represent remote users locally.
 * Uses ON CONFLICT to handle concurrent creation (TOCTOU race).
 */
export async function createShadowUser(
  instanceId: string,
  profile: {
    id: string;
    username: string;
    displayName?: string;
    avatarUrl?: string;
    publicKeyPem?: string;
  },
  federationAddress: string,
): Promise<string> {
  const parsed = parseFederationAddress(federationAddress);
  const shadowUsername = parsed
    ? buildShadowUsername(parsed.username, parsed.domain)
    : `fed_${profile.username}`.slice(0, 32);

  // Check if shadow user already exists
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, shadowUsername))
    .limit(1);

  if (existingUser) return existingUser.id;

  const placeholderEmail = `federation+${crypto.randomUUID()}@${getInstanceDomain()}`;
  const randomHash = crypto.randomBytes(32).toString('hex');

  // Use try/catch for unique constraint violation (concurrent creation race)
  try {
    const [shadowUser] = await db
      .insert(users)
      .values({
        username: shadowUsername,
        email: placeholderEmail,
        passwordHash: `$federated$${randomHash}`,
        displayName: profile.displayName || profile.username,
        isFederated: true,
        federationAddress,
        federationPublicKeyPem: profile.publicKeyPem ?? null,
      })
      .returning({ id: users.id });

    // Create remote user tracking record (also handle conflict)
    await db.insert(remoteUsers).values({
      instanceId,
      remoteUserId: profile.id,
      federationAddress,
      username: profile.username,
      displayName: profile.displayName ?? null,
      avatarUrl: profile.avatarUrl ?? null,
      publicKeyPem: profile.publicKeyPem ?? null,
    }).onConflictDoNothing();

    return shadowUser.id;
  } catch (err) {
    // Unique constraint violation — another request created the user concurrently
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, shadowUsername))
      .limit(1);

    if (existing) return existing.id;
    throw err; // Re-throw if it's a different error
  }
}
