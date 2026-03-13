import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/index';
import { channelDocuments } from '../db/schema/channel-documents';
import { users } from '../db/schema/users';
import { requireAuth } from '../middleware/auth';

export const channelDocumentsRouter = Router();

// GET /channels/:channelId/documents — list documents for a channel
channelDocumentsRouter.get('/channels/:channelId/documents', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const channelId = req.params.channelId as string;
    const docs = await db.select({
      id: channelDocuments.id,
      channelId: channelDocuments.channelId,
      title: channelDocuments.title,
      content: channelDocuments.content,
      lastEditorId: channelDocuments.lastEditorId,
      createdAt: channelDocuments.createdAt,
      updatedAt: channelDocuments.updatedAt,
      editorUsername: users.username,
      editorDisplayName: users.displayName,
    })
      .from(channelDocuments)
      .leftJoin(users, eq(channelDocuments.lastEditorId, users.id))
      .where(eq(channelDocuments.channelId, channelId))
      .orderBy(desc(channelDocuments.updatedAt))
      .limit(50);

    res.json(docs);
  } catch (err) {
    logger.error('[channel-documents] GET error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// POST /channels/:channelId/documents — create a document
channelDocumentsRouter.post('/channels/:channelId/documents', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const channelId = req.params.channelId as string;
    const { title, content } = req.body as { title: string; content?: string };
    if (!title || !title.trim()) {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'title is required' });
      return;
    }
    const [doc] = await db.insert(channelDocuments)
      .values({
        channelId,
        title: title.trim().slice(0, 200),
        content: content || '',
        lastEditorId: req.userId!,
      })
      .returning();
    res.status(201).json(doc);
  } catch (err) {
    logger.error('[channel-documents] POST error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// PATCH /channels/:channelId/documents/:docId — update a document
channelDocumentsRouter.patch('/channels/:channelId/documents/:docId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const channelId = req.params.channelId as string;
    const docId = req.params.docId as string;
    const { title, content } = req.body as { title?: string; content?: string };
    const updates: Record<string, any> = { lastEditorId: req.userId!, updatedAt: new Date() };
    if (title !== undefined) updates.title = title.trim().slice(0, 200);
    if (content !== undefined) updates.content = content;

    const [updated] = await db.update(channelDocuments)
      .set(updates)
      .where(and(eq(channelDocuments.id, docId), eq(channelDocuments.channelId, channelId)))
      .returning();

    if (!updated) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Document not found' });
      return;
    }
    res.json(updated);
  } catch (err) {
    logger.error('[channel-documents] PATCH error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// DELETE /channels/:channelId/documents/:docId — delete a document
channelDocumentsRouter.delete('/channels/:channelId/documents/:docId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const channelId = req.params.channelId as string;
    const docId = req.params.docId as string;
    await db.delete(channelDocuments)
      .where(and(eq(channelDocuments.id, docId), eq(channelDocuments.channelId, channelId)));
    res.json({ ok: true });
  } catch (err) {
    logger.error('[channel-documents] DELETE error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});
