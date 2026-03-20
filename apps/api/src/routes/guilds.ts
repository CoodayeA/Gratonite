/**
 * routes/guilds.ts — Express router for guild (server) endpoints.
 *
 * Mounted at /api/v1/guilds by src/routes/index.ts.
 *
 * Endpoints:
 *   GET    /@me                      — List guilds the current user is a member of
 *   POST   /                         — Create a new guild
 *   GET    /discover                 — Discover public guilds (isDiscoverable = true)
 *   POST   /:guildId/join            — Join a discoverable guild
 *   GET    /:guildId                 — Get guild info (must be member)
 *   PATCH  /:guildId                 — Update guild settings (must be owner)
 *   DELETE /:guildId                 — Delete guild (must be owner)
 *   GET    /:guildId/members         — List guild members
 *   DELETE /:guildId/members/:userId — Kick a member (must be owner)
 *
 * Internal helpers (not exported as HTTP routes):
 *   requireMember(guildId, userId) — throws 403 AppError if user is not a member
 *   requireOwner(guildId, userId)  — throws 403 AppError if user is not the owner
 *
 * @module routes/guilds
 */

import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { z } from 'zod';
import { guildService, ServiceError } from '../services/guild.service';
import { eq, desc, sql, and, inArray, asc, ilike, gt, gte, SQL } from 'drizzle-orm';
import multer from 'multer';

import { db } from '../db/index';
import { guilds } from '../db/schema/guilds';
import { guildMembers } from '../db/schema/guilds';
import { serverBoosts } from '../db/schema/server-boosts';
import { guildTags } from '../db/schema/guild-tags';
import { channels } from '../db/schema/channels';
import { users } from '../db/schema/users';
import { roles, memberRoles, DEFAULT_PERMISSIONS, Permissions } from '../db/schema/roles';
import { guildMemberGroups, guildMemberGroupMembers } from '../db/schema/member-groups';
import { guildBans } from '../db/schema/bans';
import { auditLog } from '../db/schema/audit';
import { files } from '../db/schema/files';
import { guildMemberOnboarding } from '../db/schema/guild-onboarding';
import { channelReadState } from '../db/schema/channel-read-state';
import { guildRatings } from '../db/schema/guild-ratings';
import { guildMemberProfiles } from '../db/schema/guild-member-profiles';
import { messages } from '../db/schema/messages';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { hasPermission } from './roles';
import { getIO } from '../lib/socket-io';
import { logAuditEvent, AuditActionTypes, AuditTargetTypes } from '../lib/audit';
import { redis } from '../lib/redis';
import { toRows } from '../lib/to-rows.js';
import { cacheControl } from '../middleware/cache';
import { recordActivity } from './activity';
import { dispatchEvent } from '../lib/webhook-dispatch';
import { incrementChallengeProgress } from './daily-challenges';

export const guildsRouter = Router();

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const guildMediaUpload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '';
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Emit GROUP_KEY_ROTATION_NEEDED for every encrypted channel in a guild.
 * Called after a member is added or removed so that the guild owner can
 * re-wrap the channel key for the new member set.
 */
async function emitKeyRotationForEncryptedChannels(
  guildId: string,
  reason: 'member_added' | 'member_removed',
): Promise<void> {
  try {
    const encryptedChannels = await db
      .select({ id: channels.id })
      .from(channels)
      .where(and(eq(channels.guildId, guildId), eq(channels.isEncrypted, true)));

    if (encryptedChannels.length === 0) return;

    const io = getIO();
    for (const ch of encryptedChannels) {
      io.to(`guild:${guildId}`).emit('GROUP_KEY_ROTATION_NEEDED', {
        channelId: ch.id,
        reason,
      });
    }
  } catch (err) {
    logger.debug({ msg: 'socket emit failed', event: 'GROUP_KEY_ROTATION_NEEDED', err });
  }
}

/**
 * AppError — A lightweight error subclass that carries an HTTP status code.
 *
 * Thrown by `requireMember` and `requireOwner` and caught in each handler's
 * try/catch. Using a typed error lets us distinguish intentional HTTP errors
 * from unexpected runtime errors and respond with the right status code.
 */
class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code: string = 'UNKNOWN_ERROR',
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * requireMember — Verify that a user is a member of the specified guild.
 *
 * Queries `guild_members` for a row matching (guildId, userId). Throws a
 * 403 AppError if no row is found, which signals the handler to respond
 * with 403 Forbidden.
 *
 * @param guildId - UUID of the guild.
 * @param userId  - UUID of the user to check.
 * @throws {AppError} 403 if the user is not a member.
 */
export async function requireMember(guildId: string, userId: string): Promise<void> {
  const [membership] = await db
    .select({ id: guildMembers.id })
    .from(guildMembers)
    .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, userId)))
    .limit(1);

  if (!membership) {
    throw new AppError(403, 'You are not a member of this guild', 'FORBIDDEN');
  }
}

/**
 * requireOwner — Verify that a user is the owner of the specified guild.
 *
 * Queries `guilds` for the row and checks that `ownerId` matches the provided
 * userId. Throws 404 if the guild doesn't exist and 403 if the user is not
 * the owner.
 *
 * @param guildId - UUID of the guild.
 * @param userId  - UUID of the user to check.
 * @returns       The guild row (for re-use in the calling handler).
 * @throws {AppError} 404 if guild not found.
 * @throws {AppError} 403 if user is not the owner.
 */
export async function requireOwner(
  guildId: string,
  userId: string,
): Promise<typeof guilds.$inferSelect> {
  const [guild] = await db.select().from(guilds).where(eq(guilds.id, guildId)).limit(1);

  if (!guild) {
    throw new AppError(404, 'Guild not found', 'NOT_FOUND');
  }

  if (guild.ownerId !== userId) {
    throw new AppError(403, 'Only the guild owner can perform this action', 'FORBIDDEN');
  }

  return guild;
}

/**
 * handleAppError — Common try/catch pattern used in every handler.
 *
 * Differentiates between intentional AppErrors (respond with their status code)
 * and unexpected errors (log and respond 500).
 *
 * @param res - Express Response object.
 * @param err - The caught error.
 */
