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
import { eq, desc, sql, and, inArray, asc } from 'drizzle-orm';
import multer from 'multer';

import { db } from '../db/index';
import { guilds } from '../db/schema/guilds';
import { guildMembers } from '../db/schema/guilds';
import { channels } from '../db/schema/channels';
import { users } from '../db/schema/users';
import { roles, memberRoles, DEFAULT_PERMISSIONS, Permissions } from '../db/schema/roles';
import { guildMemberGroups, guildMemberGroupMembers } from '../db/schema/member-groups';
import { auditLog } from '../db/schema/audit';
import { files } from '../db/schema/files';
import { guildMemberOnboarding } from '../db/schema/guild-onboarding';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { hasPermission } from './roles';
import { logAuditEvent, AuditActionTypes } from '../lib/audit';
import { redis } from '../lib/redis';

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

      const rows = await db
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
        })
        .from(guilds)
        .where(
          q.length > 0
            ? and(eq(guilds.isDiscoverable, true), sql`${guilds.name} ILIKE ${'%' + escapedQ + '%'}`)
            : eq(guilds.isDiscoverable, true),
        )
        .orderBy(desc(guilds.memberCount));

      const enriched = rows.map((row) => {
        const tags = extractTags(row.name, row.description);
        return {
          id: row.id,
          name: row.name,
          description: row.description,
          iconHash: row.iconHash,
          bannerHash: row.bannerHash,
          memberCount: row.memberCount,
          tags,
          categories: [] as string[],
          featured: row.isFeatured,
          isFeatured: row.isFeatured,
          discoverRank: row.discoverRank,
          verified: row.memberCount >= 100,
          isPublic: row.isDiscoverable,
          isPinned: row.isPinned,
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
        if (a.discoverRank !== b.discoverRank) return a.discoverRank - b.discoverRank;
        if (a.memberCount !== b.memberCount) return b.memberCount - a.memberCount;
        return a.name.localeCompare(b.name);
      });

      console.info(JSON.stringify({
        event: 'discover_query',
        route: '/guilds/discover',
        q: q || null,
        hashtag: hashtag || null,
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

      const { name, description, isDiscoverable, accentColor, welcomeMessage, rulesChannelId } = req.body as z.infer<typeof updateGuildSchema>;

      const updateData: Partial<typeof guilds.$inferInsert> = { updatedAt: new Date() };
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (isDiscoverable !== undefined) updateData.isDiscoverable = isDiscoverable;
      if (accentColor !== undefined) updateData.accentColor = accentColor === null ? null : normalizeHexColor(accentColor);
      if (welcomeMessage !== undefined) updateData.welcomeMessage = welcomeMessage;
      if (rulesChannelId !== undefined) updateData.rulesChannelId = rulesChannelId;

      const [updated] = await db
        .update(guilds)
        .set(updateData)
        .where(eq(guilds.id, guildId))
        .returning();

      // Audit log
      const changes: Record<string, unknown> = {};
      if (name !== undefined) changes.name = name;
      if (description !== undefined) changes.description = description;
      if (isDiscoverable !== undefined) changes.isDiscoverable = isDiscoverable;
      if (accentColor !== undefined) changes.accentColor = accentColor;
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
      if (userIds.length > 0) {
        try {
          const pipeline = redis.pipeline();
          for (const userId of userIds) {
            pipeline.get(`presence:${userId}`);
          }
          const pipelineResult = await pipeline.exec();
          userIds.forEach((userId, index) => {
            const value = (pipelineResult?.[index]?.[1] as string | null) ?? 'offline';
            statusByUser.set(userId, normalizePresenceStatus(value));
          });
        } catch {
          userIds.forEach((userId) => statusByUser.set(userId, 'offline'));
        }
      }

      const membersWithRoles = rows.map((row) => ({
        ...row,
        status: statusByUser.get(row.userId) ?? 'offline',
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

      res.status(200).json({ code: 'OK', message: 'Member removed' });
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
