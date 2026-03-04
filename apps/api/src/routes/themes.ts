/**
 * routes/themes.ts — Theme Store endpoints (browse, create, update, publish, delete).
 *
 * Mounted at:
 *   /themes           — browse & CRUD for themes
 *   /users/@me/themes — list current user's themes
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, desc, or, ilike } from 'drizzle-orm';
import { db } from '../db/index';
import { themes } from '../db/schema/themes';
import { users } from '../db/schema/users';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';

export const themesRouter = Router({ mergeParams: true });

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
// GET /themes — browse published themes
// ---------------------------------------------------------------------------

themesRouter.get('/themes', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { q, tag } = req.query as Record<string, string | undefined>;

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
    previewImageUrl: themes.previewImageUrl,
    createdAt: themes.createdAt,
    updatedAt: themes.updatedAt,
    creatorUsername: users.username,
    creatorDisplayName: users.displayName,
  })
    .from(themes)
    .leftJoin(users, eq(users.id, themes.creatorId))
    .where(and(...conditions))
    .orderBy(desc(themes.downloads));

  // Filter by tag in application code (jsonb array contains)
  if (tag) {
    rows = rows.filter((r) => {
      const tags = r.tags as string[] | null;
      return tags && tags.includes(tag);
    });
  }

  res.json(rows.map((r) => ({
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
    previewImageUrl: r.previewImageUrl,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    creator: {
      id: r.creatorId,
      username: r.creatorUsername,
      displayName: r.creatorDisplayName,
    },
  })));
});

// ---------------------------------------------------------------------------
// GET /themes/:id — get a single theme
// ---------------------------------------------------------------------------

themesRouter.get('/themes/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
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

  const r = rows[0];
  res.json({
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
    previewImageUrl: r.previewImageUrl,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    creator: {
      id: r.creatorId,
      username: r.creatorUsername,
      displayName: r.creatorDisplayName,
    },
  });
});

// ---------------------------------------------------------------------------
// POST /themes — create a theme
// ---------------------------------------------------------------------------

themesRouter.post('/themes', requireAuth, validate(createThemeSchema), async (req: Request, res: Response): Promise<void> => {
  const { name, description, tags, vars } = req.body;

  const [theme] = await db.insert(themes).values({
    name,
    description: description ?? null,
    tags: tags ?? [],
    variables: vars,
    creatorId: req.userId!,
  }).returning();

  res.status(201).json(theme);
});

// ---------------------------------------------------------------------------
// PATCH /themes/:id — update a theme
// ---------------------------------------------------------------------------

themesRouter.patch('/themes/:id', requireAuth, validate(updateThemeSchema), async (req: Request, res: Response): Promise<void> => {
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
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (tags !== undefined) updates.tags = tags;
  if (vars !== undefined) updates.variables = vars;

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
