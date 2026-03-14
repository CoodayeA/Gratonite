/**
 * routes/themes.ts — Theme Store endpoints (browse, create, update, publish, delete).
 *
 * Mounted at:
 *   /themes           — browse & CRUD for themes
 *   /users/@me/themes — list current user's themes
 *
 * Features:
 *   - Rate limiting (Item 76)
 *   - CSS value sanitization / XSS prevention (Items 77, 80)
 *   - Theme reporting / content moderation (Item 78)
 *   - Cursor-based pagination (Item 79)
 *   - Theme versioning (Item 85)
 *   - Download tracking (Item 87)
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, desc, or, ilike, sql } from 'drizzle-orm';
import { db } from '../db/index';
import { themes } from '../db/schema/themes';
import { users } from '../db/schema/users';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createRateLimiter } from '../middleware/rateLimit';

export const themesRouter = Router({ mergeParams: true });

// ---------------------------------------------------------------------------
// Rate limiters (Item 76)
// ---------------------------------------------------------------------------

const themeCreateRateLimit = createRateLimiter({
  prefix: 'rl:theme:create',
  maxRequests: 10,
  windowSeconds: 3600,
  keyFn: (req) => req.userId ?? null,
});

const themeUpdateRateLimit = createRateLimiter({
  prefix: 'rl:theme:update',
  maxRequests: 30,
  windowSeconds: 3600,
  keyFn: (req) => req.userId ?? null,
});

const themeBrowseRateLimit = createRateLimiter({
  prefix: 'rl:theme:browse',
  maxRequests: 100,
  windowSeconds: 60,
  keyFn: (req) => req.userId ?? null,
});

const themeReportRateLimit = createRateLimiter({
  prefix: 'rl:theme:report',
  maxRequests: 10,
  windowSeconds: 3600,
  keyFn: (req) => req.userId ?? null,
});

// ---------------------------------------------------------------------------
// CSS sanitization (Items 77, 80 — XSS prevention)
// ---------------------------------------------------------------------------

/** Patterns that are unsafe in CSS values — prevents XSS & injection. */
const UNSAFE_CSS_PATTERNS: RegExp[] = [
  /url\s*\(/i,
  /expression\s*\(/i,
  /javascript\s*:/i,
  /@import/i,
  /behavior\s*:/i,
  /-moz-binding/i,
  /<script/i,
  /<\/script/i,
  /\/\*/,           // block comment open
  /\*\//,           // block comment close
  /\\00/,           // unicode escape abuse
  /data\s*:/i,      // data URIs
];

/**
 * Validate that a CSS value string is safe. Returns null if safe,
 * or an error message describing the violation.
 */
function validateCssValue(key: string, value: string): string | null {
  if (typeof value !== 'string') return `${key}: must be a string`;
  if (value.length > 500) return `${key}: value too long (max 500 chars)`;
  for (const pattern of UNSAFE_CSS_PATTERNS) {
    if (pattern.test(value)) {
      return `${key}: contains unsafe CSS pattern`;
    }
  }
  return null;
}

/**
 * Sanitize an entire theme variables record.
 * Returns { ok: true } or { ok: false, errors: string[] }.
 */
function sanitizeThemeVars(vars: Record<string, string>): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  for (const [key, value] of Object.entries(vars)) {
    const err = validateCssValue(key, value);
    if (err) errors.push(err);
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const createThemeSchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  vars: z.record(z.string(), z.string()),
});

const updateThemeSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  vars: z.record(z.string(), z.string()).optional(),
});

// ---------------------------------------------------------------------------
// Helper: format theme row for API response
// ---------------------------------------------------------------------------

function formatThemeRow(r: Record<string, unknown>) {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    creatorId: r.creatorId,
    variables: r.variables,
    tags: r.tags,
    published: r.published,
    downloads: r.downloads,
    rating: r.rating,
    reviewCount: r.reviewCount,
    version: r.version,
    reportCount: r.reportCount,
    previewImageUrl: r.previewImageUrl,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    creator: r.creatorUsername ? {
      id: r.creatorId,
      username: r.creatorUsername,
      displayName: r.creatorDisplayName,
    } : undefined,
  };
}

// ---------------------------------------------------------------------------
// GET /themes — browse published themes (Item 79: cursor-based pagination)
// ---------------------------------------------------------------------------

