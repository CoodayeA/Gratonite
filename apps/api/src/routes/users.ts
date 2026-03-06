/**
 * routes/users.ts — Express router for user profile and presence endpoints.
 *
 * Mounted at /api/v1/users by src/routes/index.ts.
 *
 * Endpoints:
 *   GET    /@me                — Return the authenticated user's profile
 *   PATCH  /@me                — Update profile fields (displayName, bio, pronouns, customStatus)
 *   PATCH  /@me/account        — Update account fields (username, displayName, email)
 *   PATCH  /@me/presence       — Update online presence status
 *   GET    /search             — Search users by username or displayName
 *   GET    /:userId/profile    — Fetch another user's public profile
 *
 * All routes require authentication via the `requireAuth` middleware, which
 * sets `req.userId` from the validated JWT.
 *
 * @module routes/users
 */

import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { eq, or, sql, inArray, and } from 'drizzle-orm';
import multer from 'multer';

import { db } from '../db/index';
import { users } from '../db/schema/users';
import { guilds, guildMembers } from '../db/schema/guilds';
import { relationships } from '../db/schema/relationships';
import { cosmetics } from '../db/schema/cosmetics';
import { userCosmetics } from '../db/schema/cosmetics';
import { files } from '../db/schema/files';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { redis } from '../lib/redis';

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (_req, _file, cb) => cb(null, `${crypto.randomUUID()}.png`),
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

export const usersRouter = Router();

/**
 * asyncHandler — Wraps an async route handler so that rejected promises are
 * forwarded to Express's error middleware via next(err).
 */
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * safeProfile — Return all non-sensitive user fields (no passwordHash).
 *
 * Used for /@me responses where the authenticated user sees their own full
 * profile including email.
 *
 * @param user - A full user row from the database.
 * @returns    An object with all public and semi-private fields, minus passwordHash.
 */
function safeProfile(user: typeof users.$inferSelect) {
  // Parse interests from JSON string back to array
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
    profile: {
      displayName: user.displayName,
      avatarHash: user.avatarHash ?? null,
      bannerHash: user.bannerHash ?? null,
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
 *
 * Omits email, isAdmin, emailVerified, and other internal fields.
 *
 * @param user - A full user row from the database.
 * @returns    A public-safe subset of user fields.
 */
function publicProfile(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarHash: user.avatarHash,
    bannerHash: user.bannerHash,
    bio: user.bio,
    pronouns: user.pronouns,
    status: user.status,
    customStatus: user.customStatus,
    createdAt: user.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Zod validation schemas
// ---------------------------------------------------------------------------

/**
 * Schema for PATCH /@me — profile update.
 * All fields optional; at least one should be present (not enforced at schema
 * level to keep the response consistent — handler returns unchanged user if
 * body is empty).
 */
const patchMeSchema = z.object({
  displayName: z.string().min(1).max(64).optional(),
  bio: z.string().max(500).nullable().optional(),
  pronouns: z.string().max(50).nullable().optional(),
  customStatus: z.string().max(128).nullable().optional(),
  onboardingCompleted: z.boolean().optional(),
  interests: z.array(z.string()).nullable().optional(),
  nameplateStyle: z.enum(['none', 'rainbow', 'fire', 'ice', 'gold', 'glitch']).optional(),
});

/**
 * Schema for PATCH /@me/account — account fields update.
 * Username must match allowed character set (letters, digits, underscores).
 */
const patchAccountSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores')
    .optional(),
  displayName: z.string().min(1).max(64).optional(),
  email: z.string().email('Must be a valid email address').optional(),
});

/**
 * Schema for PATCH /@me/presence — presence status update.
 * Must be one of the four valid status values.
 */
const patchPresenceSchema = z.object({
  status: z.enum(['online', 'idle', 'dnd', 'invisible']),
  activity: z.object({
    name: z.string().min(1).max(128),
    type: z.enum(['PLAYING', 'WATCHING', 'LISTENING', 'STREAMING']),
  }).nullable().optional(),
});

// ---------------------------------------------------------------------------
// GET /@me
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/users/@me
 *
 * Return the authenticated user's own profile. Includes all non-sensitive
 * fields (no password_hash). Email is included since this is the user's own
 * record.
 *
 * @auth    requireAuth — sets req.userId
 * @returns 200 { id, username, email, displayName, avatarHash, bannerHash,
 *                 bio, pronouns, customStatus, status, isAdmin, emailVerified,
 *                 createdAt, updatedAt }
 * @returns 404 if the user row is missing (should not happen with valid token)
 */
// ---------------------------------------------------------------------------
// GET / ?ids=id1,id2,id3 — Batch resolve user summaries by ID
// ---------------------------------------------------------------------------
usersRouter.get('/', requireAuth, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const idsParam = req.query.ids as string | undefined;
  if (!idsParam) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'ids query parameter is required' });
    return;
  }
  const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean).slice(0, 100);
  if (ids.length === 0) {
    res.json([]);
    return;
  }
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarHash: users.avatarHash,
    })
    .from(users)
    .where(inArray(users.id, ids));
  res.json(rows);
}));