function handleAppError(res: Response, err: unknown): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ code: err.code, message: err.message });
  } else if (err instanceof ServiceError) {
    const statusMap: Record<string, number> = {
      NOT_FOUND: 404,
      FORBIDDEN: 403,
      DUPLICATE_NAME: 409,
      VALIDATION_ERROR: 400,
      CONFLICT: 409,
    };
    res.status(statusMap[err.code] ?? 500).json({ code: err.code, message: err.message });
  } else {
    logger.error('[guilds] unexpected error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

/**
 * Schema for POST / — create guild.
 */
const createGuildSchema = z.object({
  name: z
    .string()
    .min(2, 'Guild name must be at least 2 characters')
    .max(100, 'Guild name must be at most 100 characters'),
  description: z.string().max(500).optional(),
  isDiscoverable: z.boolean().optional(),
});

/**
 * Schema for PATCH /:guildId — update guild settings.
 */
const updateGuildSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  isDiscoverable: z.boolean().optional(),
  accentColor: z
    .string()
    .regex(/^#?[0-9a-fA-F]{6}$/, 'Accent color must be a 6-digit hex color')
    .nullable()
    .optional(),
  welcomeMessage: z.string().max(2000).nullable().optional(),
  rulesChannelId: z.string().uuid().nullable().optional(),
  category: z.string().max(30).nullable().optional(),
  tags: z.array(z.string().max(32)).max(10).optional(),
  rulesText: z.string().max(5000).nullable().optional(),
  requireRulesAgreement: z.boolean().optional(),
  raidProtectionEnabled: z.boolean().optional(),
  publicStatsEnabled: z.boolean().optional(),
  spotlightChannelId: z.string().uuid().nullable().optional(),
  spotlightMessage: z.string().max(2000).nullable().optional(),
});

/**
 * Schema for member profile updates scoped to a guild membership.
 *
 * Note: guild member profiles currently persist nickname on `guild_members`.
 * Additional fields like bio/avatar/banner are accepted by the API contract
 * but only nickname is persisted until dedicated member-profile storage exists.
 */
const updateMemberProfileSchema = z.object({
  nickname: z.string().max(64).nullable().optional(),
  bio: z.string().max(190).nullable().optional(),
});

const createMemberGroupSchema = z.object({
  name: z.string().min(1).max(64),
  color: z.string().regex(/^#?[0-9a-fA-F]{6}$/).optional(),
  position: z.number().int().min(0).max(9999).optional(),
});

const updateMemberGroupSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  color: z.string().regex(/^#?[0-9a-fA-F]{6}$/).optional(),
  position: z.number().int().min(0).max(9999).optional(),
});

function normalizeHexColor(input: string): string {
  const normalized = input.startsWith('#') ? input : `#${input}`;
  return normalized.toLowerCase();
}

function parseBooleanQuery(value: unknown): boolean | undefined {
  if (typeof value !== 'string') return undefined;
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  return undefined;
}

function normalizeHashtag(raw: string): string {
  return raw.trim().toLowerCase().replace(/^#/, '').replace(/[^a-z0-9_-]/g, '');
}

function extractTags(name: string, description: string | null): string[] {
  const source = `${name} ${description ?? ''}`;
  const matches = source.matchAll(/#([a-z0-9_-]{2,32})/gi);
  const tags = new Set<string>();
  for (const match of matches) {
    tags.add(match[1].toLowerCase());
  }
  return [...tags];
}

type MemberWithPresenceStatus = 'online' | 'idle' | 'dnd' | 'invisible' | 'offline';

function normalizePresenceStatus(value: string): MemberWithPresenceStatus {
  if (value === 'online' || value === 'idle' || value === 'dnd' || value === 'invisible' || value === 'offline') {
    return value;
  }
  return 'offline';
}

// ---------------------------------------------------------------------------
// GET /@me
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/guilds/@me
 *
 * Return all guilds the authenticated user is currently a member of.
 * Includes basic guild information and current member count.
 *
 * @auth    requireAuth
 * @returns 200 Array of { id, name, iconHash, memberCount }
 */
guildsRouter.get('/@me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const rows = await guildService.getUserGuilds(req.userId!);
    res.status(200).json(rows);
  } catch (err) {
    handleAppError(res, err);
  }
});

// ---------------------------------------------------------------------------
// POST /
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/guilds
 *
 * Create a new guild. The authenticated user becomes the owner and the first
 * member. Two default channels are created automatically:
 *   - #general — a GUILD_TEXT channel at position 0
 *   - Voice    — a GUILD_VOICE channel at position 1
 *
 * @auth    requireAuth
 * @body    { name: string (2-100 chars), description?: string }
 * @returns 201 { guild: GuildRow, channels: ChannelRow[] }
 *
 * Side effects:
 *   - Inserts row in `guilds` (ownerId = req.userId, memberCount = 1).
 *   - Inserts row in `guild_members`.
 *   - Inserts two rows in `channels` (#general, Voice).
 */
guildsRouter.post(
  '/',
  requireAuth,
  validate(createGuildSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, description, isDiscoverable } = req.body as z.infer<typeof createGuildSchema>;
      const guild = await guildService.createGuild(req.userId!, { name, description, isDiscoverable });
      res.status(201).json(guild);
    } catch (err) {
      handleAppError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /discover
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/guilds/discover
 *
 * Return publicly discoverable guilds (isDiscoverable = true), ordered by
 * member count descending. Supports optional name search via query param.
 *
 * @auth    requireAuth
 * @query   q? {string} — Filter by guild name (case-insensitive ILIKE)
 * @returns 200 Array of { id, name, description, iconHash, bannerHash, memberCount }
 *               Limited to 20 results.
 */
guildsRouter.get(
  '/lounge/gratonite',
  requireAuth,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const configuredLoungeId = (process.env.GRATONITE_LOUNGE_GUILD_ID ?? '').trim();
      let lounge: {
        id: string;
        name: string;
        isDiscoverable: boolean;
        isPinned: boolean;
      } | null = null;

      if (configuredLoungeId) {
        const [row] = await db
          .select({
            id: guilds.id,
            name: guilds.name,
            isDiscoverable: guilds.isDiscoverable,
            isPinned: guilds.isPinned,
          })
          .from(guilds)
          .where(eq(guilds.id, configuredLoungeId))
          .limit(1);
        lounge = row ?? null;
      }

      if (!lounge) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Gratonite Lounge is not configured.' });
        return;
      }

      res.status(200).json({
        id: lounge.id,
        name: lounge.name,
        slug: 'gratonite-lounge',
        isDiscoverable: lounge.isDiscoverable,
        isPinned: lounge.isPinned,
      });
    } catch (err) {
      handleAppError(res, err);
    }
  },
);