themesRouter.get('/themes', requireAuth, themeBrowseRateLimit, async (req: Request, res: Response): Promise<void> => {
  const { q, tag, limit: limitStr, after } = req.query as Record<string, string | undefined>;

  const limit = Math.min(Math.max(parseInt(limitStr || '20', 10) || 20, 1), 100);

  const conditions = [eq(themes.published, true)];

  if (q) {
    const escaped = q.replace(/[%_\\]/g, '\\$&');
    conditions.push(
      or(
        ilike(themes.name, `%${escaped}%`),
        ilike(themes.description, `%${escaped}%`),
      )!,
    );
  }

  // Cursor-based pagination: `after` is a theme ID
  if (after) {
    const [cursorRow] = await db.select({ downloads: themes.downloads, createdAt: themes.createdAt })
      .from(themes)
      .where(eq(themes.id, after))
      .limit(1);

    if (cursorRow) {
      conditions.push(
        or(
          sql`${themes.downloads} < ${cursorRow.downloads}`,
          and(
            eq(themes.downloads, cursorRow.downloads),
            sql`${themes.createdAt} < ${cursorRow.createdAt}`,
          ),
        )!,
      );
    }
  }

  let rows = await db.select({
    id: themes.id,
    name: themes.name,
    description: themes.description,
    creatorId: themes.creatorId,
    variables: themes.variables,
    tags: themes.tags,
    published: themes.published,
    downloads: themes.downloads,
    rating: themes.rating,
    reviewCount: themes.reviewCount,
    version: themes.version,
    reportCount: themes.reportCount,
    previewImageUrl: themes.previewImageUrl,
    createdAt: themes.createdAt,
    updatedAt: themes.updatedAt,
    creatorUsername: users.username,
    creatorDisplayName: users.displayName,
  })
    .from(themes)
    .leftJoin(users, eq(users.id, themes.creatorId))
    .where(and(...conditions))
    .orderBy(desc(themes.downloads), desc(themes.createdAt))
    .limit(limit + 1);

  // Filter by tag in application code (jsonb array contains)
  if (tag) {
    rows = rows.filter((r) => {
      const t = r.tags as string[] | null;
      return t && t.includes(tag);
    });
  }

  const hasMore = rows.length > limit;
  if (hasMore) rows = rows.slice(0, limit);

  const nextCursor = hasMore && rows.length > 0 ? rows[rows.length - 1].id : null;

  res.json({
    items: rows.map((r) => formatThemeRow(r as unknown as Record<string, unknown>)),
    nextCursor,
    hasMore,
  });
});

// ---------------------------------------------------------------------------
// GET /themes/:id — get a single theme
// ---------------------------------------------------------------------------

themesRouter.get('/themes/:id', requireAuth, themeBrowseRateLimit, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as Record<string, string>;

  const rows = await db.select({
    id: themes.id,
    name: themes.name,
    description: themes.description,
    creatorId: themes.creatorId,
    variables: themes.variables,
    tags: themes.tags,
    published: themes.published,
    downloads: themes.downloads,
    rating: themes.rating,
    reviewCount: themes.reviewCount,
    version: themes.version,
    reportCount: themes.reportCount,
    previewImageUrl: themes.previewImageUrl,
    createdAt: themes.createdAt,
    updatedAt: themes.updatedAt,
    creatorUsername: users.username,
    creatorDisplayName: users.displayName,
  })
    .from(themes)
    .leftJoin(users, eq(users.id, themes.creatorId))
    .where(eq(themes.id, id))
    .limit(1);

  if (rows.length === 0) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Theme not found' });
    return;
  }

  res.json(formatThemeRow(rows[0] as unknown as Record<string, unknown>));
});

// ---------------------------------------------------------------------------
// POST /themes — create a theme (Items 77/80: sanitize CSS, Item 85: versioning)
// ---------------------------------------------------------------------------

themesRouter.post('/themes', requireAuth, themeCreateRateLimit, validate(createThemeSchema), async (req: Request, res: Response): Promise<void> => {
  const { name, description, tags, vars } = req.body;

  // Sanitize CSS values
  const sanitizeResult = sanitizeThemeVars(vars);
  if (!sanitizeResult.ok) {
    res.status(400).json({ code: 'UNSAFE_CSS', message: 'Theme contains unsafe CSS values', errors: sanitizeResult.errors });
    return;
  }

  const [theme] = await db.insert(themes).values({
    name,
    description: description ?? null,
    tags: tags ?? [],
    variables: vars,
    creatorId: req.userId!,
    version: 1,
  }).returning();

  res.status(201).json(theme);
});

// ---------------------------------------------------------------------------
// PATCH /themes/:id — update a theme (Items 77/80: sanitize, Item 85: bump version)
// ---------------------------------------------------------------------------