usersRouter.get('/@me', requireAuth, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, req.userId!))
    .limit(1);

  if (!user) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'User not found' });
    return;
  }

  res.status(200).json(safeProfile(user));
}));

// ---------------------------------------------------------------------------
// PATCH /@me
// ---------------------------------------------------------------------------

/**
 * PATCH /api/v1/users/@me
 *
 * Update the authenticated user's profile fields. All body fields are
 * optional. Fields not present in the body are left unchanged.
 *
 * @auth    requireAuth — sets req.userId
 * @body    { displayName?, bio?, pronouns?, customStatus? }
 * @returns 200 Updated user profile (same shape as GET /@me)
 * @returns 400 Validation failure
 * @returns 404 User not found
 *
 * Side effects:
 *   - Updates `users` row with provided fields and sets updatedAt = now().
 */
usersRouter.patch(
  '/@me',
  requireAuth,
  validate(patchMeSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { displayName, bio, pronouns, customStatus, onboardingCompleted, interests, nameplateStyle } = req.body as z.infer<typeof patchMeSchema>;

    // Build update payload — only include explicitly provided fields.
    const updateData: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
    if (displayName !== undefined) updateData.displayName = displayName;
    if (bio !== undefined) updateData.bio = bio;
    if (pronouns !== undefined) updateData.pronouns = pronouns;
    if (customStatus !== undefined) updateData.customStatus = customStatus;
    if (onboardingCompleted !== undefined) updateData.onboardingCompleted = onboardingCompleted;
    if (interests !== undefined) updateData.interests = interests ? JSON.stringify(interests) : null;
    if (nameplateStyle !== undefined) updateData.nameplateStyle = nameplateStyle;

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, req.userId!))
      .returning();

    if (!updated) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'User not found' });
      return;
    }

    res.status(200).json(safeProfile(updated));
  }),
);

// ---------------------------------------------------------------------------
// PATCH /@me/account
// ---------------------------------------------------------------------------

/**
 * PATCH /api/v1/users/@me/account
 *
 * Update account-level fields: username, displayName, and/or email.
 * Username/email changes are checked for availability (case-insensitive)
 * before being applied.
 *
 * @auth    requireAuth — sets req.userId
 * @body    { username?, displayName?, email? }
 * @returns 200 Updated user profile
 * @returns 400 Validation failure
 * @returns 409 Username already taken
 * @returns 404 User not found
 *
 * Side effects:
 *   - If username changes, all other users see the new handle immediately.
 *   - updatedAt is always bumped on success.
 */
usersRouter.patch(
  '/@me/account',
  requireAuth,
  validate(patchAccountSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { username, displayName, email } = req.body as z.infer<typeof patchAccountSchema>;

    const updateData: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };

    // If a new username is requested, verify availability first.
    if (username !== undefined) {
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(sql`lower(${users.username}) = lower(${username}) AND ${users.id} != ${req.userId!}`)
        .limit(1);

      if (existing) {
        res.status(409).json({ code: 'USERNAME_TAKEN', message: 'Username is already taken' });
        return;
      }

      updateData.username = username;
    }

    if (displayName !== undefined) updateData.displayName = displayName;

    if (email !== undefined) {
      const normalizedEmail = email.toLowerCase();
      const [existingByEmail] = await db
        .select({ id: users.id })
        .from(users)
        .where(sql`lower(${users.email}) = lower(${normalizedEmail}) AND ${users.id} != ${req.userId!}`)
        .limit(1);

      if (existingByEmail) {
        res.status(409).json({ code: 'EMAIL_TAKEN', message: 'Email is already registered' });
        return;
      }

      updateData.email = normalizedEmail;
      // Changing email invalidates prior verification until re-verified.
      updateData.emailVerified = false;
    }

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, req.userId!))
      .returning();

    if (!updated) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'User not found' });
      return;
    }

    res.status(200).json(safeProfile(updated));
  }),
);