guildsRouter.get(
  '/discover',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      const hashtag = typeof req.query.hashtag === 'string' ? normalizeHashtag(req.query.hashtag) : '';
      const featuredFilter = parseBooleanQuery(req.query.featured);
      const requestedLimit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 20;
      const requestedOffset = typeof req.query.offset === 'string' ? Number(req.query.offset) : 0;
      const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 20;
      const offset = Number.isFinite(requestedOffset) ? Math.max(requestedOffset, 0) : 0;
      const escapedQ = q.replace(/[%_\\]/g, '\\$&');

      // New filter / sort params
      const categoryFilter = typeof req.query.category === 'string' ? req.query.category.trim().toLowerCase() : '';
      const tagFilter = typeof req.query.tag === 'string' ? req.query.tag.trim().toLowerCase() : '';
      const sortParam = typeof req.query.sort === 'string' ? req.query.sort.trim() : 'members';

      // Build WHERE conditions for guilds query
      const conditions: SQL[] = [eq(guilds.isDiscoverable, true)];
      if (q.length > 0) {
        conditions.push(ilike(guilds.name, `%${escapedQ}%`));
      }
      if (categoryFilter.length > 0) {
        conditions.push(eq(guilds.category, categoryFilter));
      }

      type GuildRow = {
        id: string;
        name: string;
        description: string | null;
        iconHash: string | null;
        bannerHash: string | null;
        isDiscoverable: boolean;
        isFeatured: boolean;
        isPinned: boolean;
        discoverRank: number;
        memberCount: number;
        category: string | null;
        createdAt: Date;
      };

      let rows: GuildRow[];

      if (tagFilter.length > 0) {
        rows = await db
          .selectDistinct({
            id: guilds.id,
            name: guilds.name,
            description: guilds.description,
            iconHash: guilds.iconHash,
            bannerHash: guilds.bannerHash,
            isDiscoverable: guilds.isDiscoverable,
            isFeatured: guilds.isFeatured,
            isPinned: guilds.isPinned,
            discoverRank: guilds.discoverRank,
            memberCount: guilds.memberCount,
            category: guilds.category,
            createdAt: guilds.createdAt,
          })
          .from(guilds)
          .innerJoin(guildTags, and(
            eq(guildTags.guildId, guilds.id),
            ilike(guildTags.tag, tagFilter),
          ))
          .where(and(...conditions));
      } else {
        rows = await db
          .select({
            id: guilds.id,
            name: guilds.name,
            description: guilds.description,
            iconHash: guilds.iconHash,
            bannerHash: guilds.bannerHash,
            isDiscoverable: guilds.isDiscoverable,
            isFeatured: guilds.isFeatured,
            isPinned: guilds.isPinned,
            discoverRank: guilds.discoverRank,
            memberCount: guilds.memberCount,
            category: guilds.category,
            createdAt: guilds.createdAt,
          })
          .from(guilds)
          .where(and(...conditions));
      }

      // Fetch all guild_tags rows for the returned guilds
      const guildIds = rows.map((r) => r.id);
      const tagsByGuildId: Record<string, string[]> = {};
      if (guildIds.length > 0) {
        const tagRows = await db
          .select({ guildId: guildTags.guildId, tag: guildTags.tag })
          .from(guildTags)
          .where(inArray(guildTags.guildId, guildIds));
        for (const tr of tagRows) {
          if (!tagsByGuildId[tr.guildId]) tagsByGuildId[tr.guildId] = [];
          tagsByGuildId[tr.guildId].push(tr.tag);
        }
      }

      // Fetch average ratings for returned guilds
      const ratingsByGuildId: Record<string, { avg: number; count: number }> = {};
      if (guildIds.length > 0) {
        const ratingRows = await db
          .select({
            guildId: guildRatings.guildId,
            avg: sql<number>`coalesce(avg(${guildRatings.rating}), 0)`.mapWith(Number),
            count: sql<number>`count(*)::int`.mapWith(Number),
          })
          .from(guildRatings)
          .where(inArray(guildRatings.guildId, guildIds))
          .groupBy(guildRatings.guildId);
        for (const r of ratingRows) {
          ratingsByGuildId[r.guildId] = { avg: Math.round(r.avg * 100) / 100, count: r.count };
        }
      }

      const enriched = rows.map((row) => {
        const extractedTags = extractTags(row.name, row.description);
        const dbTags = tagsByGuildId[row.id] ?? [];
        const mergedTags = [...new Set([...dbTags, ...extractedTags])];
        return {
          id: row.id,
          name: row.name,
          description: row.description,
          iconHash: row.iconHash,
          bannerHash: row.bannerHash,
          memberCount: row.memberCount,
          tags: mergedTags,
          category: row.category ?? null,
          categories: [] as string[],
          featured: row.isFeatured,
          isFeatured: row.isFeatured,
          discoverRank: row.discoverRank,
          verified: row.memberCount >= 100,
          isPublic: row.isDiscoverable,
          isPinned: row.isPinned,
          createdAt: row.createdAt,
          averageRating: ratingsByGuildId[row.id]?.avg ?? 0,
          totalRatings: ratingsByGuildId[row.id]?.count ?? 0,
        };
      });

      let filtered = enriched;
      if (hashtag.length > 0) {
        filtered = filtered.filter((g) => g.tags.includes(hashtag));
      }
      if (featuredFilter !== undefined) {
        filtered = filtered.filter((g) => g.featured === featuredFilter);
      }
      if (q.length > 0) {
        const qNorm = q.toLowerCase();
        filtered = filtered.filter((g) =>
          g.name.toLowerCase().includes(qNorm)
          || (g.description ?? '').toLowerCase().includes(qNorm)
          || g.tags.some((tag) => tag.includes(qNorm))
          || `#${qNorm}` === `#${normalizeHashtag(qNorm)}` && g.tags.includes(normalizeHashtag(qNorm)),
        );
      }

      filtered.sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        if (sortParam === 'rating') {
          return (b.averageRating - a.averageRating) || (b.totalRatings - a.totalRatings);
        }
        if (sortParam === 'activity' || sortParam === 'trending') {
          const timeDiff = b.createdAt.getTime() - a.createdAt.getTime();
          if (timeDiff !== 0) return timeDiff;
          if (a.memberCount !== b.memberCount) return b.memberCount - a.memberCount;
        } else {
          if (a.discoverRank !== b.discoverRank) return a.discoverRank - b.discoverRank;
          if (a.memberCount !== b.memberCount) return b.memberCount - a.memberCount;
        }
        return a.name.localeCompare(b.name);
      });

      console.info(JSON.stringify({
        event: 'discover_query',
        route: '/guilds/discover',
        q: q || null,
        hashtag: hashtag || null,
        category: categoryFilter || null,
        tag: tagFilter || null,
        sort: sortParam,
        featured: featuredFilter ?? null,
        resultCount: filtered.length,
      }));
      res.status(200).json(filtered.slice(offset, offset + limit));
    } catch (err) {
      handleAppError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /tags — Available discovery tags
// ---------------------------------------------------------------------------

const AVAILABLE_TAGS = ['Gaming', 'Music', 'Art', 'Technology', 'Education', 'Community', 'Entertainment', 'Sports', 'Science', 'Anime'];

guildsRouter.get('/tags', cacheControl(300), (_req: Request, res: Response) => {
  try {
    res.json(AVAILABLE_TAGS);
  } catch (err) {
    console.error('[guilds] GET /tags error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /:guildId/join
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/guilds/:guildId/join
 *
 * Join a discoverable guild directly from Discover. If the user is already a
 * member, this endpoint is idempotent and returns success with
 * `alreadyMember: true`.
 *
 * @auth    requireAuth
 * @param   guildId {string} — Guild UUID
 * @returns 200 { id, name, memberCount, joined, alreadyMember }
 * @returns 403 INVITE_REQUIRED when guild is not discoverable
 * @returns 404 NOT_FOUND when guild does not exist
 */
guildsRouter.post(
  '/:guildId/join',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { guildId } = req.params as Record<string, string>;
      const result = await guildService.joinGuild(req.userId!, guildId);
      res.status(200).json(result);
    } catch (err) {
      // Map FORBIDDEN with invite message to INVITE_REQUIRED for backwards compat
      if (err instanceof ServiceError && err.code === 'FORBIDDEN' && err.message.includes('invite')) {
        res.status(403).json({ code: 'INVITE_REQUIRED', message: err.message });
        return;
      }
      handleAppError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /:guildId/onboarding
// ---------------------------------------------------------------------------

guildsRouter.get(
  '/:guildId/onboarding',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { guildId } = req.params as Record<string, string>;
      const userId = req.userId!;

      await requireMember(guildId, userId);

      const [guild] = await db
        .select({
          welcomeMessage: guilds.welcomeMessage,
          rulesChannelId: guilds.rulesChannelId,
        })
        .from(guilds)
        .where(eq(guilds.id, guildId))
        .limit(1);

      if (!guild) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Guild not found' });
        return;
      }

      const [onboarding] = await db
        .select()
        .from(guildMemberOnboarding)
        .where(
          and(
            eq(guildMemberOnboarding.guildId, guildId),
            eq(guildMemberOnboarding.userId, userId),
          ),
        )
        .limit(1);

      const completed = onboarding ? onboarding.completedAt !== null : true;

      res.status(200).json({
        completed,
        welcomeMessage: guild.welcomeMessage,
        rulesChannelId: guild.rulesChannelId,
      });
    } catch (err) {
      handleAppError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /:guildId/onboarding/complete
// ---------------------------------------------------------------------------

guildsRouter.post(
  '/:guildId/onboarding/complete',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { guildId } = req.params as Record<string, string>;
      const userId = req.userId!;

      await requireMember(guildId, userId);

      await db
        .insert(guildMemberOnboarding)
        .values({ guildId, userId, completedAt: new Date() })
        .onConflictDoUpdate({
          target: [guildMemberOnboarding.guildId, guildMemberOnboarding.userId],
          set: { completedAt: new Date() },
        });

      res.status(200).json({ completed: true });
    } catch (err) {
      handleAppError(res, err);
    }
  },
);

// ============================================================
// WAVE 3: Trending Guilds
// ============================================================

// GET /guilds/trending — must be before /:guildId to avoid param capture
guildsRouter.get('/trending', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const trending = await db.select({
      guildId: guildMembers.guildId,
      newMemberCount: sql<number>`count(*)::int`,
    })
      .from(guildMembers)
      .where(gte(guildMembers.joinedAt, sevenDaysAgo))
      .groupBy(guildMembers.guildId)
      .orderBy(desc(sql`count(*)`))
      .limit(20);

    if (trending.length === 0) {
      res.json([]);
      return;
    }

    const guildIds = trending.map(t => t.guildId);
    const guildDetails = await db.select({
      id: guilds.id,
      name: guilds.name,
      description: guilds.description,
      iconHash: guilds.iconHash,
      memberCount: guilds.memberCount,
    }).from(guilds).where(inArray(guilds.id, guildIds));

    const result = trending.map(t => ({
      ...guildDetails.find(g => g.id === t.guildId),
      newMemberCount: t.newMemberCount,
    })).filter(g => g.id);

    res.json(result);
  } catch (err) {
    logger.debug({ msg: 'failed to fetch trending guilds', err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /:guildId
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/guilds/:guildId
 *
 * Return basic information about a guild. The user must be a member.
 *
 * @auth    requireAuth, requireMember
 * @param   guildId {string} — Guild UUID
 * @returns 200 { id, name, description, iconHash, bannerHash, ownerId,
 *                 isDiscoverable, memberCount, createdAt }
 * @returns 403 Not a member
 * @returns 404 Guild not found
 */
guildsRouter.get(
  '/:guildId',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { guildId } = req.params as Record<string, string>;
      const userId = req.userId!;
      const guild = await guildService.getGuildById(guildId, userId);

      // Daily challenge progress: track unique server visits (fire-and-forget)
      // Use Redis set to deduplicate — only counts each guild once per day
      const redisKey = `challenge:visit_servers:${userId}:${new Date().toISOString().slice(0, 10)}`;
      redis.sadd(redisKey, guildId).then(async (added) => {
        if (added === 1) {
          // First visit to this guild today — count it
          await redis.expire(redisKey, 86400 + 3600); // expires after ~25 hours
          incrementChallengeProgress(userId, 'visit_servers');
        }
      }).catch(() => {});

      res.status(200).json(guild);
    } catch (err) {
      handleAppError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /:guildId
// ---------------------------------------------------------------------------

/**
 * PATCH /api/v1/guilds/:guildId
 *
 * Update guild settings. Only the guild owner may call this endpoint.
 * Fields not included in the body are left unchanged.
 *
 * @auth    requireAuth, requireOwner
 * @param   guildId {string} — Guild UUID
 * @body    { name?, description?, isDiscoverable? }
 * @returns 200 Updated guild row
 * @returns 400 Validation failure
 * @returns 403 Not the owner
 * @returns 404 Guild not found
 *
 * Side effects:
 *   - Updates `guilds` row and bumps updatedAt.
 */
guildsRouter.patch(
  '/:guildId',
  requireAuth,
  validate(updateGuildSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { guildId } = req.params as Record<string, string>;
      const body = req.body as z.infer<typeof updateGuildSchema>;
      const updated = await guildService.updateGuild(guildId, req.userId!, body);
      res.status(200).json(updated);
    } catch (err) {
      handleAppError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /:guildId/icon
// ---------------------------------------------------------------------------

guildsRouter.post(
  '/:guildId/icon',
  requireAuth,
  guildMediaUpload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { guildId } = req.params as Record<string, string>;
      await requireMember(guildId, req.userId!);

      if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
        throw new AppError(403, 'Missing MANAGE_GUILD permission', 'FORBIDDEN');
      }

      if (!req.file) {
        res.status(400).json({ code: 'BAD_REQUEST', message: 'No file provided' });
        return;
      }

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

      await db
        .update(guilds)
        .set({ iconHash: fileId, updatedAt: new Date() })
        .where(eq(guilds.id, guildId));

      res.status(200).json({
        iconHash: fileId,
        iconAnimated: req.file.mimetype === 'image/gif',
        url,
      });
    } catch (err) {
      handleAppError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /:guildId/icon
// ---------------------------------------------------------------------------

guildsRouter.delete(
  '/:guildId/icon',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { guildId } = req.params as Record<string, string>;
      await requireMember(guildId, req.userId!);

      if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
        throw new AppError(403, 'Missing MANAGE_GUILD permission', 'FORBIDDEN');
      }

      await db
        .update(guilds)
        .set({ iconHash: null, updatedAt: new Date() })
        .where(eq(guilds.id, guildId));

      res.status(200).json({ code: 'OK' });
    } catch (err) {
      handleAppError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /:guildId/banner
// ---------------------------------------------------------------------------

guildsRouter.post(
  '/:guildId/banner',
  requireAuth,
  guildMediaUpload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { guildId } = req.params as Record<string, string>;
      await requireMember(guildId, req.userId!);

      if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
        throw new AppError(403, 'Missing MANAGE_GUILD permission', 'FORBIDDEN');
      }

      if (!req.file) {
        res.status(400).json({ code: 'BAD_REQUEST', message: 'No file provided' });
        return;
      }

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

      await db
        .update(guilds)
        .set({ bannerHash: fileId, updatedAt: new Date() })
        .where(eq(guilds.id, guildId));

      res.status(200).json({
        bannerHash: fileId,
        bannerAnimated: req.file.mimetype === 'image/gif',
        url,
      });
    } catch (err) {
      handleAppError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /:guildId/banner
// ---------------------------------------------------------------------------

guildsRouter.delete(
  '/:guildId/banner',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { guildId } = req.params as Record<string, string>;
      await requireMember(guildId, req.userId!);

      if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
        throw new AppError(403, 'Missing MANAGE_GUILD permission', 'FORBIDDEN');
      }

      await db
        .update(guilds)
        .set({ bannerHash: null, updatedAt: new Date() })
        .where(eq(guilds.id, guildId));

      res.status(200).json({ code: 'OK' });
    } catch (err) {
      handleAppError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /:guildId
// ---------------------------------------------------------------------------

/**
 * DELETE /api/v1/guilds/:guildId
 *
 * Permanently delete a guild. Only the owner may perform this action. All
 * channels, messages, and members are cascade-deleted by the database.
 *
 * @auth    requireAuth, requireOwner
 * @param   guildId {string} — Guild UUID
 * @returns 200 { message: 'Guild deleted' }
 * @returns 403 Not the owner
 * @returns 404 Guild not found
 *
 * Side effects:
 *   - Cascade deletes: channels, messages, guild_members.
 */
guildsRouter.delete(
  '/:guildId',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { guildId } = req.params as Record<string, string>;
      await guildService.deleteGuild(guildId, req.userId!);
      res.status(200).json({ code: 'OK', message: 'Guild deleted' });
    } catch (err) {
      handleAppError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// Member group routes
// ---------------------------------------------------------------------------

guildsRouter.get(
  '/:guildId/member-groups',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { guildId } = req.params as Record<string, string>;
      await requireMember(guildId, req.userId!);

      const groups = await db
        .select({
          id: guildMemberGroups.id,
          guildId: guildMemberGroups.guildId,
          name: guildMemberGroups.name,
          color: guildMemberGroups.color,
          position: guildMemberGroups.position,
          createdBy: guildMemberGroups.createdBy,
          createdAt: guildMemberGroups.createdAt,
          updatedAt: guildMemberGroups.updatedAt,
        })
        .from(guildMemberGroups)
        .where(eq(guildMemberGroups.guildId, guildId))
        .orderBy(desc(guildMemberGroups.position), asc(guildMemberGroups.name));

      const membershipRows = await db
        .select({
          groupId: guildMemberGroupMembers.groupId,
          userId: guildMemberGroupMembers.userId,
        })
        .from(guildMemberGroupMembers)
        .where(eq(guildMemberGroupMembers.guildId, guildId));

      const memberIdsByGroup = new Map<string, string[]>();
      for (const row of membershipRows) {
        const value = memberIdsByGroup.get(row.groupId) ?? [];
        value.push(row.userId);
        memberIdsByGroup.set(row.groupId, value);
      }

      res.status(200).json(groups.map((group) => ({
        ...group,
        memberIds: memberIdsByGroup.get(group.id) ?? [],
      })));
    } catch (err) {
      handleAppError(res, err);
    }
  },
);

guildsRouter.post(
  '/:guildId/member-groups',
  requireAuth,
  validate(createMemberGroupSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { guildId } = req.params as Record<string, string>;
      await requireMember(guildId, req.userId!);

      if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
        throw new AppError(403, 'Missing MANAGE_GUILD permission', 'FORBIDDEN');
      }

      const body = req.body as z.infer<typeof createMemberGroupSchema>;
      const [created] = await db
        .insert(guildMemberGroups)
        .values({
          guildId,
          name: body.name,
          color: body.color ? normalizeHexColor(body.color) : '#99aab5',
          position: body.position ?? 0,
          createdBy: req.userId!,
        })
        .returning();

      console.info(JSON.stringify({
        event: 'member_group_created',
        guildId,
        groupId: created.id,
        actorId: req.userId!,
      }));
      res.status(201).json(created);
    } catch (err) {
      handleAppError(res, err);
    }
  },
);

guildsRouter.patch(
  '/:guildId/member-groups/:groupId',
  requireAuth,
  validate(updateMemberGroupSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { guildId, groupId } = req.params as Record<string, string>;
      await requireMember(guildId, req.userId!);

      if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
        throw new AppError(403, 'Missing MANAGE_GUILD permission', 'FORBIDDEN');
      }

      const body = req.body as z.infer<typeof updateMemberGroupSchema>;
      const patch: Partial<typeof guildMemberGroups.$inferInsert> = { updatedAt: new Date() };
      if (body.name !== undefined) patch.name = body.name;
      if (body.color !== undefined) patch.color = normalizeHexColor(body.color);
      if (body.position !== undefined) patch.position = body.position;

      const [updated] = await db
        .update(guildMemberGroups)
        .set(patch)
        .where(and(eq(guildMemberGroups.id, groupId), eq(guildMemberGroups.guildId, guildId)))
        .returning();

      if (!updated) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Member group not found' });
        return;
      }

      console.info(JSON.stringify({
        event: 'member_group_updated',
        guildId,
        groupId,
        actorId: req.userId!,
      }));
      res.status(200).json(updated);
    } catch (err) {
      handleAppError(res, err);
    }
  },
);

guildsRouter.delete(
  '/:guildId/member-groups/:groupId',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { guildId, groupId } = req.params as Record<string, string>;
      await requireMember(guildId, req.userId!);

      if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
        throw new AppError(403, 'Missing MANAGE_GUILD permission', 'FORBIDDEN');
      }

      await db
        .delete(guildMemberGroups)
        .where(and(eq(guildMemberGroups.id, groupId), eq(guildMemberGroups.guildId, guildId)));

      console.info(JSON.stringify({
        event: 'member_group_deleted',
        guildId,
        groupId,
        actorId: req.userId!,
      }));
      res.status(204).send();
    } catch (err) {
      handleAppError(res, err);
    }
  },
);

guildsRouter.put(
  '/:guildId/member-groups/:groupId/members/:userId',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { guildId, groupId, userId } = req.params as Record<string, string>;
      await requireMember(guildId, req.userId!);
      await requireMember(guildId, userId);

      if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
        throw new AppError(403, 'Missing MANAGE_GUILD permission', 'FORBIDDEN');
      }

      const [group] = await db
        .select({ id: guildMemberGroups.id })
        .from(guildMemberGroups)
        .where(and(eq(guildMemberGroups.id, groupId), eq(guildMemberGroups.guildId, guildId)))
        .limit(1);

      if (!group) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Member group not found' });
        return;
      }

      await db
        .insert(guildMemberGroupMembers)
        .values({ guildId, groupId, userId })
        .onConflictDoNothing();

      console.info(JSON.stringify({
        event: 'member_group_member_added',
        guildId,
        groupId,
        userId,
        actorId: req.userId!,
      }));
      res.status(204).send();
    } catch (err) {
      handleAppError(res, err);
    }
  },
);

