import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index';
import { messageDrafts } from '../db/schema/message-drafts';
import { channels, dmChannelMembers } from '../db/schema/channels';
import { guildMembers } from '../db/schema/guilds';
import { requireAuth } from '../middleware/auth';

// SECURITY: verify user has access to a channel before allowing draft operations
async function verifyChannelAccess(channelId: string, userId: string): Promise<boolean> {
  const [channel] = await db.select().from(channels).where(eq(channels.id, channelId)).limit(1);
  if (!channel) return false;
  if (channel.type === 'DM' || channel.type === 'GROUP_DM') {
    const [membership] = await db.select({ id: dmChannelMembers.id }).from(dmChannelMembers)
      .where(and(eq(dmChannelMembers.channelId, channelId), eq(dmChannelMembers.userId, userId))).limit(1);
    return !!membership;
  }
  if (channel.guildId) {
    const [gm] = await db.select({ id: guildMembers.id }).from(guildMembers)
      .where(and(eq(guildMembers.guildId, channel.guildId), eq(guildMembers.userId, userId))).limit(1);
    return !!gm;
  }
  return false;
}

export const draftsRouter = Router({ mergeParams: true });

// GET /users/@me/drafts — list all drafts for the current user
draftsRouter.get('/users/@me/drafts', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const drafts = await db.select()
      .from(messageDrafts)
      .where(eq(messageDrafts.userId, req.userId!))
      .limit(200);
    res.json(drafts);
  } catch (err) {
    logger.error('[drafts] GET all error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// GET /channels/:channelId/draft — get user's draft for this channel
draftsRouter.get('/channels/:channelId/draft', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const channelId = req.params.channelId as string;

    // SECURITY: verify channel access
    if (!await verifyChannelAccess(channelId, req.userId!)) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'No access to this channel' });
      return;
    }

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

    // SECURITY: verify channel access before upserting draft
    if (!await verifyChannelAccess(channelId, req.userId!)) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'No access to this channel' });
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

    // SECURITY: verify channel access before deleting draft
    if (!await verifyChannelAccess(channelId, req.userId!)) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'No access to this channel' });
      return;
    }

    await db.delete(messageDrafts)
      .where(and(eq(messageDrafts.userId, req.userId!), eq(messageDrafts.channelId, channelId)));
    res.json({ ok: true });
  } catch (err) {
    logger.error('[drafts] DELETE error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});
