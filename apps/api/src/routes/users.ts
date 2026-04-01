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
import { logger } from '../lib/logger';
import fs from 'fs';
import crypto from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { eq, or, sql, inArray, and, ne } from 'drizzle-orm';
import multer from 'multer';

import { db } from '../db/index';
import { users } from '../db/schema/users';
import { guilds, guildMembers } from '../db/schema/guilds';
import { relationships } from '../db/schema/relationships';
import { userNotes } from '../db/schema/user-notes';
import { statusPresets } from '../db/schema/status-presets';
import { userQuickReactions } from '../db/schema/quick-reactions';
import { activityEvents } from '../db/schema/activity-feed';
import { messageBookmarks } from '../db/schema/message-bookmarks';
import { userAchievements } from '../db/schema/achievements';
import { cosmetics } from '../db/schema/cosmetics';
import { userCosmetics } from '../db/schema/cosmetics';
import { files } from '../db/schema/files';
import { guildFolders } from '../db/schema/guild-folders';
import { favoriteChannels } from '../db/schema/favorite-channels';
import { channels, dmChannelMembers } from '../db/schema/channels';
import { refreshTokens } from '../db/schema/auth';
import { dataExports } from '../db/schema/data-exports';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { redis } from '../lib/redis';
import { getIO } from '../lib/socket-io';
import { asc } from 'drizzle-orm';
import { ServiceError } from '../services/guild.service';
import {
  safeProfile,
  publicProfile,
  getUserById,
  updateProfile as updateProfileService,
  getOnlineStatus,
  searchUsers as searchUsersService,
} from '../services/user.service';
import { handleAppError } from '../lib/errors';

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
// Helpers — safeProfile and publicProfile are now in services/user.service.ts
// ---------------------------------------------------------------------------

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
  statusEmoji: z.string().max(50).nullable().optional(),
  statusExpiresAt: z.string().datetime().nullable().optional(),
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
  try {
    const user = await getUserById(req.userId!);
    res.status(200).json(safeProfile(user));
  } catch (err) {
    if (err instanceof ServiceError && err.code === 'NOT_FOUND') {
      res.status(404).json({ code: 'NOT_FOUND', message: err.message });
      return;
    }
    throw err;
  }
}));

// ---------------------------------------------------------------------------
// GET /@me/bootstrap — preload critical data in a single call
// ---------------------------------------------------------------------------

usersRouter.get('/@me/bootstrap', requireAuth, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;

    // Fetch user, guilds, and DM channels in parallel
    const [userResult, guildsResult, dmResult] = await Promise.all([
      db.select().from(users).where(eq(users.id, userId)).limit(1),
      db.select({
        id: guilds.id,
        name: guilds.name,
        ownerId: guilds.ownerId,
        iconHash: guilds.iconHash,
        description: guilds.description,
        memberCount: guilds.memberCount,
      }).from(guilds)
        .innerJoin(guildMembers, and(eq(guildMembers.guildId, guilds.id), eq(guildMembers.userId, userId))),
      db.select({ channelId: dmChannelMembers.channelId })
        .from(dmChannelMembers)
        .where(eq(dmChannelMembers.userId, userId))
        .limit(100),
    ]);

    res.json({
      user: userResult[0] ? safeProfile(userResult[0]) : null,
      guilds: guildsResult,
      dmChannelIds: dmResult.map(d => d.channelId),
    });
  } catch (err) {
    logger.error('[bootstrap] error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
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
    try {
      const data = req.body as z.infer<typeof patchMeSchema>;
      const updated = await updateProfileService(req.userId!, data);
      res.status(200).json(safeProfile(updated));
    } catch (err) {
      if (err instanceof ServiceError && err.code === 'NOT_FOUND') {
        res.status(404).json({ code: 'NOT_FOUND', message: err.message });
        return;
      }
      throw err;
    }
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
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const results = await searchUsersService(q);
    res.status(200).json(results);
  } catch (err) {
    if (err instanceof ServiceError && err.code === 'VALIDATION_ERROR') {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: err.message });
      return;
    }
    throw err;
  }
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

  const presences = await getOnlineStatus(ids);
  res.json(presences);
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
    try {
      const { userId } = req.params as Record<string, string>;
      const user = await getUserById(userId);
      res.status(200).json(publicProfile(user));
    } catch (err) {
      if (err instanceof ServiceError && err.code === 'NOT_FOUND') {
        res.status(404).json({ code: 'NOT_FOUND', message: err.message });
        return;
      }
      throw err;
    }
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
      logger.error('[users] mutuals error:', err);
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
    logger.error('[users] equipped-cosmetics error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
}));