guildsRouter.delete(
  '/:guildId/member-groups/:groupId/members/:userId',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { guildId, groupId, userId } = req.params as Record<string, string>;
      await requireMember(guildId, req.userId!);

      if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
        throw new AppError(403, 'Missing MANAGE_GUILD permission', 'FORBIDDEN');
      }

      await db
        .delete(guildMemberGroupMembers)
        .where(
          and(
            eq(guildMemberGroupMembers.guildId, guildId),
            eq(guildMemberGroupMembers.groupId, groupId),
            eq(guildMemberGroupMembers.userId, userId),
          ),
        );

      console.info(JSON.stringify({
        event: 'member_group_member_removed',
        guildId,
        groupId,
        userId,
        actorId: req.userId!,
      }));
      res.status(204).send();
    } catch (err) {
      handleAppError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /:guildId/members
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/guilds/:guildId/members
 *
 * Return a paginated list of guild members. The calling user must be a member.
 * Each entry includes basic user info joined from the `users` table.
 *
 * @auth    requireAuth, requireMember
 * @param   guildId {string} — Guild UUID
 * @query   limit? {number}  — Max results (default 50, max 100)
 * @returns 200 Array of { id, userId, username, displayName, avatarHash,
 *                          nickname, joinedAt }
 * @returns 403 Not a member
 * @returns 404 Guild not found
 */
guildsRouter.get(
  '/:guildId/members',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { guildId } = req.params as Record<string, string>;
      const members = await guildService.getMembers(guildId, req.userId!, {
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        groupId: typeof req.query.groupId === 'string' ? req.query.groupId : undefined,
        limit: Number(req.query.limit) || 50,
        offset: Number(req.query.offset) || 0,
      });
      res.status(200).json(members);
    } catch (err) {
      handleAppError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /:guildId/members/:userId/profile
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/guilds/:guildId/members/:userId/profile
 *
 * Returns the guild-scoped profile for a member.
 * Supports `@me` as `userId`.
 */
guildsRouter.get(
  '/:guildId/members/:userId/profile',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { guildId, userId } = req.params as Record<string, string>;
      await requireMember(guildId, req.userId!);

      const targetUserId = userId === '@me' ? req.userId! : userId;
      const [member] = await db
        .select({
          guildId: guildMembers.guildId,
          userId: guildMembers.userId,
          nickname: guildMembers.nickname,
          username: users.username,
          displayName: users.displayName,
          avatarHash: users.avatarHash,
          bannerHash: users.bannerHash,
          joinedAt: guildMembers.joinedAt,
          serverDisplayName: guildMemberProfiles.displayName,
          serverAvatarUrl: guildMemberProfiles.avatarUrl,
          serverBio: guildMemberProfiles.bio,
        })
        .from(guildMembers)
        .innerJoin(users, eq(users.id, guildMembers.userId))
        .leftJoin(
          guildMemberProfiles,
          and(
            eq(guildMemberProfiles.userId, guildMembers.userId),
            eq(guildMemberProfiles.guildId, guildMembers.guildId),
          ),
        )
        .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, targetUserId)))
        .limit(1);

      if (!member) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Member profile not found' });
        return;
      }

      res.status(200).json({
        guildId: member.guildId,
        userId: member.userId,
        username: member.username,
        displayName: member.serverDisplayName ?? member.displayName,
        nickname: member.nickname ?? null,
        bio: member.serverBio ?? null,
        avatarHash: member.avatarHash ?? null,
        serverAvatarUrl: member.serverAvatarUrl ?? null,
        bannerHash: member.bannerHash ?? null,
        updatedAt: member.joinedAt,
        serverProfile: member.serverDisplayName || member.serverAvatarUrl || member.serverBio
          ? { displayName: member.serverDisplayName, avatarUrl: member.serverAvatarUrl, bio: member.serverBio }
          : null,
      });
    } catch (err) {
      handleAppError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /:guildId/members/@me/profile
// ---------------------------------------------------------------------------

/**
 * PATCH /api/v1/guilds/:guildId/members/@me/profile
 *
 * Update the caller's guild-scoped profile fields.
 * Persisted fields:
 *   - nickname (stored on `guild_members.nickname`)
 *   - bio (stored on `guild_member_profiles.bio`)
 */
guildsRouter.patch(
  '/:guildId/members/@me/profile',
  requireAuth,
  validate(updateMemberProfileSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { guildId } = req.params as Record<string, string>;
      await requireMember(guildId, req.userId!);

      const { nickname, bio } = req.body as z.infer<typeof updateMemberProfileSchema>;
      if (nickname !== undefined) {
        const normalizedNickname = nickname === null ? null : nickname.trim() || null;
        await db
          .update(guildMembers)
          .set({ nickname: normalizedNickname })
          .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, req.userId!)));
      }

      // Persist bio to guild_member_profiles (upsert)
      if (bio !== undefined) {
        const [existing] = await db
          .select({ id: guildMemberProfiles.id })
          .from(guildMemberProfiles)
          .where(and(eq(guildMemberProfiles.guildId, guildId), eq(guildMemberProfiles.userId, req.userId!)))
          .limit(1);

        if (existing) {
          await db
            .update(guildMemberProfiles)
            .set({ bio: bio, updatedAt: new Date() })
            .where(eq(guildMemberProfiles.id, existing.id));
        } else {
          await db
            .insert(guildMemberProfiles)
            .values({ userId: req.userId!, guildId, bio: bio });
        }
      }

      const [member] = await db
        .select({
          guildId: guildMembers.guildId,
          userId: guildMembers.userId,
          nickname: guildMembers.nickname,
          username: users.username,
          displayName: users.displayName,
          avatarHash: users.avatarHash,
          bannerHash: users.bannerHash,
          joinedAt: guildMembers.joinedAt,
          serverBio: guildMemberProfiles.bio,
          serverDisplayName: guildMemberProfiles.displayName,
          serverAvatarUrl: guildMemberProfiles.avatarUrl,
        })
        .from(guildMembers)
        .innerJoin(users, eq(users.id, guildMembers.userId))
        .leftJoin(
          guildMemberProfiles,
          and(
            eq(guildMemberProfiles.userId, guildMembers.userId),
            eq(guildMemberProfiles.guildId, guildMembers.guildId),
          ),
        )
        .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, req.userId!)))
        .limit(1);

      if (!member) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Member profile not found' });
        return;
      }

      res.status(200).json({
        guildId: member.guildId,
        userId: member.userId,
        username: member.username,
        displayName: member.serverDisplayName ?? member.displayName,
        nickname: member.nickname ?? null,
        bio: member.serverBio ?? null,
        avatarHash: member.avatarHash ?? null,
        serverAvatarUrl: member.serverAvatarUrl ?? null,
        bannerHash: member.bannerHash ?? null,
        updatedAt: member.joinedAt,
      });
    } catch (err) {
      handleAppError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /:guildId/members/:userId
// ---------------------------------------------------------------------------

/**
 * DELETE /api/v1/guilds/:guildId/members/:userId
 *
 * Kick (remove) a member from the guild. Only the guild owner may kick
 * members. The owner cannot kick themselves.
 *
 * @auth    requireAuth, requireOwner
 * @param   guildId {string} — Guild UUID
 * @param   userId  {string} — UUID of the member to kick
 * @returns 200 { message: 'Member removed' }
 * @returns 400 Cannot kick yourself
 * @returns 403 Not the owner
 * @returns 404 Guild not found or member not in guild
 *
 * Side effects:
 *   - Deletes `guild_members` row for (guildId, userId).
 *   - Decrements `guilds.memberCount`.
 */
// Leave server (current user leaves voluntarily)
guildsRouter.delete(
  '/:guildId/members/@me',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const guildId = req.params.guildId as string;
      await guildService.leaveGuild(req.userId!, guildId);
      res.status(200).json({ code: 'OK' });
    } catch (err) {
      handleAppError(res, err);
    }
  },
);

