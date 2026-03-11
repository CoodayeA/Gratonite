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
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { z } from 'zod';
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
import { messages } from '../db/schema/messages';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { hasPermission } from './roles';
import { getIO } from '../lib/socket-io';
import { logAuditEvent, AuditActionTypes } from '../lib/audit';
import { redis } from '../lib/redis';
import { toRows } from '../lib/to-rows.js';

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
  } catch {
    // Non-critical — rotation will be triggered on next membership change
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
  } else {
    console.error('[guilds] unexpected error:', err);
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
    const rows = await db
      .select({
        id: guilds.id,
        name: guilds.name,
        description: guilds.description,
        iconHash: guilds.iconHash,
        bannerHash: guilds.bannerHash,
        ownerId: guilds.ownerId,
        isDiscoverable: guilds.isDiscoverable,
        memberCount: guilds.memberCount,
        createdAt: guilds.createdAt,
        updatedAt: guilds.updatedAt,
      })
      .from(guilds)
      .innerJoin(guildMembers, eq(guildMembers.guildId, guilds.id))
      .where(eq(guildMembers.userId, req.userId!));

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

      // Check for duplicate guild name.
      const existing = await db.select({ id: guilds.id }).from(guilds)
        .where(sql`LOWER(${guilds.name}) = LOWER(${name})`)
        .limit(1);
      if (existing.length > 0) {
        res.status(409).json({ code: 'DUPLICATE_NAME', message: 'A server with this name already exists' });
        return;
      }

      // Insert guild.
      const [guild] = await db
        .insert(guilds)
        .values({
          name,
          description: description ?? null,
          isDiscoverable: isDiscoverable ?? false,
          ownerId: req.userId!,
          memberCount: 1,
        })
        .returning();

      // Add creator as first member.
      await db.insert(guildMembers).values({
        guildId: guild.id,
        userId: req.userId!,
      });

      // Create @everyone role with default permissions.
      await db.insert(roles).values({
        guildId: guild.id,
        name: '@everyone',
        position: 0,
        permissions: DEFAULT_PERMISSIONS,
      });

      // Default channels are created by the client after guild creation.
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

guildsRouter.get('/tags', (_req: Request, res: Response) => {
  res.json(AVAILABLE_TAGS);
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

      const [guild] = await db
        .select({
          id: guilds.id,
          name: guilds.name,
          memberCount: guilds.memberCount,
          isDiscoverable: guilds.isDiscoverable,
        })
        .from(guilds)
        .where(eq(guilds.id, guildId))
        .limit(1);

      if (!guild) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Guild not found' });
        return;
      }

      if (!guild.isDiscoverable) {
        res.status(403).json({
          code: 'INVITE_REQUIRED',
          message: 'This guild is private and requires an invite.',
        });
        return;
      }

      const inserted = await db
        .insert(guildMembers)
        .values({ guildId, userId: req.userId! })
        .onConflictDoNothing()
        .returning({ id: guildMembers.id });

      const joined = inserted.length > 0;
      if (joined) {
        await db
          .update(guilds)
          .set({
            memberCount: sql`${guilds.memberCount} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(guilds.id, guildId));

        // Insert onboarding row (completedAt = null) so the welcome modal can be shown
        await db
          .insert(guildMemberOnboarding)
          .values({ guildId, userId: req.userId!, completedAt: null })
          .onConflictDoNothing();

        // Trigger E2E key rotation for any encrypted channels in this guild
        await emitKeyRotationForEncryptedChannels(guildId, 'member_added');
      }

      const [fresh] = await db
        .select({
          id: guilds.id,
          name: guilds.name,
          memberCount: guilds.memberCount,
        })
        .from(guilds)
        .where(eq(guilds.id, guildId))
        .limit(1);

      res.status(200).json({
        id: fresh?.id ?? guild.id,
        name: fresh?.name ?? guild.name,
        memberCount: fresh?.memberCount ?? guild.memberCount,
        joined,
        alreadyMember: !joined,
      });
    } catch (err) {
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
  } catch {
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
      const requestId = String(req.headers['x-request-id'] ?? req.headers['x-correlation-id'] ?? '');
      const route = '/api/v1/guilds/:guildId';

      const [guild] = await db.select().from(guilds).where(eq(guilds.id, guildId)).limit(1);

      if (!guild) {
        console.info(JSON.stringify({
          event: 'guild_get.not_found',
          guildId,
          userId,
          route,
          requestId: requestId || null,
          status: 404,
        }));
        res.status(404).json({ code: 'NOT_FOUND', message: 'Guild not found' });
        return;
      }

      const [membership] = await db
        .select({ id: guildMembers.id })
        .from(guildMembers)
        .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, userId)))
        .limit(1);

      if (!membership) {
        console.info(JSON.stringify({
          event: 'guild_get.forbidden',
          guildId,
          userId,
          route,
          requestId: requestId || null,
          status: 403,
        }));
        res.status(403).json({ code: 'FORBIDDEN', message: 'You are not a member of this guild' });
        return;
      }

      console.info(JSON.stringify({
        event: 'guild_get.success',
        guildId,
        userId,
        route,
        requestId: requestId || null,
        status: 200,
      }));
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
      await requireMember(guildId, req.userId!);

      if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
        throw new AppError(403, 'Missing MANAGE_GUILD permission', 'FORBIDDEN');
      }

      const { name, description, isDiscoverable, accentColor, welcomeMessage, rulesChannelId, category, tags, rulesText, requireRulesAgreement, raidProtectionEnabled, spotlightChannelId, spotlightMessage } = req.body as z.infer<typeof updateGuildSchema>;

      const updateData: Partial<typeof guilds.$inferInsert> = { updatedAt: new Date() };
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (isDiscoverable !== undefined) updateData.isDiscoverable = isDiscoverable;
      if (accentColor !== undefined) updateData.accentColor = accentColor === null ? null : normalizeHexColor(accentColor);
      if (welcomeMessage !== undefined) updateData.welcomeMessage = welcomeMessage;
      if (rulesChannelId !== undefined) updateData.rulesChannelId = rulesChannelId;
      if (category !== undefined) updateData.category = category === null ? null : category.toLowerCase().slice(0, 30);
      if (rulesText !== undefined) updateData.rulesText = rulesText;
      if (requireRulesAgreement !== undefined) updateData.requireRulesAgreement = requireRulesAgreement;
      if (spotlightChannelId !== undefined) updateData.spotlightChannelId = spotlightChannelId;
      if (spotlightMessage !== undefined) updateData.spotlightMessage = spotlightMessage;

      const [updated] = await db
        .update(guilds)
        .set(updateData)
        .where(eq(guilds.id, guildId))
        .returning();

      // Handle raid protection (column not in schema yet, use raw SQL)
      if (raidProtectionEnabled !== undefined) {
        await db.execute(sql`UPDATE guilds SET raid_protection_enabled = ${raidProtectionEnabled} WHERE id = ${guildId}`);
      }

      // Update tags if provided
      if (tags !== undefined) {
        await db.delete(guildTags).where(eq(guildTags.guildId, guildId));
        if (tags.length > 0) {
          await db.insert(guildTags).values(
            tags.map((tag) => ({ guildId, tag: tag.toLowerCase().trim() })),
          );
        }
      }

      // Audit log
      const changes: Record<string, unknown> = {};
      if (name !== undefined) changes.name = name;
      if (description !== undefined) changes.description = description;
      if (isDiscoverable !== undefined) changes.isDiscoverable = isDiscoverable;
      if (accentColor !== undefined) changes.accentColor = accentColor;
      if (category !== undefined) changes.category = category;
      if (tags !== undefined) changes.tags = tags;
      logAuditEvent(guildId, req.userId!, AuditActionTypes.GUILD_UPDATE, guildId, 'GUILD', changes);

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
      await requireOwner(guildId, req.userId!);

      await db.delete(guilds).where(eq(guilds.id, guildId));

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
      await requireMember(guildId, req.userId!);

      const requestedLimit = Number(req.query.limit) || 50;
      const requestedOffset = Number(req.query.offset) || 0;
      const limit = Math.min(Math.max(requestedLimit, 1), 100);
      const offset = Math.max(requestedOffset, 0);
      const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
      const status = typeof req.query.status === 'string' ? req.query.status.trim().toLowerCase() : '';
      const groupId = typeof req.query.groupId === 'string' ? req.query.groupId.trim() : '';
      const escapedSearch = search.replace(/[%_\\]/g, '\\$&');

      const rows = await db
        .select({
          id: guildMembers.id,
          userId: guildMembers.userId,
          username: users.username,
          displayName: users.displayName,
          avatarHash: users.avatarHash,
          nickname: guildMembers.nickname,
          joinedAt: guildMembers.joinedAt,
        })
        .from(guildMembers)
        .innerJoin(users, eq(users.id, guildMembers.userId))
        .where(
          search.length > 0
            ? and(
              eq(guildMembers.guildId, guildId),
              sql`(
                ${users.username} ILIKE ${`%${escapedSearch}%`}
                OR ${users.displayName} ILIKE ${`%${escapedSearch}%`}
                OR ${guildMembers.nickname} ILIKE ${`%${escapedSearch}%`}
              )`,
            )
            : eq(guildMembers.guildId, guildId),
        )
        .orderBy(asc(users.username));

      // Fetch all role assignments for this guild in one query
      const allMemberRoles = await db
        .select({
          userId: memberRoles.userId,
          roleId: memberRoles.roleId,
        })
        .from(memberRoles)
        .where(eq(memberRoles.guildId, guildId));

      // Group role IDs by user
      const rolesByUser = new Map<string, string[]>();
      for (const mr of allMemberRoles) {
        const arr = rolesByUser.get(mr.userId) ?? [];
        arr.push(mr.roleId);
        rolesByUser.set(mr.userId, arr);
      }

      const groupAssignments = await db
        .select({
          groupId: guildMemberGroupMembers.groupId,
          userId: guildMemberGroupMembers.userId,
        })
        .from(guildMemberGroupMembers)
        .where(eq(guildMemberGroupMembers.guildId, guildId));

      const groupIdsByUser = new Map<string, string[]>();
      for (const assignment of groupAssignments) {
        const arr = groupIdsByUser.get(assignment.userId) ?? [];
        arr.push(assignment.groupId);
        groupIdsByUser.set(assignment.userId, arr);
      }

      const userIds = rows.map((row) => row.userId);
      const statusByUser = new Map<string, MemberWithPresenceStatus>();
      const activityByUser = new Map<string, { name: string; type: string } | null>();
      if (userIds.length > 0) {
        // Use Redis presence keys as source of truth for online status.
        // Heartbeats keep keys alive (600s TTL) for connected users,
        // and disconnect sets a 30s grace period before expiry.
        try {
          const pipeline = redis.pipeline();
          for (const uid of userIds) {
            pipeline.get(`presence:${uid}`);
            pipeline.get(`presence:${uid}:activity`);
          }
          const pipelineResult = await pipeline.exec();
          userIds.forEach((uid, index) => {
            const redisStatus = (pipelineResult?.[index * 2]?.[1] as string | null);

            let status: MemberWithPresenceStatus;
            if (redisStatus) {
              // Redis key exists — user is online (heartbeat keeping it alive)
              status = normalizePresenceStatus(redisStatus);
            } else {
              // No Redis key — user is offline
              status = 'offline';
            }
            statusByUser.set(uid, status);

            const activityValue = pipelineResult?.[index * 2 + 1]?.[1] as string | null;
            if (activityValue) {
              try { activityByUser.set(uid, JSON.parse(activityValue)); } catch { /* ignore */ }
            }
          });
        } catch {
          // Redis unavailable — default everyone to offline
          userIds.forEach((uid) => {
            statusByUser.set(uid, 'offline');
          });
        }
      }

      const membersWithRoles = rows.map((row) => ({
        ...row,
        status: statusByUser.get(row.userId) ?? 'offline',
        activity: activityByUser.get(row.userId) ?? null,
        roles: rolesByUser.get(row.userId) ?? [],
        roleIds: rolesByUser.get(row.userId) ?? [],
        groupIds: groupIdsByUser.get(row.userId) ?? [],
      }));

      let filtered = membersWithRoles;
      if (status === 'online') {
        filtered = filtered.filter((member) => member.status !== 'offline' && member.status !== 'invisible');
      } else if (status === 'offline') {
        filtered = filtered.filter((member) => member.status === 'offline' || member.status === 'invisible');
      }
      if (groupId) {
        filtered = filtered.filter((member) => member.groupIds.includes(groupId));
      }

      res.status(200).json(filtered.slice(offset, offset + limit));
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
        })
        .from(guildMembers)
        .innerJoin(users, eq(users.id, guildMembers.userId))
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
        displayName: member.displayName,
        nickname: member.nickname ?? null,
        bio: null,
        avatarHash: member.avatarHash ?? null,
        bannerHash: member.bannerHash ?? null,
        updatedAt: member.joinedAt,
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
 *
 * Accepted but currently non-persistent:
 *   - bio
 */
guildsRouter.patch(
  '/:guildId/members/@me/profile',
  requireAuth,
  validate(updateMemberProfileSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { guildId } = req.params as Record<string, string>;
      await requireMember(guildId, req.userId!);

      const { nickname } = req.body as z.infer<typeof updateMemberProfileSchema>;
      if (nickname !== undefined) {
        const normalizedNickname = nickname === null ? null : nickname.trim() || null;
        await db
          .update(guildMembers)
          .set({ nickname: normalizedNickname })
          .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, req.userId!)));
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
        })
        .from(guildMembers)
        .innerJoin(users, eq(users.id, guildMembers.userId))
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
        displayName: member.displayName,
        nickname: member.nickname ?? null,
        bio: null,
        avatarHash: member.avatarHash ?? null,
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
      const userId = req.userId!;

      // Block owner from leaving (must transfer ownership first)
      const [guild] = await db
        .select({ ownerId: guilds.ownerId })
        .from(guilds)
        .where(eq(guilds.id, guildId))
        .limit(1);

      if (!guild) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Guild not found' });
        return;
      }

      if (guild.ownerId === userId) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'Transfer ownership before leaving' });
        return;
      }

      await db
        .delete(guildMembers)
        .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, userId)));

      // Decrement member count
      await db
        .update(guilds)
        .set({ memberCount: sql`GREATEST(${guilds.memberCount} - 1, 0)`, updatedAt: new Date() })
        .where(eq(guilds.id, guildId));

      getIO().to(`guild:${guildId}`).emit('GUILD_MEMBER_REMOVE', { guildId, userId });

      // Trigger E2E key rotation for any encrypted channels in this guild
      await emitKeyRotationForEncryptedChannels(guildId, 'member_removed');

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
      await requireMember(guildId, req.userId!);

      if (!(await hasPermission(req.userId!, guildId, Permissions.KICK_MEMBERS))) {
        throw new AppError(403, 'Missing KICK_MEMBERS permission', 'FORBIDDEN');
      }

      // Prevent self-kick.
      if (targetUserId === req.userId) {
        res.status(400).json({ code: 'VALIDATION_ERROR', message: 'You cannot kick yourself from the guild' });
        return;
      }

      // Verify target is actually a member.
      const [membership] = await db
        .select({ id: guildMembers.id })
        .from(guildMembers)
        .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, targetUserId)))
        .limit(1);

      if (!membership) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'User is not a member of this guild' });
        return;
      }

      // Delete the membership row.
      await db
        .delete(guildMembers)
        .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, targetUserId)));

      // Decrement member count (floor at 0 for safety).
      await db
        .update(guilds)
        .set({ memberCount: sql`GREATEST(${guilds.memberCount} - 1, 0)`, updatedAt: new Date() })
        .where(eq(guilds.id, guildId));

      // Audit log
      logAuditEvent(guildId, req.userId!, AuditActionTypes.MEMBER_KICK, targetUserId, 'USER');

      // Trigger E2E key rotation for any encrypted channels in this guild
      await emitKeyRotationForEncryptedChannels(guildId, 'member_removed');

      res.status(200).json({ code: 'OK', message: 'Member removed' });
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
      } catch { /* non-fatal */ }

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
      } catch { /* non-fatal */ }

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
      const dailyMsgResult = await db.execute(sql`SELECT DATE(created_at) as day, COUNT(*)::int as count FROM messages WHERE channel_id = ANY(${channelIds}) AND created_at > now() - ${sql.raw(`interval '${range} days'`)} GROUP BY day ORDER BY day`);
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
    const joinResult = await db.execute(sql`SELECT DATE(joined_at) as day, COUNT(*)::int as count FROM guild_members WHERE guild_id = ${guildId} AND joined_at > now() - ${sql.raw(`interval '${range} days'`)} GROUP BY day ORDER BY day`);
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
      } catch {
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
      } catch {
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
      } catch {
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