// ---------------------------------------------------------------------------
// PATCH /@me/presence
// ---------------------------------------------------------------------------

/**
 * PATCH /api/v1/users/@me/presence
 *
 * Update the authenticated user's presence status. Valid values are:
 *   online | idle | dnd | invisible
 *
 * 'invisible' means the user is connected but appears offline to others.
 * Socket.io presence events are NOT emitted here — the Socket.io layer handles
 * the real-time propagation. This endpoint only persists the preference.
 *
 * @auth    requireAuth — sets req.userId
 * @body    { status: 'online' | 'idle' | 'dnd' | 'invisible' }
 * @returns 200 { status: string }
 * @returns 400 Validation failure
 *
 * Side effects:
 *   - Updates users.status in the database.
 */
usersRouter.patch(
  '/@me/presence',
  requireAuth,
  validate(patchPresenceSchema),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { status, activity } = req.body as z.infer<typeof patchPresenceSchema>;

    await db
      .update(users)
      .set({ status, updatedAt: new Date() })
      .where(eq(users.id, req.userId!));

    // Store activity in Redis alongside presence
    if (activity !== undefined) {
      if (activity) {
        await redis.set(`presence:${req.userId!}:activity`, JSON.stringify(activity), 'EX', 300);
      } else {
        await redis.del(`presence:${req.userId!}:activity`);
      }
    }

    res.status(200).json({ status });
  }),
);

// ---------------------------------------------------------------------------
// GET /search
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/users/search
 *
 * Search for users by username or displayName. Returns up to 20 results.
 * The search is case-insensitive and uses a LIKE (ILIKE in Postgres) pattern
 * match on both fields.
 *
 * @auth    requireAuth — sets req.userId
 * @query   q {string} — Search query, minimum 2 characters
 * @returns 200 Array of { id, username, displayName, avatarHash }
 * @returns 400 Missing or too-short query parameter
 */
usersRouter.get('/search', requireAuth, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  if (q.length < 2) {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Search query must be at least 2 characters' });
    return;
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
    .limit(20);

  res.status(200).json(results);
}));

// ---------------------------------------------------------------------------
// GET /presences — Batch query presence statuses from Redis
// ---------------------------------------------------------------------------

usersRouter.get('/presences', requireAuth, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const idsParam = req.query.ids as string | undefined;
  if (!idsParam) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'ids query parameter is required' });
    return;
  }
  const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean).slice(0, 200);
  if (ids.length === 0) {
    res.json([]);
    return;
  }

  try {
    const pipeline = redis.pipeline();
    for (const id of ids) {
      pipeline.get(`presence:${id}`);
      pipeline.pttl(`presence:${id}`);
    }
    const results = await pipeline.exec();
    const now = Date.now();
    const presences: Array<{ userId: string; status: string; updatedAt: string; lastSeen: number | null }> = [];
    ids.forEach((id, i) => {
      const statusResult = results?.[i * 2];
      const ttlResult = results?.[(i * 2) + 1];
      const status = (statusResult && statusResult[1] as string) || 'offline';
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
    res.json(presences);
  } catch {
    const now = Date.now();
    const presences = ids.map((id) => ({
      userId: id,
      status: 'offline',
      updatedAt: new Date(now).toISOString(),
      lastSeen: now,
    }));
    res.json(presences);
  }
}));

// ---------------------------------------------------------------------------
// GET /:userId/profile
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/users/:userId/profile
 *
 * Fetch the public profile of another user. Returns only publicly visible
 * fields — email, isAdmin, emailVerified, and passwordHash are excluded.
 *
 * @auth    requireAuth — sets req.userId
 * @param   userId {string} — UUID of the user to look up
 * @returns 200 { id, username, displayName, avatarHash, bannerHash, bio,
 *                 pronouns, status, customStatus, createdAt }
 * @returns 404 User not found
 */
usersRouter.get(
  '/:userId/profile',
  requireAuth,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { userId } = req.params as Record<string, string>;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'User not found' });
      return;
    }

    res.status(200).json(publicProfile(user));
  }),
);

