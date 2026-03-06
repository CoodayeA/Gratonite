/**
 * routes/webhooks.ts — Webhook management + execution endpoints.
 *
 * Mounted at /api/v1 by src/routes/index.ts.
 *
 * Endpoints:
 *   POST   /channels/:channelId/webhooks   — create a webhook (auth required)
 *   GET    /guilds/:guildId/webhooks        — list guild webhooks (auth required)
 *   DELETE /webhooks/:webhookId             — delete a webhook (auth required)
 *   POST   /webhooks/:webhookId/:token      — execute webhook (no auth)
 */

import { Router, Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';

import { db } from '../db/index';
import { webhooks } from '../db/schema/webhooks';
import { channels } from '../db/schema/channels';
import { messages } from '../db/schema/messages';
import { requireAuth } from '../middleware/auth';
import { getIO } from '../lib/socket-io';

export const webhooksRouter = Router();

// POST /channels/:channelId/webhooks — create webhook
webhooksRouter.post(
  '/channels/:channelId/webhooks',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { channelId } = req.params;
      const { name } = req.body;
      const userId = req.userId!;

      if (!name || typeof name !== 'string') {
        res.status(400).json({ error: 'name is required' });
        return;
      }

      const [channel] = await db
        .select({ guildId: channels.guildId })
        .from(channels)
        .where(eq(channels.id, channelId))
        .limit(1);

      if (!channel || !channel.guildId) {
        res.status(404).json({ error: 'Guild channel not found' });
        return;
      }

      const [webhook] = await db
        .insert(webhooks)
        .values({
          channelId,
          guildId: channel.guildId,
          creatorId: userId,
          name: name.slice(0, 80),
        })
        .returning();

      res.status(201).json(webhook);
    } catch (err) {
      console.error('[webhooks] create error:', err);
      res.status(500).json({ error: 'Failed to create webhook' });
    }
  },
);

// GET /guilds/:guildId/webhooks — list guild webhooks
webhooksRouter.get(
  '/guilds/:guildId/webhooks',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { guildId } = req.params;
      const allWebhooks = await db
        .select()
        .from(webhooks)
        .where(eq(webhooks.guildId, guildId));
      res.json(allWebhooks);
    } catch (err) {
      console.error('[webhooks] list error:', err);
      res.status(500).json({ error: 'Failed to fetch webhooks' });
    }
  },
);

// DELETE /webhooks/:webhookId — delete webhook
webhooksRouter.delete(
  '/webhooks/:webhookId',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { webhookId } = req.params;
      await db.delete(webhooks).where(eq(webhooks.id, webhookId));
      res.json({ success: true });
    } catch (err) {
      console.error('[webhooks] delete error:', err);
      res.status(500).json({ error: 'Failed to delete webhook' });
    }
  },
);

// POST /webhooks/:webhookId/:token — execute webhook (no auth required)
webhooksRouter.post(
  '/webhooks/:webhookId/:token',
  async (req: Request, res: Response) => {
    try {
      const { webhookId, token } = req.params;
      const { content, username, avatarUrl } = req.body;

      if (!content || typeof content !== 'string') {
        res.status(400).json({ error: 'content is required' });
        return;
      }

      const [webhook] = await db
        .select()
        .from(webhooks)
        .where(and(eq(webhooks.id, webhookId), eq(webhooks.token, token)))
        .limit(1);

      if (!webhook) {
        res.status(401).json({ error: 'Invalid webhook or token' });
        return;
      }

      // Insert message — use webhook creator as authorId since messages require an author
      const [msg] = await db
        .insert(messages)
        .values({
          channelId: webhook.channelId,
          content: content.slice(0, 4000),
          authorId: webhook.creatorId!,
        })
        .returning();

      const displayName = username || webhook.name;
      const displayAvatar = avatarUrl || webhook.avatarUrl;

      try {
        getIO()
          .to(`channel:${webhook.channelId}`)
          .emit('MESSAGE_CREATE', {
            ...msg,
            author: {
              id: webhook.id,
              username: displayName,
              displayName,
              avatarHash: null,
              avatarUrl: displayAvatar,
              isWebhook: true,
            },
          });
      } catch {
        // Socket.io not ready
      }

      res.status(201).json(msg);
    } catch (err) {
      console.error('[webhooks] execute error:', err);
      res.status(500).json({ error: 'Webhook execution failed' });
    }
  },
);
