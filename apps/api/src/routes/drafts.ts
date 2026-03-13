import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index';
import { messageDrafts } from '../db/schema/message-drafts';
import { requireAuth } from '../middleware/auth';

export const draftsRouter = Router({ mergeParams: true });

// GET /channels/:channelId/draft — get user's draft for this channel
draftsRouter.get('/channels/:channelId/draft', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const channelId = req.params.channelId as string;
    const [draft] = await db.select()
      .from(messageDrafts)
      .where(and(eq(messageDrafts.userId, req.userId!), eq(messageDrafts.channelId, channelId)))
      .limit(1);
    res.json(draft || null);
  } catch (err) {
    logger.error('[drafts] GET error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// PUT /channels/:channelId/draft — upsert draft
draftsRouter.put('/channels/:channelId/draft', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const channelId = req.params.channelId as string;
    const { content } = req.body as { content: string };
    if (typeof content !== 'string') {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'content is required' });
      return;
    }
    const [draft] = await db.insert(messageDrafts)
      .values({ userId: req.userId! as string, channelId, content })
      .onConflictDoUpdate({
        target: [messageDrafts.userId, messageDrafts.channelId],
        set: { content, updatedAt: new Date() },
      })
      .returning();
    res.json(draft);
  } catch (err) {
    logger.error('[drafts] PUT error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// DELETE /channels/:channelId/draft — delete draft
draftsRouter.delete('/channels/:channelId/draft', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const channelId = req.params.channelId as string;
    await db.delete(messageDrafts)
      .where(and(eq(messageDrafts.userId, req.userId!), eq(messageDrafts.channelId, channelId)));
    res.json({ ok: true });
  } catch (err) {
    logger.error('[drafts] DELETE error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});