// Kick member (requires KICK_MEMBERS permission)
guildsRouter.delete(
  '/:guildId/members/:userId',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { guildId, userId: targetUserId } = req.params as Record<string, string>;
      await guildService.kickMember(guildId, req.userId!, targetUserId);
      res.status(200).json({ code: 'OK', message: 'Member removed' });
    } catch (err) {
      handleAppError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /:guildId/transfer-ownership
// ---------------------------------------------------------------------------

const transferOwnershipSchema = z.object({
  newOwnerId: z.string().uuid(),
});

guildsRouter.post(
  '/:guildId/transfer-ownership',
  requireAuth,
  validate(transferOwnershipSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { guildId } = req.params as Record<string, string>;
      const { newOwnerId } = req.body as z.infer<typeof transferOwnershipSchema>;
      const updated = await guildService.transferOwnership(guildId, req.userId!, newOwnerId);
      res.status(200).json(updated);
    } catch (err) {
      handleAppError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /:guildId/members/:userId/timeout
// ---------------------------------------------------------------------------

guildsRouter.post(
  '/:guildId/members/:userId/timeout',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { guildId, userId: targetUserId } = req.params as Record<string, string>;
      await requireMember(guildId, req.userId!);

      // Accept MODERATE_MEMBERS or KICK_MEMBERS (backwards compat for existing roles)
      const canModerate = await hasPermission(req.userId!, guildId, Permissions.MODERATE_MEMBERS);
      const canKick = await hasPermission(req.userId!, guildId, Permissions.KICK_MEMBERS);
      if (!canModerate && !canKick) {
        throw new AppError(403, 'Missing MODERATE_MEMBERS permission', 'FORBIDDEN');
      }

      // Cannot timeout yourself
      if (targetUserId === req.userId) {
        res.status(400).json({ code: 'VALIDATION_ERROR', message: 'You cannot timeout yourself' });
        return;
      }

      // Validate durationSeconds
      const durationSeconds = Number(req.body.durationSeconds);
      if (!Number.isFinite(durationSeconds) || durationSeconds < 0 || durationSeconds > 2419200) {
        res.status(400).json({ error: 'durationSeconds must be a number between 0 and 2419200 (28 days)' });
        return;
      }

      // Cannot timeout the guild owner
      const [guild] = await db.select({ ownerId: guilds.ownerId }).from(guilds).where(eq(guilds.id, guildId)).limit(1);
      if (!guild) {
        res.status(404).json({ error: 'Guild not found' });
        return;
      }
      if (targetUserId === guild.ownerId) {
        res.status(400).json({ error: 'Cannot timeout the guild owner' });
        return;
      }

      const timeoutUntil = durationSeconds > 0
        ? new Date(Date.now() + durationSeconds * 1000)
        : null;

      await db.update(guildMembers)
        .set({ timeoutUntil })
        .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, targetUserId)));

      getIO().to(`guild:${guildId}`).emit('MEMBER_UPDATE', {
        guildId,
        userId: targetUserId,
        timeoutUntil: timeoutUntil?.toISOString() ?? null,
      });

      res.json({ success: true, timeoutUntil: timeoutUntil?.toISOString() ?? null });
    } catch (err) {
      handleAppError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /:guildId/audit-log
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/guilds/:guildId/audit-log
 *
 * Return paginated audit log entries for a guild. Requires MANAGE_GUILD
 * permission or guild owner. Supports filtering by action type, user, and
 * cursor-based pagination via `before`.
 *
 * @auth    requireAuth, MANAGE_GUILD or owner
 * @param   guildId {string}        — Guild UUID
 * @query   action? {string}        — Filter by action type
 * @query   userId? {string}        — Filter by acting user
 * @query   before? {string}        — Cursor: return entries before this ID
 * @query   limit?  {number}        — Max results (default 50, max 100)
 * @returns 200 { items: AuditLogEntry[] }
 */
guildsRouter.get(
  '/:guildId/audit-log',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { guildId } = req.params as Record<string, string>;
      await requireMember(guildId, req.userId!);

      if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
        throw new AppError(403, 'Missing MANAGE_GUILD permission', 'FORBIDDEN');
      }

      const limitParam = Number(req.query.limit) || 50;
      const limit = Math.min(limitParam, 100);
      const actionFilter = typeof req.query.action === 'string' ? req.query.action : undefined;
      const userIdFilter = typeof req.query.userId === 'string' ? req.query.userId : undefined;

      // Build conditions
      const conditions = [eq(auditLog.guildId, guildId)];
      if (actionFilter) conditions.push(eq(auditLog.action, actionFilter));
      if (userIdFilter) conditions.push(eq(auditLog.userId, userIdFilter));

      const rows = await db
        .select({
          id: auditLog.id,
          guildId: auditLog.guildId,
          userId: auditLog.userId,
          action: auditLog.action,
          targetId: auditLog.targetId,
          targetType: auditLog.targetType,
          changes: auditLog.changes,
          reason: auditLog.reason,
          createdAt: auditLog.createdAt,
          userName: users.username,
          userDisplayName: users.displayName,
          userAvatarHash: users.avatarHash,
        })
        .from(auditLog)
        .leftJoin(users, eq(users.id, auditLog.userId))
        .where(and(...conditions))
        .orderBy(desc(auditLog.createdAt))
        .limit(limit);

      res.status(200).json({ items: rows });
    } catch (err) {
      handleAppError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /:guildId/channels/unread  (Unread badges)
// ---------------------------------------------------------------------------

guildsRouter.get(
  '/:guildId/channels/unread',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { guildId } = req.params as Record<string, string>;
      await requireMember(guildId, req.userId!);

      const rows = await db
        .select({
          channelId: channelReadState.channelId,
          mentionCount: channelReadState.mentionCount,
          lastReadAt: channelReadState.lastReadAt,
        })
        .from(channelReadState)
        .innerJoin(channels, eq(channels.id, channelReadState.channelId))
        .where(
          and(
            eq(channels.guildId, guildId),
            eq(channelReadState.userId, req.userId!),
          ),
        );

      res.status(200).json(rows);
    } catch (err) {
      handleAppError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /:guildId/vanity-url
// ---------------------------------------------------------------------------

guildsRouter.get(
  '/:guildId/vanity-url',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { guildId } = req.params as Record<string, string>;
      await requireMember(guildId, req.userId!);

      const [guild] = await db
        .select({ vanityCode: guilds.vanityCode })
        .from(guilds)
        .where(eq(guilds.id, guildId))
        .limit(1);

      if (!guild) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Guild not found' }); return;
      }

      res.json({ code: guild.vanityCode });
    } catch (err) {
      handleAppError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /:guildId/vanity-url
// ---------------------------------------------------------------------------

const vanityUrlSchema = z.object({
  code: z.string().min(2).max(32).regex(/^[a-zA-Z0-9-]+$/),
});

guildsRouter.patch(
  '/:guildId/vanity-url',
  requireAuth,
  validate(vanityUrlSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { guildId } = req.params as Record<string, string>;
      await requireOwner(guildId, req.userId!);

      const { code } = req.body as z.infer<typeof vanityUrlSchema>;

      // Check uniqueness
      const [existing] = await db
        .select({ id: guilds.id })
        .from(guilds)
        .where(and(eq(guilds.vanityCode, code), sql`${guilds.id} != ${guildId}`))
        .limit(1);

      if (existing) {
        res.status(409).json({ code: 'CONFLICT', message: 'Vanity code is already taken' }); return;
      }

      await db.update(guilds).set({ vanityCode: code, updatedAt: new Date() }).where(eq(guilds.id, guildId));

      res.json({ code });
    } catch (err) {
      handleAppError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /:guildId/boost — Boost a server
// ---------------------------------------------------------------------------

guildsRouter.post(
  '/:guildId/boost',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { guildId } = req.params as Record<string, string>;
      await requireMember(guildId, req.userId!);

      await db.insert(serverBoosts).values({
        guildId,
        userId: req.userId!,
      });

      // Atomically increment boost_count and recalculate tier
      const [updated] = await db.update(guilds).set({
        boostCount: sql`boost_count + 1`,
        boostTier: sql`CASE WHEN boost_count + 1 >= 14 THEN 3 WHEN boost_count + 1 >= 7 THEN 2 WHEN boost_count + 1 >= 2 THEN 1 ELSE 0 END`,
        updatedAt: new Date(),
      }).where(eq(guilds.id, guildId)).returning({ boostCount: guilds.boostCount, boostTier: guilds.boostTier });

      const newCount = updated?.boostCount ?? 0;
      const newTier = updated?.boostTier ?? 0;

      try {
        getIO().to(`guild:${guildId}`).emit('GUILD_UPDATE', { guildId, boostCount: newCount, boostTier: newTier });
      } catch (err) { logger.debug({ msg: 'socket emit failed', event: 'GUILD_UPDATE boost', err }); }

      res.status(201).json({ boostCount: newCount, boostTier: newTier });
    } catch (err) {
      handleAppError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /:guildId/boost — Remove boost
// ---------------------------------------------------------------------------

guildsRouter.delete(
  '/:guildId/boost',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { guildId } = req.params as Record<string, string>;

      // Find and delete user's active boost
      const [boost] = await db.select({ id: serverBoosts.id }).from(serverBoosts)
        .where(and(eq(serverBoosts.guildId, guildId), eq(serverBoosts.userId, req.userId!), eq(serverBoosts.active, true)))
        .limit(1);

      if (!boost) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'No active boost found' }); return;
      }

      await db.update(serverBoosts).set({ active: false }).where(eq(serverBoosts.id, boost.id));

      // Atomically decrement boost_count and recalculate tier
      const [updated] = await db.update(guilds).set({
        boostCount: sql`GREATEST(boost_count - 1, 0)`,
        boostTier: sql`CASE WHEN GREATEST(boost_count - 1, 0) >= 14 THEN 3 WHEN GREATEST(boost_count - 1, 0) >= 7 THEN 2 WHEN GREATEST(boost_count - 1, 0) >= 2 THEN 1 ELSE 0 END`,
        updatedAt: new Date(),
      }).where(eq(guilds.id, guildId)).returning({ boostCount: guilds.boostCount, boostTier: guilds.boostTier });

      const newCount = updated?.boostCount ?? 0;
      const newTier = updated?.boostTier ?? 0;

      try {
        getIO().to(`guild:${guildId}`).emit('GUILD_UPDATE', { guildId, boostCount: newCount, boostTier: newTier });
      } catch (err) { logger.debug({ msg: 'socket emit failed', event: 'GUILD_UPDATE boost', err }); }

      res.json({ boostCount: newCount, boostTier: newTier });
    } catch (err) {
      handleAppError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /:guildId/agree-rules
// ---------------------------------------------------------------------------

guildsRouter.post('/:guildId/agree-rules', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params as Record<string, string>;
    await requireMember(guildId, req.userId!);
    await db.update(guildMembers)
      .set({ agreedRulesAt: new Date() })
      .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, req.userId!)));
    res.json({ ok: true });
  } catch (err) {
    handleAppError(res, err);
  }
});