// ---------------------------------------------------------------------------
// GET /:userId/note — Get personal note about a user
// ---------------------------------------------------------------------------
usersRouter.get(
  '/:userId/note',
  requireAuth,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const authorId = req.userId!;
    const targetId = req.params.userId as string;
    const [note] = await db
      .select()
      .from(userNotes)
      .where(and(eq(userNotes.authorId, authorId), eq(userNotes.targetId, targetId)))
      .limit(1);
    res.json({ content: note?.content || '' });
  }),
);

// ---------------------------------------------------------------------------
// PUT /:userId/note — Upsert personal note about a user
// ---------------------------------------------------------------------------
usersRouter.put(
  '/:userId/note',
  requireAuth,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const authorId = req.userId!;
    const targetId = req.params.userId as string;
    const content = String(req.body.content || '').slice(0, 256);
    await db
      .insert(userNotes)
      .values({ authorId, targetId, content, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [userNotes.authorId, userNotes.targetId],
        set: { content, updatedAt: new Date() },
      });
    res.json({ success: true });
  }),
);

// ---------------------------------------------------------------------------
// POST /admin/:userId/badges — Admin-only badge assignment
// ---------------------------------------------------------------------------
usersRouter.post(
  '/admin/:userId/badges',
  requireAuth,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const [requester] = await db
      .select({ isAdmin: users.isAdmin })
      .from(users)
      .where(eq(users.id, req.userId!))
      .limit(1);
    if (!requester?.isAdmin) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Admin access required' });
      return;
    }
    const VALID_BADGES = ['admin', 'early_adopter', 'verified', 'developer', 'moderator', 'supporter'] as const;
    const { badges } = req.body;
    if (!Array.isArray(badges) || badges.length > 10) {
      res.status(400).json({ code: 'BAD_REQUEST', message: 'badges must be an array of max 10 items' });
      return;
    }
    const invalidBadge = badges.find((b: unknown) => !VALID_BADGES.includes(b as any));
    if (invalidBadge !== undefined) {
      res.status(400).json({ code: 'BAD_REQUEST', message: `Invalid badge: ${invalidBadge}. Valid values: ${VALID_BADGES.join(', ')}` });
      return;
    }
    await db.update(users).set({ badges }).where(eq(users.id, req.params.userId as string));
    res.json({ success: true });
  }),
);

// ---------------------------------------------------------------------------
// Guild Folders
// ---------------------------------------------------------------------------

/** GET /users/@me/guild-folders */
usersRouter.get('/@me/guild-folders', requireAuth, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const folders = await db.select().from(guildFolders)
    .where(eq(guildFolders.userId, req.userId!))
    .orderBy(asc(guildFolders.position));
  res.json(folders);
}));

/** POST /users/@me/guild-folders */
usersRouter.post('/@me/guild-folders', requireAuth, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { name, color, guildIds } = req.body as { name?: string; color?: string; guildIds?: string[] };
  const [folder] = await db.insert(guildFolders).values({
    userId: req.userId!,
    name: name || null,
    color: color ?? null,
    guildIds: guildIds || [],
  }).returning();
  res.status(201).json(folder);
}));

/** PATCH /users/@me/guild-folders/:folderId */
usersRouter.patch('/@me/guild-folders/:folderId', requireAuth, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { folderId } = req.params as Record<string, string>;
  const { name, color, guildIds, position } = req.body as { name?: string; color?: string; guildIds?: string[]; position?: number };

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (color !== undefined) updateData.color = color;
  if (guildIds !== undefined) updateData.guildIds = guildIds;
  if (position !== undefined) updateData.position = position;

  const [updated] = await db.update(guildFolders)
    .set(updateData)
    .where(and(eq(guildFolders.id, folderId), eq(guildFolders.userId, req.userId!)))
    .returning();

  if (!updated) { res.status(404).json({ code: 'NOT_FOUND', message: 'Folder not found' }); return; }
  res.json(updated);
}));

