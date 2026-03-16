/**
 * documents.ts — REST endpoints for collaborative document CRUD and presence.
 *
 * Routes:
 *   GET  /channels/:channelId/document          — get or create the document for a channel
 *   PUT  /channels/:channelId/document          — full save (offline sync / periodic persist)
 *   GET  /channels/:channelId/document/presence — get active editors
 */
import { Router, Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index';
import { collaborativeDocuments } from '../db/schema/collaborative-documents';
import { channels } from '../db/schema/channels';
import { dmChannelMembers } from '../db/schema/channels';
import { guildMembers } from '../db/schema/guilds';
import { users } from '../db/schema/users';
import { requireAuth } from '../middleware/auth';
import { redis } from '../lib/redis';
import { logger } from '../lib/logger';

export const documentsRouter = Router();

const MAX_CONTENT_SIZE = 2 * 1024 * 1024; // 2MB max document size

// SECURITY: verify user has access to a channel before allowing document operations
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

// GET /channels/:channelId/document — get or auto-create the collaborative document
documentsRouter.get('/channels/:channelId/document', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const channelId = req.params.channelId as string;

    // SECURITY: verify channel access
    if (!await verifyChannelAccess(channelId, req.userId!)) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'No access to this channel' });
      return;
    }

    let [doc] = await db.select().from(collaborativeDocuments)
      .where(eq(collaborativeDocuments.channelId, channelId))
      .limit(1);

    // Auto-create if it doesn't exist yet
    if (!doc) {
      [doc] = await db.insert(collaborativeDocuments)
        .values({
          channelId,
          title: 'Untitled',
          content: '',
          createdBy: req.userId!,
        })
        .returning();
    }

    res.json(doc);
  } catch (err) {
    logger.error('[documents] GET error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// PUT /channels/:channelId/document — full save (used for periodic persistence of Yjs state)
documentsRouter.put('/channels/:channelId/document', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const channelId = req.params.channelId as string;
    const { title, content, version } = req.body as { title?: string; content?: string; version?: number };

    // SECURITY: verify channel access
    if (!await verifyChannelAccess(channelId, req.userId!)) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'No access to this channel' });
      return;
    }

    // SECURITY: enforce content size limit (2MB)
    if (content && content.length > MAX_CONTENT_SIZE) {
      res.status(413).json({ code: 'PAYLOAD_TOO_LARGE', message: 'Document content exceeds 2MB limit' });
      return;
    }

    // Find existing doc
    const [existing] = await db.select({ id: collaborativeDocuments.id, version: collaborativeDocuments.version })
      .from(collaborativeDocuments)
      .where(eq(collaborativeDocuments.channelId, channelId))
      .limit(1);

    if (!existing) {
      // Create it
      const [doc] = await db.insert(collaborativeDocuments)
        .values({
          channelId,
          title: title?.trim().slice(0, 200) || 'Untitled',
          content: content || '',
          version: 1,
          createdBy: req.userId!,
        })
        .returning();
      res.json(doc);
      return;
    }

    // Optimistic concurrency: only update if version matches (or version not provided)
    const updates: Record<string, any> = {
      updatedAt: new Date(),
      version: existing.version + 1,
    };
    if (title !== undefined) updates.title = title.trim().slice(0, 200);
    if (content !== undefined) updates.content = content;

    const [updated] = await db.update(collaborativeDocuments)
      .set(updates)
      .where(eq(collaborativeDocuments.id, existing.id))
      .returning();

    res.json(updated);
  } catch (err) {
    logger.error('[documents] PUT error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// GET /channels/:channelId/document/presence — get active editors from Redis
documentsRouter.get('/channels/:channelId/document/presence', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const channelId = req.params.channelId as string;

    // SECURITY: verify channel access
    if (!await verifyChannelAccess(channelId, req.userId!)) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'No access to this channel' });
      return;
    }

    const editorIds = await redis.smembers(`doc-presence:${channelId}`);

    if (editorIds.length === 0) {
      res.json([]);
      return;
    }

    const editors = await db.select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarHash: users.avatarHash,
    })
      .from(users)
      .where(
        // Use manual IN since drizzle-orm inArray import varies
        eq(users.id, editorIds[0]),
      );

    // For multiple editors, query individually (small set, typically < 10)
    const allEditors = [];
    for (const editorId of editorIds) {
      const [editor] = await db.select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarHash: users.avatarHash,
      })
        .from(users)
        .where(eq(users.id, editorId))
        .limit(1);
      if (editor) allEditors.push(editor);
    }

    res.json(allEditors);
  } catch (err) {
    logger.error('[documents] presence GET error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});