// ---------------------------------------------------------------------------
// GET /:guildId/insights — Server analytics
// ---------------------------------------------------------------------------

guildsRouter.get('/:guildId/insights', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params as Record<string, string>;
    await requireMember(guildId, req.userId!);
    if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
      res.status(403).json({ code: 'FORBIDDEN' }); return;
    }

    const range = Math.min(Math.max(parseInt(req.query.range as string) || 7, 7), 30);

    const [memberCount] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(guildMembers).where(eq(guildMembers.guildId, guildId));
    const [newMembers] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(guildMembers).where(and(eq(guildMembers.guildId, guildId), gt(guildMembers.joinedAt, sql`now() - interval '7 days'`)));

    const guildChannels = await db.select({ id: channels.id, name: channels.name }).from(channels).where(eq(channels.guildId, guildId));
    const channelIds = guildChannels.map(c => c.id);

    let messages7d = 0;
    let topChannels: Array<{ channelId: string; name: string; messages: number }> = [];
    let hourlyMessages: number[] = new Array(24).fill(0);
    let dailyMessages: number[] = [];
    let dailyJoins: number[] = [];
    let dailyLeaves: number[] = new Array(range).fill(0);
    let activeUsers24h = 0;
    let dateLabels: string[] = [];

    // Build date labels
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dateLabels.push(dayNames[d.getDay()]);
    }

    if (channelIds.length > 0) {
      const [msgCount] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(messages).where(and(inArray(messages.channelId, channelIds), gt(messages.createdAt, sql`now() - interval '7 days'`)));
      messages7d = msgCount?.count ?? 0;

      const channelActivity = await db.select({ channelId: messages.channelId, count: sql<number>`count(*)`.mapWith(Number) })
        .from(messages).where(and(inArray(messages.channelId, channelIds), gt(messages.createdAt, sql`now() - interval '7 days'`)))
        .groupBy(messages.channelId).orderBy(desc(sql`count(*)`)).limit(5);
      topChannels = channelActivity.map(r => ({ channelId: r.channelId, name: guildChannels.find(c => c.id === r.channelId)?.name ?? 'unknown', messages: r.count }));

      // Hourly messages (today)
      const hourlyResult = await db.execute(sql`SELECT EXTRACT(HOUR FROM created_at)::int as hour, COUNT(*)::int as count FROM messages WHERE channel_id = ANY(${channelIds}) AND created_at > now() - interval '1 day' GROUP BY hour`);
      const hourlyRows = toRows<{ hour: number; count: number }>(hourlyResult);
      for (const row of hourlyRows) {
        hourlyMessages[row.hour] = row.count;
      }

      // Daily messages
      const dailyMsgResult = await db.execute(sql`SELECT DATE(created_at) as day, COUNT(*)::int as count FROM messages WHERE channel_id = ANY(${channelIds}) AND created_at > now() - ${range}::int * interval '1 day' GROUP BY day ORDER BY day`);
      const dailyMsgRows = toRows<{ day: string | Date; count: number }>(dailyMsgResult);
      const dailyMsgMap = new Map<string, number>();
      for (const row of dailyMsgRows) {
        const key = typeof row.day === 'string' ? row.day.slice(0, 10) : new Date(row.day).toISOString().slice(0, 10);
        dailyMsgMap.set(key, row.count);
      }
      for (let i = range - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        dailyMessages.push(dailyMsgMap.get(key) ?? 0);
      }

      // Active users 24h
      const activeResult = await db.execute(sql`SELECT COUNT(DISTINCT author_id)::int as count FROM messages WHERE channel_id = ANY(${channelIds}) AND created_at > now() - interval '1 day'`);
      const activeRows = toRows<{ count: number }>(activeResult);
      activeUsers24h = activeRows[0]?.count ?? 0;
    } else {
      dailyMessages = new Array(range).fill(0);
    }

    // Daily joins
    const joinResult = await db.execute(sql`SELECT DATE(joined_at) as day, COUNT(*)::int as count FROM guild_members WHERE guild_id = ${guildId} AND joined_at > now() - ${range}::int * interval '1 day' GROUP BY day ORDER BY day`);
    const joinRows = toRows<{ day: string | Date; count: number }>(joinResult);
    const joinMap = new Map<string, number>();
    for (const row of joinRows) {
      const key = typeof row.day === 'string' ? row.day.slice(0, 10) : new Date(row.day).toISOString().slice(0, 10);
      joinMap.set(key, row.count);
    }
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dailyJoins.push(joinMap.get(key) ?? 0);
    }

    res.json({
      memberCount: memberCount?.count ?? 0,
      memberGrowth7d: newMembers?.count ?? 0,
      messages7d,
      topChannels,
      hourlyMessages,
      dailyMessages,
      dailyJoins,
      dailyLeaves,
      activeUsers24h,
      dateLabels,
    });
  } catch (err) {
    handleAppError(res, err);
  }
});

