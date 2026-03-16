import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { eq, and, ilike, or, sql } from 'drizzle-orm';
import { db } from '../db/index';
import { messageSnippets } from '../db/schema/message-snippets';
import { requireAuth } from '../middleware/auth';

export const snippetsRouter = Router();

// GET /users/@me/snippets — list all snippets (with optional ?search= query)
snippetsRouter.get('/users/@me/snippets', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const search = req.query.search as string | undefined;
    const conditions = [eq(messageSnippets.userId, req.userId!)];

    if (search && search.trim()) {
      const pattern = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(messageSnippets.title, pattern),
          ilike(messageSnippets.content, pattern),
        )!,
      );
    }

    const snippets = await db.select()
      .from(messageSnippets)
      .where(and(...conditions))
      .orderBy(messageSnippets.createdAt);

    res.json(snippets);
  } catch (err) {
    logger.error('[snippets] GET all error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// POST /users/@me/snippets — create snippet
snippetsRouter.post('/users/@me/snippets', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, content, tags } = req.body as { title: string; content: string; tags?: string[] };

    if (!title || !title.trim()) {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'title is required' });
      return;
    }
    if (!content || !content.trim()) {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'content is required' });
      return;
    }

    const [snippet] = await db.insert(messageSnippets)
      .values({
        userId: req.userId! as string,
        title: title.trim().slice(0, 100),
        content: content.trim(),
        tags: tags || [],
      })
      .returning();

    res.status(201).json(snippet);
  } catch (err) {
    logger.error('[snippets] POST error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// PATCH /users/@me/snippets/:id — update snippet
snippetsRouter.patch('/users/@me/snippets/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const snippetId = req.params.id as string;
    const { title, content, tags } = req.body as { title?: string; content?: string; tags?: string[] };

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title.trim().slice(0, 100);
    if (content !== undefined) updates.content = content.trim();
    if (tags !== undefined) updates.tags = tags;

    if (Object.keys(updates).length === 1) {
      // Only updatedAt — nothing meaningful to update
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Nothing to update' });
      return;
    }

    const [updated] = await db.update(messageSnippets)
      .set(updates)
      .where(and(eq(messageSnippets.id, snippetId), eq(messageSnippets.userId, req.userId!)))
      .returning();

    if (!updated) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Snippet not found' });
      return;
    }

    res.json(updated);
  } catch (err) {
    logger.error('[snippets] PATCH error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// DELETE /users/@me/snippets/:id — delete snippet
snippetsRouter.delete('/users/@me/snippets/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const snippetId = req.params.id as string;
    await db.delete(messageSnippets)
      .where(and(eq(messageSnippets.id, snippetId), eq(messageSnippets.userId, req.userId!)));
    res.json({ ok: true });
  } catch (err) {
    logger.error('[snippets] DELETE error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// POST /users/@me/snippets/:id/use — increment usage count
snippetsRouter.post('/users/@me/snippets/:id/use', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const snippetId = req.params.id as string;
    const [updated] = await db.update(messageSnippets)
      .set({ usageCount: sql`${messageSnippets.usageCount} + 1`, updatedAt: new Date() })
      .where(and(eq(messageSnippets.id, snippetId), eq(messageSnippets.userId, req.userId!)))
      .returning();

    if (!updated) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Snippet not found' });
      return;
    }

    res.json(updated);
  } catch (err) {
    logger.error('[snippets] POST use error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});