/** DELETE /users/@me/guild-folders/:folderId */
usersRouter.delete('/@me/guild-folders/:folderId', requireAuth, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { folderId } = req.params as Record<string, string>;
  await db.delete(guildFolders).where(and(eq(guildFolders.id, folderId), eq(guildFolders.userId, req.userId!)));
  res.json({ code: 'OK' });
}));

// ---------------------------------------------------------------------------
// Favorite Channels
// ---------------------------------------------------------------------------

/** GET /users/@me/favorites */
usersRouter.get('/@me/favorites', requireAuth, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const favorites = await db
    .select({
      channelId: favoriteChannels.channelId,
      position: favoriteChannels.position,
      channelName: channels.name,
      channelType: channels.type,
      guildId: channels.guildId,
    })
    .from(favoriteChannels)
    .leftJoin(channels, eq(channels.id, favoriteChannels.channelId))
    .where(eq(favoriteChannels.userId, req.userId!))
    .orderBy(asc(favoriteChannels.position));
  res.json(favorites);
}));

/** PUT /users/@me/favorites/:channelId */
usersRouter.put('/@me/favorites/:channelId', requireAuth, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { channelId } = req.params as Record<string, string>;
  const { position } = req.body as { position?: number };

  await db.insert(favoriteChannels).values({
    userId: req.userId!,
    channelId,
    position: position ?? 0,
  }).onConflictDoUpdate({
    target: [favoriteChannels.userId, favoriteChannels.channelId],
    set: { position: position ?? 0 },
  });

  res.json({ code: 'OK' });
}));

/** DELETE /users/@me/favorites/:channelId */
usersRouter.delete('/@me/favorites/:channelId', requireAuth, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { channelId } = req.params as Record<string, string>;
  await db.delete(favoriteChannels).where(
    and(eq(favoriteChannels.userId, req.userId!), eq(favoriteChannels.channelId, channelId)),
  );
  res.json({ code: 'OK' });
}));

// ---------------------------------------------------------------------------
// Rich Presence / Activity
// ---------------------------------------------------------------------------

const activitySchema = z.object({
  type: z.enum(['PLAYING', 'WATCHING', 'LISTENING', 'STREAMING']),
  name: z.string().min(1).max(128),
  details: z.string().max(256).optional(),
  state: z.string().max(256).optional(),
});

/** PATCH /users/@me/activity */
usersRouter.patch('/@me/activity', requireAuth, validate(activitySchema), asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const activity = req.body;
  await db.update(users).set({ activity, updatedAt: new Date() }).where(eq(users.id, req.userId!));

  // Cache in Redis so the members endpoint can read it without a DB join
  try { await redis.set(`presence:${req.userId!}:activity`, JSON.stringify(activity), 'EX', 600); } catch (err) { logger.debug({ msg: 'redis presence set failed', err }); }

  try {
    const memberships = await db.select({ guildId: guildMembers.guildId }).from(guildMembers).where(eq(guildMembers.userId, req.userId!));
    const io = getIO();
    for (const { guildId } of memberships) {
      io.to(`guild:${guildId}`).emit('PRESENCE_UPDATE', { userId: req.userId!, activity });
    }
  } catch (err) { logger.debug({ msg: 'socket emit failed', event: 'PRESENCE_UPDATE', err }); }

  res.json({ activity });
}));

/** DELETE /users/@me/activity */
usersRouter.delete('/@me/activity', requireAuth, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  await db.update(users).set({ activity: null, updatedAt: new Date() }).where(eq(users.id, req.userId!));

  // Remove from Redis cache
  try { await redis.del(`presence:${req.userId!}:activity`); } catch (err) { logger.debug({ msg: 'redis presence del failed', err }); }

  try {
    const memberships = await db.select({ guildId: guildMembers.guildId }).from(guildMembers).where(eq(guildMembers.userId, req.userId!));
    const io = getIO();
    for (const { guildId } of memberships) {
      io.to(`guild:${guildId}`).emit('PRESENCE_UPDATE', { userId: req.userId!, activity: null });
    }
  } catch (err) { logger.debug({ msg: 'socket emit failed', event: 'PRESENCE_UPDATE', err }); }

  res.json({ code: 'OK' });
}));