// ---------------------------------------------------------------------------
// GET /:userId/mutuals — Mutual guilds and mutual friends
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/users/:userId/mutuals
 *
 * Returns guilds both the authenticated user and the target user share,
 * plus friends they have in common.
 */
usersRouter.get(
  '/:userId/mutuals',
  requireAuth,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const myId = req.userId!;
    const { userId: targetId } = req.params as Record<string, string>;

    try {
      // --- Mutual guilds ---
      // Get guilds the current user belongs to.
      const myGuilds = await db
        .select({ guildId: guildMembers.guildId, nickname: guildMembers.nickname })
        .from(guildMembers)
        .where(eq(guildMembers.userId, myId));

      // Get guilds the target user belongs to.
      const theirGuilds = await db
        .select({ guildId: guildMembers.guildId })
        .from(guildMembers)
        .where(eq(guildMembers.userId, targetId));

      const theirGuildIds = new Set(theirGuilds.map(g => g.guildId));
      const mutualGuildIds = myGuilds
        .filter(g => theirGuildIds.has(g.guildId))
        .map(g => ({ guildId: g.guildId, nickname: g.nickname }));

      let mutualServers: Array<{ id: string; name: string; iconHash: string | null; nickname: string | null }> = [];
      if (mutualGuildIds.length > 0) {
        const guildRows = await db
          .select({ id: guilds.id, name: guilds.name, iconHash: guilds.iconHash })
          .from(guilds)
          .where(inArray(guilds.id, mutualGuildIds.map(g => g.guildId)));

        mutualServers = guildRows.map(g => {
          const memberEntry = mutualGuildIds.find(m => m.guildId === g.id);
          return { id: g.id, name: g.name, iconHash: g.iconHash, nickname: memberEntry?.nickname ?? null };
        });
      }

      // --- Mutual friends ---
      // Get my friends (type = FRIEND, I am requester).
      const myFriendsAsReq = await db
        .select({ friendId: relationships.addresseeId })
        .from(relationships)
        .where(and(eq(relationships.requesterId, myId), eq(relationships.type, 'FRIEND')));

      // Get my friends (type = FRIEND, I am addressee).
      const myFriendsAsAddr = await db
        .select({ friendId: relationships.requesterId })
        .from(relationships)
        .where(and(eq(relationships.addresseeId, myId), eq(relationships.type, 'FRIEND')));

      const myFriendIds = new Set([
        ...myFriendsAsReq.map(r => r.friendId),
        ...myFriendsAsAddr.map(r => r.friendId),
      ]);

      // Get target's friends.
      const theirFriendsAsReq = await db
        .select({ friendId: relationships.addresseeId })
        .from(relationships)
        .where(and(eq(relationships.requesterId, targetId), eq(relationships.type, 'FRIEND')));

      const theirFriendsAsAddr = await db
        .select({ friendId: relationships.requesterId })
        .from(relationships)
        .where(and(eq(relationships.addresseeId, targetId), eq(relationships.type, 'FRIEND')));

      const theirFriendIds = new Set([
        ...theirFriendsAsReq.map(r => r.friendId),
        ...theirFriendsAsAddr.map(r => r.friendId),
      ]);

      const mutualFriendIds = [...myFriendIds].filter(id => theirFriendIds.has(id));

      let mutualFriends: Array<{ id: string; username: string; displayName: string; avatarHash: string | null }> = [];
      if (mutualFriendIds.length > 0) {
        mutualFriends = await db
          .select({
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            avatarHash: users.avatarHash,
          })
          .from(users)
          .where(inArray(users.id, mutualFriendIds));
      }

      res.json({ mutualServers, mutualFriends });
    } catch (err) {
      console.error('[users] mutuals error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  }),
);

// ---------------------------------------------------------------------------
// POST /@me/avatar — Upload avatar
// ---------------------------------------------------------------------------
usersRouter.post('/@me/avatar', requireAuth, avatarUpload.single('file'), asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.file) { res.status(400).json({ code: 'BAD_REQUEST', message: 'No file provided' }); return; }

  const fileId = path.basename(req.file.filename, path.extname(req.file.filename));
  const url = `${req.protocol}://${req.get('host')}/api/v1/files/${fileId}`;

  // Store in files table
  await db.insert(files).values({
    id: fileId,
    uploaderId: req.userId!,
    filename: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
    storageKey: req.file.filename,
    url,
  });

  // Update user avatarHash
  const [updated] = await db.update(users).set({ avatarHash: fileId, updatedAt: new Date() })
    .where(eq(users.id, req.userId!)).returning();

  res.json({ avatarHash: fileId, url });
}));

