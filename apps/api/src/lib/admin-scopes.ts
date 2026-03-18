import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { adminUserScopes } from '../db/schema/admin';
import { users } from '../db/schema/users';

export const ADMIN_SCOPES = {
  TEAM_MANAGE: 'admin.team.manage',
  AUDIT_READ: 'admin.audit.read',
  BOT_MODERATE: 'admin.bot.moderate',
  SHOP_MANAGE: 'admin.shop.manage',
  REPORTS_MANAGE: 'admin.reports.manage',
  FEEDBACK_MANAGE: 'admin.feedback.manage',
  BUG_REPORTS_MANAGE: 'admin.bug-reports.manage',
  COSMETICS_MODERATE: 'admin.cosmetics.moderate',
  DISCOVER_CURATE: 'admin.discover.curate',
} as const;

export type AdminScope = (typeof ADMIN_SCOPES)[keyof typeof ADMIN_SCOPES];

export const FULL_ADMIN_SCOPES: AdminScope[] = Object.values(ADMIN_SCOPES);

export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const [user] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user?.isAdmin === true;
}

export async function hasAdminScope(userId: string, scope: AdminScope): Promise<boolean> {
  const [user] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user?.isAdmin) {
    return false;
  }

  const [scopeMatch] = await db
    .select({ id: adminUserScopes.id })
    .from(adminUserScopes)
    .where(
      and(
        eq(adminUserScopes.userId, userId),
        eq(adminUserScopes.scope, scope),
      ),
    )
    .limit(1);

  return !!scopeMatch;
}

export async function grantAdminScopes(userId: string, scopes: AdminScope[], grantedBy?: string): Promise<void> {
  if (!scopes.length) return;

  const now = new Date();
  await db
    .insert(adminUserScopes)
    .values(
      scopes.map((scope) => ({
        userId,
        scope,
        grantedBy: grantedBy ?? null,
        createdAt: now,
        updatedAt: now,
      })),
    )
    .onConflictDoNothing({ target: [adminUserScopes.userId, adminUserScopes.scope] });
}

export async function replaceAdminScopes(userId: string, scopes: AdminScope[], grantedBy?: string): Promise<void> {
  await db.delete(adminUserScopes).where(eq(adminUserScopes.userId, userId));
  await grantAdminScopes(userId, scopes, grantedBy);
}