// ============================================================
// Unified Inbox
// ============================================================

// GET /users/@me/unified-inbox — returns recent notifications as inbox items
usersRouter.get('/@me/unified-inbox', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  try {
    const { notifications } = await import('../db/schema/notifications');
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(sql`${notifications.createdAt} desc`)
      .limit(50);
    const items = rows.map(n => {
      const data = (n.data ?? {}) as Record<string, unknown>;
      return {
        id: n.id,
        type: data.type === 'reply' ? 'reply' : data.type === 'unread' ? 'unread' : 'mention',
        messageId: (data.messageId as string) ?? '',
        channelId: (data.channelId as string) ?? '',
        channelName: (data.channelName as string) ?? '',
        guildId: (data.guildId as string) ?? '',
        guildName: (data.guildName as string) ?? '',
        guildIconHash: (data.guildIconHash as string) ?? null,
        authorId: (data.authorId as string) ?? '',
        authorName: (data.authorName as string) ?? n.title ?? '',
        authorAvatarHash: (data.authorAvatarHash as string) ?? null,
        contentPreview: n.body ?? '',
        createdAt: n.createdAt.toISOString(),
        read: n.read,
      };
    });
    res.json(items);
  } catch (err) {
    logger.debug({ msg: 'unified-inbox error', err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /users/@me/unified-inbox/read-all — mark all items as read (must be before :id route)
usersRouter.post('/@me/unified-inbox/read-all', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  try {
    const { notifications } = await import('../db/schema/notifications');
    await db.update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
    res.json({ success: true });
  } catch (err) {
    logger.debug({ msg: 'unified-inbox read-all error', err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /users/@me/unified-inbox/:id/read — mark single item as read
usersRouter.post('/@me/unified-inbox/:id/read', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const id = req.params.id as string;
  try {
    const { notifications } = await import('../db/schema/notifications');
    await db.update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
    res.json({ success: true });
  } catch (err) {
    logger.debug({ msg: 'unified-inbox mark-read error', err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// WAVE 3: Stats, Quick Reactions, Status Presets, Coin Gifting
// ============================================================

// GET /users/@me/stats
usersRouter.get('/@me/stats', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const [earnedCount] = await db.select({ count: sql<number>`count(*)::int` }).from(userAchievements).where(eq(userAchievements.userId, userId));
    const [bookmarkCount] = await db.select({ count: sql<number>`count(*)::int` }).from(messageBookmarks).where(eq(messageBookmarks.userId, userId));

    const nextLevelXp = Math.pow((user.level ?? 1), 2) * 100;
    const currentLevelXp = Math.pow(Math.max(0, (user.level ?? 1) - 1), 2) * 100;

    res.json({
      level: user.level ?? 1,
      xp: user.xp ?? 0,
      xpToNextLevel: nextLevelXp,
      xpForCurrentLevel: currentLevelXp,
      coins: user.coins ?? 0,
      currentStreak: user.currentStreak ?? 0,
      longestStreak: user.longestStreak ?? 0,
      achievementsEarned: earnedCount?.count ?? 0,
      bookmarks: bookmarkCount?.count ?? 0,
    });
  } catch (err) {
    logger.debug({ msg: 'failed to fetch user stats', err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /users/@me/quick-reactions
usersRouter.get('/@me/quick-reactions', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  try {
    const [row] = await db.select().from(userQuickReactions).where(eq(userQuickReactions.userId, userId)).limit(1);
    res.json(row ?? { userId, emojis: ['👍', '❤️', '😂', '🎉', '🔥', '😮', '😢', '👀'] });
  } catch (err) {
    logger.debug({ msg: 'failed to fetch quick reactions', err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /users/@me/quick-reactions
usersRouter.put('/@me/quick-reactions', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const { emojis } = req.body;
  if (!Array.isArray(emojis) || emojis.length > 8 || emojis.some((e: unknown) => typeof e !== 'string')) {
    res.status(400).json({ error: 'emojis must be an array of up to 8 strings' });
    return;
  }
  try {
    await db.insert(userQuickReactions).values({ userId, emojis })
      .onConflictDoUpdate({ target: userQuickReactions.userId, set: { emojis } });
    res.json({ emojis });
  } catch (err) {
    logger.debug({ msg: 'failed to update quick reactions', err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /users/@me/status-presets
usersRouter.get('/@me/status-presets', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  try {
    const presets = await db.select().from(statusPresets).where(eq(statusPresets.userId, userId));
    res.json(presets);
  } catch (err) {
    logger.debug({ msg: 'failed to fetch status presets', err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /users/@me/status-presets
usersRouter.post('/@me/status-presets', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const { status, customText, emoji } = req.body;
  if (!status) { res.status(400).json({ error: 'status is required' }); return; }
  try {
    const existing = await db.select().from(statusPresets).where(eq(statusPresets.userId, userId));
    if (existing.length >= 5) { res.status(400).json({ error: 'Maximum 5 status presets allowed' }); return; }
    const [preset] = await db.insert(statusPresets).values({ userId, status, customText, emoji }).returning();
    res.status(201).json(preset);
  } catch (err) {
    logger.debug({ msg: 'failed to create status preset', err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /users/@me/status-presets/:id
usersRouter.delete('/@me/status-presets/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const { id } = req.params as Record<string, string>;
  try {
    await db.delete(statusPresets).where(and(eq(statusPresets.id, id), eq(statusPresets.userId, userId)));
    res.status(204).send();
  } catch (err) {
    logger.debug({ msg: 'failed to delete status preset', err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /users/@me/status-presets/:id/apply
usersRouter.post('/@me/status-presets/:id/apply', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const { id } = req.params as Record<string, string>;
  try {
    const [preset] = await db.select().from(statusPresets)
      .where(and(eq(statusPresets.id, id), eq(statusPresets.userId, userId))).limit(1);
    if (!preset) { res.status(404).json({ error: 'Preset not found' }); return; }
    await db.update(users).set({
      status: preset.status as any,
      customStatus: preset.customText ?? null,
      statusEmoji: preset.emoji ?? null,
    }).where(eq(users.id, userId));
    res.json({ applied: true });
  } catch (err) {
    logger.debug({ msg: 'failed to apply status preset', err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /users/@me/gift — gift coins to a friend
usersRouter.post('/@me/gift', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const { toUserId, amount, message } = req.body;
  if (!toUserId || !amount || typeof amount !== 'number' || amount < 10) {
    res.status(400).json({ error: 'toUserId and amount (min 10) are required' });
    return;
  }
  try {
    const [sender] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!sender) { res.status(404).json({ error: 'Sender not found' }); return; }
    if ((sender.coins ?? 0) < amount) { res.status(400).json({ error: 'Insufficient coins' }); return; }

    // Check mutual friendship in either direction (must be FRIEND, not BLOCKED or PENDING)
    const [friendship] = await db.select().from(relationships)
      .where(
        and(
          eq(relationships.requesterId, userId),
          eq(relationships.addresseeId, toUserId),
          eq(relationships.type, 'FRIEND')
        )
      ).limit(1);
    const [friendship2] = await db.select().from(relationships)
      .where(
        and(
          eq(relationships.requesterId, toUserId),
          eq(relationships.addresseeId, userId),
          eq(relationships.type, 'FRIEND')
        )
      ).limit(1);
    if (!friendship && !friendship2) {
      res.status(403).json({ error: 'You can only gift coins to friends' });
      return;
    }

    await db.update(users).set({ coins: sql`coins - ${amount}` }).where(eq(users.id, userId));
    await db.update(users).set({ coins: sql`coins + ${amount}` }).where(eq(users.id, toUserId));

    // Activity events
    await db.insert(activityEvents).values([
      { userId, type: 'gifted_coins', payload: { toUserId, amount, message } },
      { userId: toUserId, type: 'received_coins', payload: { fromUserId: userId, amount, message } },
    ]);

    // Check achievements
    const { checkAchievements } = await import('./achievements');
    await checkAchievements(userId, 'coins_gifted');

    res.json({ success: true, amount });
  } catch (err) {
    logger.debug({ msg: 'failed to gift coins', err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /users/@me/onboarding-complete — grant onboarding reward (idempotent)
usersRouter.post('/@me/onboarding-complete', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) { res.status(404).json({ error: 'Not found' }); return; }

    if (!user.onboardingCompleted) {
      await db.update(users).set({ onboardingCompleted: true, coins: sql`coins + 100` }).where(eq(users.id, userId));
      // Grant achievement
      await db.insert(userAchievements).values({ userId, achievementId: 'early_adopter' }).onConflictDoNothing();
    }
    res.json({ success: true });
  } catch (err) {
    logger.debug({ msg: 'failed to complete onboarding', err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Sessions (Login History) ───────────────────────────────────────────

/** GET /users/@me/sessions — list active sessions */
usersRouter.get('/@me/sessions', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  try {
    const now = new Date();
    const rows = await db
      .select({
        id: refreshTokens.id,
        tokenHash: refreshTokens.tokenHash,
        device: refreshTokens.device,
        ip: refreshTokens.ip,
        lastActiveAt: refreshTokens.lastActiveAt,
        createdAt: refreshTokens.createdAt,
        expiresAt: refreshTokens.expiresAt,
      })
      .from(refreshTokens)
      .where(eq(refreshTokens.userId, userId))
      .orderBy(sql`${refreshTokens.lastActiveAt} DESC`);

    // Determine current session by matching the refresh cookie hash
    const rawToken: string | undefined = req.cookies?.['gratonite_refresh'];
    const currentHash = rawToken
      ? crypto.createHash('sha256').update(rawToken).digest('hex')
      : null;

    const sessions = rows
      .filter(r => r.expiresAt > now)
      .map(r => ({
        id: r.id,
        deviceName: r.device || 'Unknown Device',
        ipAddress: r.ip || '',
        userAgent: null,
        lastActiveAt: (r.lastActiveAt || r.createdAt)?.toISOString(),
        createdAt: r.createdAt?.toISOString(),
        current: r.tokenHash === currentHash,
      }));

    res.json(sessions);
  } catch (err) {
    handleAppError(res, err, 'user-sessions');
  }
});

/** DELETE /users/@me/sessions/:sessionId — revoke a session */
usersRouter.delete('/@me/sessions/:sessionId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  const sessionId = req.params.sessionId as string;
  try {
    const deleted = await db
      .delete(refreshTokens)
      .where(and(eq(refreshTokens.id, sessionId), eq(refreshTokens.userId, userId)))
      .returning({ id: refreshTokens.id });
    if (deleted.length === 0) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Session not found' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    handleAppError(res, err, 'user-sessions');
  }
});

/** DELETE /users/@me/sessions — revoke all sessions except the current one */
usersRouter.delete('/@me/sessions', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  try {
    // Find the current session by matching the refresh cookie hash
    const rawToken = req.cookies?.gratonite_refresh;
    let currentTokenHash: string | null = null;
    if (rawToken) {
      const crypto = await import('crypto');
      currentTokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    }

    if (currentTokenHash) {
      await db
        .delete(refreshTokens)
        .where(
          and(
            eq(refreshTokens.userId, userId),
            ne(refreshTokens.tokenHash, currentTokenHash),
          ),
        );
    } else {
      // No cookie available — revoke all sessions
      await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
    }

    res.json({ success: true, message: 'All other sessions revoked' });
  } catch (err) {
    handleAppError(res, err, 'user-sessions');
  }
});

// ─── Data Exports (GDPR) ───────────────────────────────────────────────

/** GET /users/@me/data-exports — list user's data exports */
usersRouter.get('/@me/data-exports', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  try {
    const exports = await db
      .select()
      .from(dataExports)
      .where(eq(dataExports.userId, userId))
      .orderBy(sql`${dataExports.createdAt} DESC`);
    res.json(exports);
  } catch (err) {
    logger.debug({ msg: 'failed to fetch data exports', err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** POST /users/@me/data-exports — request a new data export */
usersRouter.post('/@me/data-exports', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId!;
  try {
    const [exported] = await db
      .insert(dataExports)
      .values({ userId, status: 'pending' })
      .returning();
    res.status(201).json(exported);
  } catch (err) {
    logger.debug({ msg: 'failed to create data export', err });
    res.status(500).json({ error: 'Internal server error' });
  }
});
