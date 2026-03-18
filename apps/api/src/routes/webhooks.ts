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
import { logger } from '../lib/logger';
import { eq, and, desc } from 'drizzle-orm';

import { db } from '../db/index';
import { webhooks } from '../db/schema/webhooks';
import { webhookDeliveryLogs } from '../db/schema/webhook-delivery-logs';
import { channels } from '../db/schema/channels';
import { messages } from '../db/schema/messages';
import { guildMembers } from '../db/schema/guilds';
import { Permissions } from '../db/schema/roles';
import { requireAuth } from '../middleware/auth';
import { hasPermission } from './roles';
import { getIO } from '../lib/socket-io';
import { validateOutboundUrl } from '../lib/ssrf-guard';

export const webhooksRouter = Router();

// Simple in-memory rate limit: max 5 executions per webhook per 10 seconds
const RATE_LIMIT_WINDOW_MS = 10_000;
const webhookRateLimits = new Map<string, { count: number; resetAt: number }>();

// Periodic cleanup of stale rate limit entries (every 60 seconds)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of webhookRateLimits) {
    if (now >= entry.resetAt) {
      webhookRateLimits.delete(key);
    }
  }
}, 60_000).unref();

// POST /channels/:channelId/webhooks — create webhook
webhooksRouter.post(
  '/channels/:channelId/webhooks',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const channelId = req.params.channelId as string;
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

      const member = await db.select({ userId: guildMembers.userId })
        .from(guildMembers)
        .where(and(eq(guildMembers.guildId, channel.guildId!), eq(guildMembers.userId, userId)))
        .limit(1);
      if (!member.length) {
        res.status(403).json({ error: 'Not a member of this guild' });
        return;
      }

      // Require MANAGE_WEBHOOKS permission to create webhooks
      if (!(await hasPermission(userId, channel.guildId!, Permissions.MANAGE_WEBHOOKS))) {
        res.status(403).json({ error: 'Missing MANAGE_WEBHOOKS permission' });
        return;
      }

      // Validate webhook URL if provided — must be HTTPS and not target private IPs
      const { url } = req.body as { url?: string };
      if (url) {
        try {
          await validateOutboundUrl(url);
        } catch (err: any) {
          res.status(400).json({ error: `Invalid webhook URL: ${err.message}` });
          return;
        }
      }

      const [webhook] = await db
        .insert(webhooks)
        .values({
          channelId,
          guildId: channel.guildId,
          creatorId: userId,
          name: name.slice(0, 80),
          ...(url ? { url } : {}),
        })
        .returning();

      res.status(201).json(webhook);
    } catch (err) {
      logger.error('[webhooks] create error:', err);
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
      const guildId = req.params.guildId as string;
      const userId = req.userId!;

      const member = await db.select({ id: guildMembers.userId })
        .from(guildMembers)
        .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, userId)))
        .limit(1);
      if (!member.length) {
        res.status(403).json({ error: 'Not a member of this guild' });
        return;
      }

      // Require MANAGE_WEBHOOKS permission to list webhooks
      if (!(await hasPermission(userId, guildId, Permissions.MANAGE_WEBHOOKS))) {
        res.status(403).json({ error: 'Missing MANAGE_WEBHOOKS permission' });
        return;
      }

      const allWebhooks = await db
        .select()
        .from(webhooks)
        .where(eq(webhooks.guildId, guildId));
      res.json(allWebhooks);
    } catch (err) {
      logger.error('[webhooks] list error:', err);
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
      const webhookId = req.params.webhookId as string;
      const userId = req.userId!;

      const [webhook] = await db.select().from(webhooks).where(eq(webhooks.id, webhookId)).limit(1);
      if (!webhook) {
        res.status(404).json({ error: 'Webhook not found' });
        return;
      }

      // Authorization: only the webhook creator OR a member with MANAGE_WEBHOOKS
      // permission can delete a webhook.
      if (webhook.creatorId !== userId) {
        const canManageWebhooks = await hasPermission(userId, webhook.guildId, Permissions.MANAGE_WEBHOOKS);
        if (!canManageWebhooks) {
          res.status(403).json({ error: 'Unauthorized — must be webhook creator or have MANAGE_WEBHOOKS permission' });
          return;
        }
      }

      await db.delete(webhooks).where(eq(webhooks.id, webhookId));
      res.json({ success: true });
    } catch (err) {
      logger.error('[webhooks] delete error:', err);
      res.status(500).json({ error: 'Failed to delete webhook' });
    }
  },
);

// POST /webhooks/:webhookId/:token — execute webhook (no auth required)
webhooksRouter.post(
  '/webhooks/:webhookId/:token',
  async (req: Request, res: Response) => {
    try {
      const webhookId = req.params.webhookId as string;
      const token = req.params.token as string;
      const { content, username, avatarUrl } = req.body;

      // Rate limit: max 5 executions per webhook per 10 seconds
      const now = Date.now();
      const rl = webhookRateLimits.get(webhookId);
      if (rl && now < rl.resetAt) {
        if (rl.count >= 5) {
          res.status(429).json({ error: 'Rate limit exceeded. Max 5 requests per 10 seconds.' });
          return;
        }
        rl.count++;
      } else {
        webhookRateLimits.set(webhookId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
      }

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

      const displayName = (username || webhook.name).slice(0, 80);
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
      } catch (err) {
        logger.debug({ msg: 'socket emit failed', event: 'MESSAGE_CREATE webhook', err });
      }

      res.status(201).json(msg);
    } catch (err) {
      logger.error('[webhooks] execute error:', err);
      res.status(500).json({ error: 'Webhook execution failed' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /webhooks/:webhookId/deliveries — delivery logs (auth required)
// ---------------------------------------------------------------------------

webhooksRouter.get(
  '/webhooks/:webhookId/deliveries',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const webhookId = req.params.webhookId as string;
      const [webhook] = await db
        .select()
        .from(webhooks)
        .where(eq(webhooks.id, webhookId))
        .limit(1);
      if (!webhook) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Webhook not found' });
        return;
      }
      // Verify membership
      const [member] = await db
        .select()
        .from(guildMembers)
        .where(and(eq(guildMembers.guildId, webhook.guildId), eq(guildMembers.userId, req.userId!)))
        .limit(1);
      if (!member) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'Not a member' });
        return;
      }
      const logs = await db
        .select()
        .from(webhookDeliveryLogs)
        .where(eq(webhookDeliveryLogs.webhookId, webhookId))
        .orderBy(desc(webhookDeliveryLogs.attemptedAt))
        .limit(50);
      res.json(logs);
    } catch (err) {
      logger.error('[webhooks] delivery logs error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);
