/**
 * services/user.service.ts — Business logic for core user operations.
 *
 * Extracted from routes/users.ts to separate HTTP concerns from domain logic.
 * Route handlers validate input and translate service errors to HTTP responses.
 *
 * @module services/user.service
 */

import { eq, or, sql, inArray } from 'drizzle-orm';

import { db } from '../db/index';
import { users } from '../db/schema/users';
import { redis } from '../lib/redis';
import { ServiceError } from './guild.service';

// ---------------------------------------------------------------------------
// Helpers (private to service)
// ---------------------------------------------------------------------------

/**
 * safeProfile — Return all non-sensitive user fields (no passwordHash).
 *
 * Used for /@me responses where the authenticated user sees their own full
 * profile including email.
 */
export function safeProfile(user: typeof users.$inferSelect) {
  let parsedInterests: string[] | null = null;
  if (user.interests) {
    try { parsedInterests = JSON.parse(user.interests); } catch { parsedInterests = null; }
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    isAdmin: user.isAdmin,
    onboardingCompleted: user.onboardingCompleted,
    interests: parsedInterests,
    status: user.status,
    profile: {
      displayName: user.displayName,
      avatarHash: user.avatarHash ?? null,
      avatarAnimated: user.avatarAnimated ?? false,
      bannerHash: user.bannerHash ?? null,
      bannerAnimated: user.bannerAnimated ?? false,
      bio: user.bio ?? null,
      pronouns: user.pronouns ?? null,
      nameplateStyle: user.nameplateStyle ?? 'none',
      avatarDecorationId: null,
      profileEffectId: null,
      nameplateId: null,
      tier: 'free',
      previousAvatarHashes: [],
      messageCount: 0,
    },
  };
}

/**
 * publicProfile — Return only fields safe to expose to other users.
 */
export function publicProfile(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarHash: user.avatarHash,
    avatarAnimated: user.avatarAnimated ?? false,
    bannerHash: user.bannerHash,
    bannerAnimated: user.bannerAnimated ?? false,
    bio: user.bio,
    pronouns: user.pronouns,
    status: user.status,
    customStatus: user.customStatus,
    badges: user.badges ?? [],
    createdAt: user.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Service methods
// ---------------------------------------------------------------------------

/**
 * getUserById — Fetch a user row by primary key.
 *
 * @throws {ServiceError} NOT_FOUND if user does not exist.
 */
export async function getUserById(userId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new ServiceError('NOT_FOUND', 'User not found');
  }

  return user;
}

/**
 * getUserByUsername — Lookup a user by username (case-insensitive).
 *
 * @throws {ServiceError} NOT_FOUND if no user matches.
 */
export async function getUserByUsername(username: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.username}) = lower(${username})`)
    .limit(1);

  if (!user) {
    throw new ServiceError('NOT_FOUND', 'User not found');
  }

  return user;
}

/**
 * updateProfile — Update display name, bio, pronouns, etc.
 *
 * Only fields present in `data` are updated; others are left unchanged.
 *
 * @throws {ServiceError} NOT_FOUND if user does not exist.
 */
export async function updateProfile(
  userId: string,
  data: {
    displayName?: string;
    bio?: string | null;
    pronouns?: string | null;
    customStatus?: string | null;
    onboardingCompleted?: boolean;
    interests?: string[] | null;
    nameplateStyle?: string;
    statusEmoji?: string | null;
    statusExpiresAt?: string | null;
  },
) {
  const updateData: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
  if (data.displayName !== undefined) updateData.displayName = data.displayName;
  if (data.bio !== undefined) updateData.bio = data.bio;
  if (data.pronouns !== undefined) updateData.pronouns = data.pronouns;
  if (data.customStatus !== undefined) updateData.customStatus = data.customStatus;
  if (data.onboardingCompleted !== undefined) updateData.onboardingCompleted = data.onboardingCompleted;
  if (data.interests !== undefined) updateData.interests = data.interests ? JSON.stringify(data.interests) : null;
  if (data.nameplateStyle !== undefined) updateData.nameplateStyle = data.nameplateStyle;
  if (data.statusEmoji !== undefined) updateData.statusEmoji = data.statusEmoji;
  if (data.statusExpiresAt !== undefined) updateData.statusExpiresAt = data.statusExpiresAt ? new Date(data.statusExpiresAt) : null;

  const [updated] = await db
    .update(users)
    .set(updateData)
    .where(eq(users.id, userId))
    .returning();

  if (!updated) {
    throw new ServiceError('NOT_FOUND', 'User not found');
  }

  return updated;
}

/**
 * getOnlineStatus — Batch-query presence statuses from Redis.
 *
 * Returns an array of presence objects. Never leaks "invisible" status —
 * it is mapped to "offline" for other users.
 */
export async function getOnlineStatus(userIds: string[]) {
  if (userIds.length === 0) return [];

  try {
    const pipeline = redis.pipeline();
    for (const id of userIds) {
      pipeline.get(`presence:${id}`);
      pipeline.pttl(`presence:${id}`);
    }
    const results = await pipeline.exec();
    const now = Date.now();

    const presences: Array<{ userId: string; status: string; updatedAt: string; lastSeen: number | null }> = [];
    userIds.forEach((id, i) => {
      const statusResult = results?.[i * 2];
      const ttlResult = results?.[(i * 2) + 1];
      const rawStatus = (statusResult && statusResult[1] as string) || 'offline';
      // Never leak "invisible" to other users — show as "offline"
      const status = rawStatus === 'invisible' ? 'offline' : rawStatus;
      const ttlMs = Number(ttlResult?.[1] ?? -1);
      const updatedAt = status === 'offline' || ttlMs < 0
        ? new Date(now).toISOString()
        : new Date(now - (300_000 - ttlMs)).toISOString();
      presences.push({
        userId: id,
        status,
        updatedAt,
        lastSeen: status === 'offline' ? now : null,
      });
    });
    return presences;
  } catch {
    // Fallback: return all as offline
    const now = Date.now();
    return userIds.map((id) => ({
      userId: id,
      status: 'offline',
      updatedAt: new Date(now).toISOString(),
      lastSeen: now,
    }));
  }
}

/**
 * searchUsers — Search users by username or display name (case-insensitive ILIKE).
 *
 * @param query - Search string, minimum 2 characters.
 * @param limit - Maximum results (default 20).
 * @throws {ServiceError} VALIDATION_ERROR if query is too short.
 */
export async function searchUsers(query: string, limit: number = 20) {
  const q = query.trim();

  if (q.length < 2) {
    throw new ServiceError('VALIDATION_ERROR', 'Search query must be at least 2 characters');
  }

  const escaped = q.replace(/[%_\\]/g, '\\$&');
  const pattern = `%${escaped}%`;

  const results = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarHash: users.avatarHash,
    })
    .from(users)
    .where(
      or(
        sql`${users.username} ILIKE ${pattern}`,
        sql`${users.displayName} ILIKE ${pattern}`,
      ),
    )
    .limit(limit);

  return results;
}