// ---------------------------------------------------------------------------
// DELETE /@me/avatar — Remove avatar
// ---------------------------------------------------------------------------
usersRouter.delete('/@me/avatar', requireAuth, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  await db.update(users).set({ avatarHash: null, updatedAt: new Date() }).where(eq(users.id, req.userId!));
  res.json({ code: 'OK' });
}));

// ---------------------------------------------------------------------------
// POST /@me/banner — Upload banner
// ---------------------------------------------------------------------------
usersRouter.post('/@me/banner', requireAuth, avatarUpload.single('file'), asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.file) { res.status(400).json({ code: 'BAD_REQUEST', message: 'No file provided' }); return; }

  const fileId = path.basename(req.file.filename, path.extname(req.file.filename));
  const url = `${req.protocol}://${req.get('host')}/api/v1/files/${fileId}`;

  await db.insert(files).values({
    id: fileId,
    uploaderId: req.userId!,
    filename: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
    storageKey: req.file.filename,
    url,
  });

  await db.update(users).set({ bannerHash: fileId, updatedAt: new Date() }).where(eq(users.id, req.userId!));
  res.json({ bannerHash: fileId, url });
}));

// ---------------------------------------------------------------------------
// DELETE /@me/banner — Remove banner
// ---------------------------------------------------------------------------
usersRouter.delete('/@me/banner', requireAuth, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  await db.update(users).set({ bannerHash: null, updatedAt: new Date() }).where(eq(users.id, req.userId!));
  res.json({ code: 'OK' });
}));

// ---------------------------------------------------------------------------
// POST /@me/change-password — Change password
// ---------------------------------------------------------------------------
usersRouter.post('/@me/change-password', requireAuth, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: 'currentPassword and newPassword are required' }); return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: 'New password must be at least 8 characters' }); return;
  }

  const [user] = await db.select().from(users).where(eq(users.id, req.userId!)).limit(1);
  if (!user) { res.status(404).json({ code: 'NOT_FOUND' }); return; }

  // Verify current password
  const argon2 = await import('argon2');
  const valid = await argon2.verify(user.passwordHash, currentPassword);
  if (!valid) { res.status(403).json({ code: 'FORBIDDEN', message: 'Current password is incorrect' }); return; }

  const newHash = await argon2.hash(newPassword);
  await db.update(users).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(users.id, req.userId!));
  res.json({ code: 'OK', message: 'Password changed successfully' });
}));

// ---------------------------------------------------------------------------
// DELETE /@me — Delete account
// ---------------------------------------------------------------------------
usersRouter.delete('/@me', requireAuth, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { password } = req.body || {};
  if (!password) { res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Password is required' }); return; }

  const [user] = await db.select().from(users).where(eq(users.id, req.userId!)).limit(1);
  if (!user) { res.status(404).json({ code: 'NOT_FOUND' }); return; }

  const argon2 = await import('argon2');
  const valid = await argon2.verify(user.passwordHash, password);
  if (!valid) { res.status(403).json({ code: 'FORBIDDEN', message: 'Password is incorrect' }); return; }

  await db.delete(users).where(eq(users.id, req.userId!));
  res.json({ code: 'OK', message: 'Account deleted' });
}));

// ---------------------------------------------------------------------------
// GET /@me/equipped-cosmetics — List equipped cosmetics for authed user
// ---------------------------------------------------------------------------
usersRouter.get('/@me/equipped-cosmetics', requireAuth, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const rows = await db
      .select({
        type: cosmetics.type,
        cosmeticId: cosmetics.id,
        name: cosmetics.name,
        assetUrl: cosmetics.assetUrl,
        previewImageUrl: cosmetics.previewImageUrl,
      })
      .from(userCosmetics)
      .innerJoin(cosmetics, eq(cosmetics.id, userCosmetics.cosmeticId))
      .where(and(eq(userCosmetics.userId, req.userId!), eq(userCosmetics.equipped, true)));

    res.status(200).json(rows.map((r) => ({
      type: r.type,
      cosmeticId: r.cosmeticId,
      name: r.name,
      assetUrl: r.assetUrl,
      previewImageUrl: r.previewImageUrl,
    })));
  } catch (err) {
    console.error('[users] equipped-cosmetics error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
}));