// ---------------------------------------------------------------------------
// POST /:guildId/members/bulk-kick — Batch kick members
// ---------------------------------------------------------------------------

guildsRouter.post('/:guildId/members/bulk-kick', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params as Record<string, string>;
    const { userIds, reason } = req.body as { userIds: string[]; reason?: string };

    if (!Array.isArray(userIds) || userIds.length === 0 || userIds.length > 100) {
      res.status(400).json({ code: 'INVALID_INPUT', message: 'userIds must be 1-100 user IDs' });
      return;
    }

    if (!(await hasPermission(req.userId!, guildId, Permissions.KICK_MEMBERS))) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Missing KICK_MEMBERS permission' });
      return;
    }

    const results = { processed: 0, failed: [] as string[] };
    for (const userId of userIds) {
      if (userId === req.userId) { results.failed.push(userId); continue; }
      try {
        await db.delete(guildMembers).where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, userId)));
        await db.update(guilds).set({ memberCount: sql`GREATEST(${guilds.memberCount} - 1, 0)`, updatedAt: new Date() }).where(eq(guilds.id, guildId));
        getIO().to(`guild:${guildId}`).emit('MEMBER_REMOVE', { guildId, userId });
        results.processed++;
      } catch (err) {
        logger.debug({ msg: 'bulk kick failed for user', userId, err });
        results.failed.push(userId);
      }
    }
    logAuditEvent(guildId, req.userId!, AuditActionTypes.MEMBER_KICK, guildId, 'GUILD', { bulk: true, count: results.processed, reason });
    res.json(results);
  } catch (err) {
    handleAppError(res, err);
  }
});

// ---------------------------------------------------------------------------
// POST /:guildId/members/bulk-ban — Batch ban members
// ---------------------------------------------------------------------------

guildsRouter.post('/:guildId/members/bulk-ban', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params as Record<string, string>;
    const { userIds, reason } = req.body as { userIds: string[]; reason?: string };

    if (!Array.isArray(userIds) || userIds.length === 0 || userIds.length > 100) {
      res.status(400).json({ code: 'INVALID_INPUT', message: 'userIds must be 1-100 user IDs' });
      return;
    }

    if (!(await hasPermission(req.userId!, guildId, Permissions.BAN_MEMBERS))) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Missing BAN_MEMBERS permission' });
      return;
    }

    const results = { processed: 0, failed: [] as string[] };
    for (const userId of userIds) {
      if (userId === req.userId) { results.failed.push(userId); continue; }
      try {
        await db.insert(guildBans).values({ guildId, userId, reason: reason ?? null, bannedBy: req.userId! }).onConflictDoNothing();
        await db.delete(guildMembers).where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, userId)));
        await db.update(guilds).set({ memberCount: sql`GREATEST(${guilds.memberCount} - 1, 0)`, updatedAt: new Date() }).where(eq(guilds.id, guildId));
        getIO().to(`guild:${guildId}`).emit('MEMBER_REMOVE', { guildId, userId });
        results.processed++;
      } catch (err) {
        logger.debug({ msg: 'bulk ban failed for user', userId, err });
        results.failed.push(userId);
      }
    }
    logAuditEvent(guildId, req.userId!, AuditActionTypes.MEMBER_BAN, guildId, 'GUILD', { bulk: true, count: results.processed, reason });
    res.json(results);
  } catch (err) {
    handleAppError(res, err);
  }
});

// ---------------------------------------------------------------------------
// POST /:guildId/members/bulk-role — Batch role assignment
// ---------------------------------------------------------------------------

guildsRouter.post('/:guildId/members/bulk-role', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params as Record<string, string>;
    const { userIds, addRoles, removeRoles } = req.body as { userIds: string[]; addRoles?: string[]; removeRoles?: string[] };

    if (!Array.isArray(userIds) || userIds.length === 0 || userIds.length > 100) {
      res.status(400).json({ code: 'INVALID_INPUT', message: 'userIds must be 1-100 user IDs' });
      return;
    }

    if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_ROLES))) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_ROLES permission' });
      return;
    }

    const results = { processed: 0, failed: [] as string[] };
    for (const userId of userIds) {
      try {
        if (Array.isArray(addRoles)) {
          for (const roleId of addRoles) {
            await db.insert(memberRoles).values({ userId, roleId, guildId }).onConflictDoNothing();
          }
        }
        if (Array.isArray(removeRoles)) {
          for (const roleId of removeRoles) {
            await db.delete(memberRoles).where(and(eq(memberRoles.userId, userId), eq(memberRoles.roleId, roleId), eq(memberRoles.guildId, guildId)));
          }
        }
        results.processed++;
      } catch (err) {
        logger.debug({ msg: 'bulk role update failed for user', userId, err });
        results.failed.push(userId);
      }
    }
    res.json(results);
  } catch (err) {
    handleAppError(res, err);
  }
});

// ---------------------------------------------------------------------------
// POST /:guildId/lock — Guild lockdown (raid protection)
// ---------------------------------------------------------------------------

guildsRouter.post('/:guildId/lock', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params as Record<string, string>;
    await requireMember(guildId, req.userId!);

    if (!(await hasPermission(req.userId!, guildId, Permissions.ADMINISTRATOR))) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Missing ADMINISTRATOR permission' });
      return;
    }

    await db.execute(sql`UPDATE guilds SET locked_at = now() WHERE id = ${guildId}`);
    getIO().to(`guild:${guildId}`).emit('GUILD_LOCKDOWN_START', { guildId });
    res.status(200).json({ code: 'OK', message: 'Guild locked' });
  } catch (err) {
    handleAppError(res, err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /:guildId/lock — Remove guild lockdown
// ---------------------------------------------------------------------------

guildsRouter.delete('/:guildId/lock', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params as Record<string, string>;
    await requireMember(guildId, req.userId!);

    if (!(await hasPermission(req.userId!, guildId, Permissions.ADMINISTRATOR))) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Missing ADMINISTRATOR permission' });
      return;
    }

    await db.execute(sql`UPDATE guilds SET locked_at = NULL WHERE id = ${guildId}`);
    getIO().to(`guild:${guildId}`).emit('GUILD_LOCKDOWN_END', { guildId });
    res.status(200).json({ code: 'OK', message: 'Guild unlocked' });
  } catch (err) {
    handleAppError(res, err);
  }
});