themesRouter.patch('/themes/:id', requireAuth, themeUpdateRateLimit, validate(updateThemeSchema), async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as Record<string, string>;

  const [existing] = await db.select().from(themes).where(eq(themes.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Theme not found' });
    return;
  }
  if (existing.creatorId !== req.userId) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Not your theme' });
    return;
  }

  const { name, description, tags, vars } = req.body;

  // Sanitize CSS values if vars are being updated
  if (vars) {
    const sanitizeResult = sanitizeThemeVars(vars);
    if (!sanitizeResult.ok) {
      res.status(400).json({ code: 'UNSAFE_CSS', message: 'Theme contains unsafe CSS values', errors: sanitizeResult.errors });
      return;
    }
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (tags !== undefined) updates.tags = tags;
  if (vars !== undefined) {
    updates.variables = vars;
    // Bump version when variables change (Item 85)
    updates.version = (existing.version ?? 1) + 1;
  }

  const [updated] = await db.update(themes)
    .set(updates)
    .where(eq(themes.id, id))
    .returning();

  res.json(updated);
});

// ---------------------------------------------------------------------------
// POST /themes/:id/publish — publish a theme
// ---------------------------------------------------------------------------

themesRouter.post('/themes/:id/publish', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as Record<string, string>;

  const [existing] = await db.select().from(themes).where(eq(themes.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Theme not found' });
    return;
  }
  if (existing.creatorId !== req.userId) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Not your theme' });
    return;
  }

  const [updated] = await db.update(themes)
    .set({ published: true, updatedAt: new Date() })
    .where(eq(themes.id, id))
    .returning();

  res.json(updated);
});

// ---------------------------------------------------------------------------
// POST /themes/:id/report — report a theme (Item 78: content moderation)
// ---------------------------------------------------------------------------

themesRouter.post('/themes/:id/report', requireAuth, themeReportRateLimit, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as Record<string, string>;

  const [existing] = await db.select().from(themes).where(eq(themes.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Theme not found' });
    return;
  }

  // TODO: Without a theme_reports junction table, duplicate reports from the same user
  // cannot be prevented server-side. Consider adding a theme_reports table to track
  // per-user reports and prevent abuse.

  // Atomic increment to avoid read-modify-write race condition
  await db.update(themes)
    .set({ reportCount: sql`${themes.reportCount} + 1`, updatedAt: new Date() })
    .where(eq(themes.id, id));

  res.json({ message: 'Theme reported. Thank you for helping keep the community safe.' });
});

// ---------------------------------------------------------------------------
// POST /themes/:id/rate — rate a theme (1-5 stars)
// ---------------------------------------------------------------------------

themesRouter.post('/themes/:id/rate', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as Record<string, string>;
  const { rating: newRating } = req.body;

  if (typeof newRating !== 'number' || newRating < 1 || newRating > 5) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'Rating must be between 1 and 5' });
    return;
  }

  const [existing] = await db.select().from(themes).where(eq(themes.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Theme not found' });
    return;
  }

  // Prevent self-rating
  if (existing.creatorId === req.userId) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Cannot rate your own theme' });
    return;
  }

  // TODO: Without a theme_ratings junction table, duplicate ratings from the same user
  // cannot be prevented server-side. Consider adding a theme_ratings table to track
  // per-user ratings and enforce one-rating-per-user.

  // Atomic running average update to avoid read-modify-write race condition
  const [updated] = await db.update(themes)
    .set({
      rating: sql`(${themes.rating} * ${themes.reviewCount} + ${newRating}) / (${themes.reviewCount} + 1)`,
      reviewCount: sql`${themes.reviewCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(themes.id, id))
    .returning();

  res.json(updated);
});

// ---------------------------------------------------------------------------
// POST /themes/:id/download — track download (Item 87)
// ---------------------------------------------------------------------------

themesRouter.post('/themes/:id/download', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as Record<string, string>;

  const [existing] = await db.select({ id: themes.id, downloads: themes.downloads })
    .from(themes)
    .where(eq(themes.id, id))
    .limit(1);

  if (!existing) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Theme not found' });
    return;
  }

  // Atomic increment to avoid read-modify-write race condition
  const [updated] = await db.update(themes)
    .set({ downloads: sql`${themes.downloads} + 1` })
    .where(eq(themes.id, id))
    .returning({ downloads: themes.downloads });

  res.json({ downloads: updated.downloads });
});

// ---------------------------------------------------------------------------
// DELETE /themes/:id — delete a theme
// ---------------------------------------------------------------------------

themesRouter.delete('/themes/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as Record<string, string>;

  const [existing] = await db.select().from(themes).where(eq(themes.id, id)).limit(1);
  if (!existing) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Theme not found' });
    return;
  }
  if (existing.creatorId !== req.userId) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Not your theme' });
    return;
  }

  await db.delete(themes).where(eq(themes.id, id));
  res.status(204).send();
});

// ---------------------------------------------------------------------------
// GET /users/@me/themes — list current user's themes
// ---------------------------------------------------------------------------

themesRouter.get('/users/@me/themes', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const items = await db.select()
    .from(themes)
    .where(eq(themes.creatorId, req.userId!))
    .orderBy(desc(themes.createdAt));

  res.json(items);
});
