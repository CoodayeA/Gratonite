/** federation/export-import.ts — Account export/import for federation portability. */

import { db } from '../db/index';
import { users } from '../db/schema/users';
import { relationships } from '../db/schema/relationships';
import { guildMembers, guilds } from '../db/schema/guilds';
import { userSettings } from '../db/schema/settings';
import { accountImports } from '../db/schema/account-imports';
import { federatedInstances } from '../db/schema/federation-instances';
import { eq } from 'drizzle-orm';
import { signData, verifySignature } from './crypto';
import { getInstanceDomain } from './index';

export interface ExportData {
  version: 1;
  exportedAt: string;
  sourceInstance: string;
  profile: {
    username: string;
    displayName: string;
    bio: string | null;
    avatarHash: string | null;
    bannerHash: string | null;
    pronouns: string | null;
    federationAddress: string;
  };
  settings: Record<string, unknown> | null;
  relationships: Array<{ federationAddress: string; type: string }>;
  guildMemberships: Array<{ federationAddress: string; nickname: string | null; joinedAt: string }>;
}

/** Export a user's account data for portability. */
export async function exportAccount(userId: string): Promise<{ data: ExportData; signature: string }> {
  const domain = getInstanceDomain();

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error('User not found');

  const [userSettingsRow] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  // Fetch relationships with addressee usernames for federation address resolution
  const userRelationships = await db
    .select({
      type: relationships.type,
      addresseeId: relationships.addresseeId,
      addresseeUsername: users.username,
    })
    .from(relationships)
    .innerJoin(users, eq(users.id, relationships.addresseeId))
    .where(eq(relationships.requesterId, userId));

  // Fetch guild memberships with guild IDs for federation address resolution
  const memberships = await db
    .select({
      guildId: guildMembers.guildId,
      nickname: guildMembers.nickname,
      joinedAt: guildMembers.joinedAt,
    })
    .from(guildMembers)
    .where(eq(guildMembers.userId, userId));

  const exportData: ExportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    sourceInstance: `https://${domain}`,
    profile: {
      username: user.username,
      displayName: user.displayName,
      bio: user.bio ?? null,
      avatarHash: user.avatarHash ?? null,
      bannerHash: user.bannerHash ?? null,
      pronouns: user.pronouns ?? null,
      federationAddress: user.federationAddress || `${user.username}@${domain}`,
    },
    settings: userSettingsRow ? (userSettingsRow as unknown as Record<string, unknown>) : null,
    relationships: userRelationships
      .filter((r) => r.type === 'FRIEND')
      .map((r) => ({
        federationAddress: `${r.addresseeUsername}@${domain}`,
        type: r.type,
      })),
    guildMemberships: memberships.map((m) => ({
      federationAddress: `${m.guildId}@${domain}`,
      nickname: m.nickname,
      joinedAt: m.joinedAt.toISOString(),
    })),
  };

  const signature = signData(JSON.stringify(exportData));
  return { data: exportData, signature };
}

/** Verify an import package signature against the source instance's public key. */
export async function verifyImportSignature(
  data: ExportData,
  signature: string,
): Promise<boolean> {
  const [instance] = await db
    .select()
    .from(federatedInstances)
    .where(eq(federatedInstances.baseUrl, data.sourceInstance))
    .limit(1);

  if (!instance?.publicKeyPem) return false;
  return verifySignature(JSON.stringify(data), signature, instance.publicKeyPem);
}

/** Start an account import process. Returns the import record ID. */
export async function startImport(
  userId: string,
  data: ExportData,
  signature: string,
): Promise<string> {
  const [importRecord] = await db
    .insert(accountImports)
    .values({
      userId,
      sourceFederationAddress: data.profile.federationAddress,
      status: 'pending',
      importedData: { profile: true, settings: !!data.settings },
      verificationProof: signature,
    })
    .returning({ id: accountImports.id });

  return importRecord.id;
}