// Discovery Tags — PATCH /:guildId/tags is safe here since it's a PATCH, not GET
guildsRouter.patch('/:guildId/tags', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params as Record<string, string>;
    if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
      res.status(403).json({ code: 'FORBIDDEN' }); return;
    }
    const { tags } = req.body as { tags?: unknown };
    if (!Array.isArray(tags) || tags.length > 5) {
      res.status(400).json({ error: 'tags must be an array of max 5' }); return;
    }
    const validatedTags = (tags as unknown[]).map(t => String(t).trim()).filter(t => t.length > 0 && t.length <= 32);
    await db.delete(guildTags).where(eq(guildTags.guildId, guildId));
    if (validatedTags.length > 0) {
      await db.insert(guildTags).values(validatedTags.map(tag => ({ guildId, tag })));
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[guilds] PATCH /:guildId/tags error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// Guild Ratings
// ---------------------------------------------------------------------------

/** POST /:guildId/rating — Upsert a guild rating (1–5). */
guildsRouter.post('/:guildId/rating', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params as Record<string, string>;
    const userId = req.userId!;
    await requireMember(guildId, userId);

    const { rating } = req.body as { rating?: unknown };
    if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      res.status(400).json({ code: 'BAD_REQUEST', message: 'rating must be an integer between 1 and 5' });
      return;
    }

    await db
      .insert(guildRatings)
      .values({ guildId, userId, rating })
      .onConflictDoUpdate({
        target: [guildRatings.guildId, guildRatings.userId],
        set: { rating, updatedAt: new Date() },
      });

    res.json({ ok: true });
  } catch (err) {
    handleAppError(res, err);
  }
});

/** GET /:guildId/rating — Get average rating + user's own rating (no membership required). */
guildsRouter.get('/:guildId/rating', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params as Record<string, string>;
    const userId = req.userId!;

    const [stats] = await db
      .select({
        averageRating: sql<number>`coalesce(avg(${guildRatings.rating}), 0)`.mapWith(Number),
        totalRatings: sql<number>`count(*)::int`.mapWith(Number),
      })
      .from(guildRatings)
      .where(eq(guildRatings.guildId, guildId));

    const [userRow] = await db
      .select({ rating: guildRatings.rating })
      .from(guildRatings)
      .where(and(eq(guildRatings.guildId, guildId), eq(guildRatings.userId, userId)));

    res.json({
      averageRating: Math.round((stats?.averageRating ?? 0) * 100) / 100,
      totalRatings: stats?.totalRatings ?? 0,
      userRating: userRow?.rating ?? null,
    });
  } catch (err) {
    handleAppError(res, err);
  }
});

// ---------------------------------------------------------------------------
// POST /:guildId/import — Import channels/roles from Discord or Slack export
// ---------------------------------------------------------------------------
const importSchema = z.object({
  source: z.enum(['discord', 'slack']).default('discord'),
  channels: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.number().or(z.string()),
    parent_id: z.string().nullable().optional(),
    topic: z.string().nullable().optional(),
    position: z.number().optional(),
    nsfw: z.boolean().optional(),
  })).optional(),
  roles: z.array(z.object({
    id: z.string(),
    name: z.string(),
    color: z.number().optional(),
    position: z.number().optional(),
    hoist: z.boolean().optional(),
    mentionable: z.boolean().optional(),
  })).optional(),
});

guildsRouter.post('/:guildId/import', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;
  const userId = req.userId!;
  try {
    await requireOwner(guildId, userId);
    const body = importSchema.parse(req.body);
    const source = body.source;

    const created: { categories: number; channels: number; roles: number } = { categories: 0, channels: 0, roles: 0 };

    // Discord channel type mapping: 0=text, 2=voice, 4=category, 13=stage, 15=forum
    const discordTypeMap: Record<number, string> = {
      0: 'GUILD_TEXT', 2: 'GUILD_VOICE', 4: 'GUILD_CATEGORY', 5: 'GUILD_TEXT',
      13: 'GUILD_STAGE', 15: 'GUILD_TEXT',
    };

    // Slack has no categories — all channels are text
    function mapChannelType(raw: number | string, src: string): string {
      if (src === 'slack') return 'GUILD_TEXT';
      const num = typeof raw === 'number' ? raw : parseInt(raw, 10);
      return discordTypeMap[num] || 'GUILD_TEXT';
    }

    // Map old IDs to new UUIDs (for parent references)
    const idMap = new Map<string, string>();

    if (body.channels && body.channels.length > 0) {
      // Sanitize channel names: lowercase, replace spaces with hyphens, strip invalid chars
      const sanitize = (name: string) => name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 100) || 'imported';

      // Sort: categories first (position-ordered), then channels
      const sorted = [...body.channels].sort((a, b) => {
        const aIsCat = mapChannelType(a.type, source) === 'GUILD_CATEGORY';
        const bIsCat = mapChannelType(b.type, source) === 'GUILD_CATEGORY';
        if (aIsCat && !bIsCat) return -1;
        if (!aIsCat && bIsCat) return 1;
        return (a.position ?? 0) - (b.position ?? 0);
      });

      for (const ch of sorted) {
        const chType = mapChannelType(ch.type, source);
        const parentId = ch.parent_id ? idMap.get(ch.parent_id) ?? null : null;
        const [inserted] = await db.insert(channels).values({
          guildId,
          name: sanitize(ch.name),
          type: chType,
          parentId,
          topic: ch.topic ?? null,
          position: ch.position ?? 0,
          isNsfw: ch.nsfw ?? false,
        }).returning({ id: channels.id });
        idMap.set(ch.id, inserted.id);
        if (chType === 'GUILD_CATEGORY') created.categories++;
        else created.channels++;
      }
    }

    if (body.roles && body.roles.length > 0) {
      for (const r of body.roles) {
        // Skip @everyone role (Discord id === guild id, or name === @everyone)
        if (r.name === '@everyone') continue;
        const color = r.color && r.color > 0 ? `#${r.color.toString(16).padStart(6, '0')}` : null;
        await db.insert(roles).values({
          guildId,
          name: r.name.slice(0, 100),
          color,
          position: r.position ?? 0,
          hoist: r.hoist ?? false,
          mentionable: r.mentionable ?? false,
        });
        created.roles++;
      }
    }

    await logAuditEvent(
      guildId,
      userId,
      AuditActionTypes.GUILD_UPDATE,
      guildId,
      AuditTargetTypes.GUILD,
      { import: { source, ...created } },
    );

    res.json({ success: true, created });
  } catch (err) {
    handleAppError(res, err);
  }
});

// ---------------------------------------------------------------------------
// Member Roles (moved from roles.ts so they mount at /guilds/:guildId/members/:userId/roles)
// ---------------------------------------------------------------------------

/** GET /api/v1/guilds/:guildId/members/:userId/roles — list a member's roles */
guildsRouter.get('/:guildId/members/:userId/roles', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId, userId } = req.params as Record<string, string>;
  try {
    const [requester] = await db.select({ id: guildMembers.id }).from(guildMembers)
      .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, req.userId!))).limit(1);
    if (!requester) { res.status(403).json({ code: 'FORBIDDEN', message: 'Not a guild member' }); return; }

    const userRoles = await db
      .select({
        id: roles.id, name: roles.name, color: roles.color,
        position: roles.position, permissions: roles.permissions,
        hoist: roles.hoist, mentionable: roles.mentionable,
      })
      .from(memberRoles).innerJoin(roles, eq(roles.id, memberRoles.roleId))
      .where(and(eq(memberRoles.userId, userId), eq(memberRoles.guildId, guildId)))
      .orderBy(asc(roles.position));

    res.json(userRoles.map(r => ({ ...r, permissions: String(r.permissions) })));
  } catch (err) {
    logger.error({ msg: 'GET member roles error', err });
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

/** PUT /api/v1/guilds/:guildId/members/:userId/roles/:roleId */
guildsRouter.put('/:guildId/members/:userId/roles/:roleId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId, userId, roleId } = req.params as Record<string, string>;
  try {
    if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_ROLES))) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_ROLES permission' }); return;
    }
    const [role] = await db.select({ id: roles.id }).from(roles).where(and(eq(roles.id, roleId), eq(roles.guildId, guildId))).limit(1);
    if (!role) { res.status(404).json({ code: 'NOT_FOUND', message: 'Role not found' }); return; }
    const [member] = await db.select({ id: guildMembers.id }).from(guildMembers).where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, userId))).limit(1);
    if (!member) { res.status(404).json({ code: 'NOT_FOUND', message: 'Member not found' }); return; }
    await db.insert(memberRoles).values({ userId, roleId, guildId }).onConflictDoNothing();
    try {
      getIO().to(`guild:${guildId}`).emit('GUILD_MEMBER_ROLE_ADD', { userId, roleId, guildId });
    } catch (err) { logger.debug({ msg: 'socket emit failed', event: 'GUILD_MEMBER_ROLE_ADD', err }); }
    res.json({ code: 'OK' });
  } catch (err) {
    logger.error({ msg: 'PUT member role error', err });
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

/** DELETE /api/v1/guilds/:guildId/members/:userId/roles/:roleId */
guildsRouter.delete('/:guildId/members/:userId/roles/:roleId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId, userId, roleId } = req.params as Record<string, string>;
  try {
    if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_ROLES))) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_ROLES permission' }); return;
    }
    await db.delete(memberRoles).where(and(eq(memberRoles.userId, userId), eq(memberRoles.roleId, roleId), eq(memberRoles.guildId, guildId)));
    try {
      getIO().to(`guild:${guildId}`).emit('GUILD_MEMBER_ROLE_REMOVE', { userId, roleId, guildId });
    } catch (err) { logger.debug({ msg: 'socket emit failed', event: 'GUILD_MEMBER_ROLE_REMOVE', err }); }
    res.json({ code: 'OK' });
  } catch (err) {
    logger.error({ msg: 'DELETE member role error', err });
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});
