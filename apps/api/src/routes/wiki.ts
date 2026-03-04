/**
 * routes/wiki.ts — CRUD endpoints for wiki pages and revision history.
 *
 * Mounted at:
 *   /channels/:channelId/wiki  — list & create pages
 *   /wiki/:pageId              — get, update, delete a page
 *   /wiki/:pageId/revisions    — revision history
 *   /wiki/:pageId/revert/:revisionId — revert to a previous revision
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index';
import { wikiPages, wikiRevisions } from '../db/schema/wiki';
import { users } from '../db/schema/users';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';

export const wikiRouter = Router({ mergeParams: true });

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createPageSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().default(''),
});

const updatePageSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: z.string().optional(),
});

// ---------------------------------------------------------------------------
// GET /channels/:channelId/wiki — list wiki pages
// ---------------------------------------------------------------------------

wikiRouter.get('/channels/:channelId/wiki', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { channelId } = req.params as Record<string, string>;

  const pages = await db.select({
    id: wikiPages.id,
    channelId: wikiPages.channelId,
    title: wikiPages.title,
    content: wikiPages.content,
    authorId: wikiPages.authorId,
    updatedBy: wikiPages.updatedBy,
    createdAt: wikiPages.createdAt,
    updatedAt: wikiPages.updatedAt,
    authorUsername: users.username,
    authorDisplayName: users.displayName,
  })
    .from(wikiPages)
    .leftJoin(users, eq(users.id, wikiPages.authorId))
    .where(eq(wikiPages.channelId, channelId))
    .orderBy(desc(wikiPages.updatedAt));

  res.json(pages.map(p => ({
    id: p.id,
    channelId: p.channelId,
    title: p.title,
    content: p.content,
    authorId: p.authorId,
    author: p.authorDisplayName ?? p.authorUsername ?? 'Unknown',
    updatedBy: p.updatedBy,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  })));
});

// ---------------------------------------------------------------------------
// POST /channels/:channelId/wiki — create a wiki page
// ---------------------------------------------------------------------------

wikiRouter.post('/channels/:channelId/wiki', requireAuth, validate(createPageSchema), async (req: Request, res: Response): Promise<void> => {
  const { channelId } = req.params as Record<string, string>;
  const { title, content } = req.body;

  const [page] = await db.insert(wikiPages).values({
    channelId,
    title,
    content: content ?? '',
    authorId: req.userId!,
  }).returning();

  res.status(201).json(page);
});

// ---------------------------------------------------------------------------
// GET /wiki/:pageId — get a single wiki page
// ---------------------------------------------------------------------------

wikiRouter.get('/wiki/:pageId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { pageId } = req.params as Record<string, string>;

  const rows = await db.select({
    id: wikiPages.id,
    channelId: wikiPages.channelId,
    title: wikiPages.title,
    content: wikiPages.content,
    authorId: wikiPages.authorId,
    updatedBy: wikiPages.updatedBy,
    createdAt: wikiPages.createdAt,
    updatedAt: wikiPages.updatedAt,
    authorUsername: users.username,
    authorDisplayName: users.displayName,
  })
    .from(wikiPages)
    .leftJoin(users, eq(users.id, wikiPages.authorId))
    .where(eq(wikiPages.id, pageId))
    .limit(1);

  if (rows.length === 0) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Wiki page not found' });
    return;
  }

  const p = rows[0];
  res.json({
    id: p.id,
    channelId: p.channelId,
    title: p.title,
    content: p.content,
    authorId: p.authorId,
    author: p.authorDisplayName ?? p.authorUsername ?? 'Unknown',
    updatedBy: p.updatedBy,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  });
});

// ---------------------------------------------------------------------------
// PATCH /wiki/:pageId — update a wiki page (also creates a revision)
// ---------------------------------------------------------------------------

wikiRouter.patch('/wiki/:pageId', requireAuth, validate(updatePageSchema), async (req: Request, res: Response): Promise<void> => {
  const { pageId } = req.params as Record<string, string>;
  const { title, content } = req.body;

  // Fetch existing page to create a revision snapshot
  const [existing] = await db.select().from(wikiPages).where(eq(wikiPages.id, pageId)).limit(1);
  if (!existing) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Wiki page not found' });
    return;
  }

  // Create revision of old content
  await db.insert(wikiRevisions).values({
    pageId,
    content: existing.content,
    editedBy: req.userId!,
  });

  // Update page
  const updates: Record<string, unknown> = { updatedBy: req.userId!, updatedAt: new Date() };
  if (title !== undefined) updates.title = title;
  if (content !== undefined) updates.content = content;

  const [updated] = await db.update(wikiPages)
    .set(updates)
    .where(eq(wikiPages.id, pageId))
    .returning();

  res.json(updated);
});

// ---------------------------------------------------------------------------
// DELETE /wiki/:pageId — delete a wiki page
// ---------------------------------------------------------------------------

wikiRouter.delete('/wiki/:pageId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { pageId } = req.params as Record<string, string>;

  const [existing] = await db.select().from(wikiPages).where(eq(wikiPages.id, pageId)).limit(1);
  if (!existing) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Wiki page not found' });
    return;
  }

  await db.delete(wikiPages).where(eq(wikiPages.id, pageId));
  res.status(204).send();
});

// ---------------------------------------------------------------------------
// GET /wiki/:pageId/revisions — get revision history
// ---------------------------------------------------------------------------

wikiRouter.get('/wiki/:pageId/revisions', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { pageId } = req.params as Record<string, string>;

  const revisions = await db.select({
    id: wikiRevisions.id,
    pageId: wikiRevisions.pageId,
    content: wikiRevisions.content,
    editedBy: wikiRevisions.editedBy,
    createdAt: wikiRevisions.createdAt,
    authorUsername: users.username,
    authorDisplayName: users.displayName,
  })
    .from(wikiRevisions)
    .leftJoin(users, eq(users.id, wikiRevisions.editedBy))
    .where(eq(wikiRevisions.pageId, pageId))
    .orderBy(desc(wikiRevisions.createdAt));

  res.json(revisions.map(r => ({
    id: r.id,
    pageId: r.pageId,
    content: r.content,
    editedBy: r.editedBy,
    author: r.authorDisplayName ?? r.authorUsername ?? 'Unknown',
    createdAt: r.createdAt,
  })));
});

// ---------------------------------------------------------------------------
// POST /wiki/:pageId/revert/:revisionId — revert to a previous revision
// ---------------------------------------------------------------------------

wikiRouter.post('/wiki/:pageId/revert/:revisionId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { pageId, revisionId } = req.params as Record<string, string>;

  const [revision] = await db.select().from(wikiRevisions)
    .where(eq(wikiRevisions.id, revisionId))
    .limit(1);

  if (!revision || revision.pageId !== pageId) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Revision not found' });
    return;
  }

  // Snapshot current content as a new revision before reverting
  const [existing] = await db.select().from(wikiPages).where(eq(wikiPages.id, pageId)).limit(1);
  if (existing) {
    await db.insert(wikiRevisions).values({
      pageId,
      content: existing.content,
      editedBy: req.userId!,
    });
  }

  // Revert page content
  const [updated] = await db.update(wikiPages)
    .set({ content: revision.content, updatedBy: req.userId!, updatedAt: new Date() })
    .where(eq(wikiPages.id, pageId))
    .returning();

  res.json(updated);
});
