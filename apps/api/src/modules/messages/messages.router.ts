import { Router } from 'express';
import type { AppContext } from '../../lib/context.js';
import { requireAuth } from '../../middleware/auth.js';
import { messageRateLimiter } from '../../middleware/rate-limiter.js';
import { createMessagesService } from './messages.service.js';
import { createChannelsService } from '../channels/channels.service.js';
import { createGuildsService } from '../guilds/guilds.service.js';
import { createMessageSchema, updateMessageSchema, getMessagesSchema } from './messages.schemas.js';

export function messagesRouter(ctx: AppContext): Router {
  const router = Router();
  const messagesService = createMessagesService(ctx);
  const channelsService = createChannelsService(ctx);
  const guildsService = createGuildsService(ctx);
  const auth = requireAuth(ctx);

  // Helper: check the caller has access to the channel
  async function checkChannelAccess(channelId: string, userId: string) {
    const channel = await channelsService.getChannel(channelId);
    if (!channel) return null;
    if (channel.guildId) {
      const isMember = await guildsService.isMember(channel.guildId, userId);
      if (!isMember) return null;
    }
    return channel;
  }

  // ── Get messages ─────────────────────────────────────────────────────────

  router.get('/channels/:channelId/messages', auth, async (req, res) => {
    const channelId = req.params.channelId;
    const channel = await checkChannelAccess(channelId, req.user!.userId);
    if (!channel) return res.status(403).json({ code: 'FORBIDDEN' });

    const parsed = getMessagesSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', errors: parsed.error.flatten().fieldErrors });
    }

    const msgs = await messagesService.getMessages(channelId, parsed.data);
    res.json(msgs);
  });

  // ── Get single message ───────────────────────────────────────────────────

  router.get('/channels/:channelId/messages/:messageId', auth, async (req, res) => {
    const channelId = req.params.channelId;
    const channel = await checkChannelAccess(channelId, req.user!.userId);
    if (!channel) return res.status(403).json({ code: 'FORBIDDEN' });

    const message = await messagesService.getMessage(req.params.messageId);
    if (!message || message.channelId !== channelId) {
      return res.status(404).json({ code: 'NOT_FOUND' });
    }

    res.json(message);
  });

  // ── Send message ─────────────────────────────────────────────────────────

  router.post('/channels/:channelId/messages', auth, messageRateLimiter, async (req, res) => {
    const channelId = req.params.channelId;
    const channel = await checkChannelAccess(channelId, req.user!.userId);
    if (!channel) return res.status(403).json({ code: 'FORBIDDEN' });

    const parsed = createMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', errors: parsed.error.flatten().fieldErrors });
    }

    const message = await messagesService.createMessage(
      channelId,
      req.user!.userId,
      channel.guildId ?? null,
      parsed.data,
    );

    // Broadcast via Socket.IO
    if (channel.guildId) {
      ctx.io.to(`guild:${channel.guildId}`).emit('MESSAGE_CREATE', message as any);
    } else {
      // DM channel — emit to each participant
      ctx.io.to(`channel:${channelId}`).emit('MESSAGE_CREATE', message as any);
    }

    // Publish to Redis for cross-server fanout
    await ctx.redis.publish(
      `channel:${channelId}:messages`,
      JSON.stringify({ type: 'MESSAGE_CREATE', data: message }),
    );

    res.status(201).json(message);
  });

  // ── Edit message ─────────────────────────────────────────────────────────

  router.patch('/channels/:channelId/messages/:messageId', auth, async (req, res) => {
    const channelId = req.params.channelId;
    const channel = await checkChannelAccess(channelId, req.user!.userId);
    if (!channel) return res.status(403).json({ code: 'FORBIDDEN' });

    const parsed = updateMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', errors: parsed.error.flatten().fieldErrors });
    }

    const result = await messagesService.updateMessage(
      req.params.messageId,
      req.user!.userId,
      parsed.data,
    );

    if (!result) return res.status(404).json({ code: 'NOT_FOUND' });
    if ('error' in result) return res.status(403).json({ code: result.error });

    if (channel.guildId) {
      ctx.io.to(`guild:${channel.guildId}`).emit('MESSAGE_UPDATE', result as any);
    } else {
      ctx.io.to(`channel:${channelId}`).emit('MESSAGE_UPDATE', result as any);
    }

    res.json(result);
  });

  // ── Delete message ───────────────────────────────────────────────────────

  router.delete('/channels/:channelId/messages/:messageId', auth, async (req, res) => {
    const channelId = req.params.channelId;
    const channel = await checkChannelAccess(channelId, req.user!.userId);
    if (!channel) return res.status(403).json({ code: 'FORBIDDEN' });

    // Check if user is message author or server owner (admin)
    let isAdmin = false;
    if (channel.guildId) {
      const guild = await guildsService.getGuild(channel.guildId);
      isAdmin = guild?.ownerId === req.user!.userId;
    }

    const result = await messagesService.deleteMessage(
      req.params.messageId,
      req.user!.userId,
      isAdmin,
    );

    if (!result) return res.status(404).json({ code: 'NOT_FOUND' });
    if ('error' in result) return res.status(403).json({ code: result.error });

    const deleteEvent = {
      id: req.params.messageId,
      channelId,
      guildId: channel.guildId ?? undefined,
    };

    if (channel.guildId) {
      ctx.io.to(`guild:${channel.guildId}`).emit('MESSAGE_DELETE', deleteEvent);
    } else {
      ctx.io.to(`channel:${channelId}`).emit('MESSAGE_DELETE', deleteEvent);
    }

    res.status(204).send();
  });

  // ── Reactions ────────────────────────────────────────────────────────────

  // Add reaction
  router.put('/channels/:channelId/messages/:messageId/reactions/:emoji/@me', auth, async (req, res) => {
    const channelId = req.params.channelId;
    const channel = await checkChannelAccess(channelId, req.user!.userId);
    if (!channel) return res.status(403).json({ code: 'FORBIDDEN' });

    const emojiName = decodeURIComponent(req.params.emoji);
    const added = await messagesService.addReaction(
      req.params.messageId,
      req.user!.userId,
      emojiName,
    );

    if (added && channel.guildId) {
      ctx.io.to(`guild:${channel.guildId}`).emit('MESSAGE_REACTION_ADD', {
        messageId: req.params.messageId,
        channelId,
        userId: req.user!.userId,
        emoji: { id: null, name: emojiName },
        burst: false,
      });
    }

    res.status(204).send();
  });

  // Remove reaction
  router.delete('/channels/:channelId/messages/:messageId/reactions/:emoji/@me', auth, async (req, res) => {
    const channelId = req.params.channelId;
    const channel = await checkChannelAccess(channelId, req.user!.userId);
    if (!channel) return res.status(403).json({ code: 'FORBIDDEN' });

    const emojiName = decodeURIComponent(req.params.emoji);
    await messagesService.removeReaction(
      req.params.messageId,
      req.user!.userId,
      emojiName,
    );

    if (channel.guildId) {
      ctx.io.to(`guild:${channel.guildId}`).emit('MESSAGE_REACTION_REMOVE', {
        messageId: req.params.messageId,
        channelId,
        userId: req.user!.userId,
        emoji: { id: null, name: emojiName },
      });
    }

    res.status(204).send();
  });

  // Get reactions for a message
  router.get('/channels/:channelId/messages/:messageId/reactions', auth, async (req, res) => {
    const channelId = req.params.channelId;
    const channel = await checkChannelAccess(channelId, req.user!.userId);
    if (!channel) return res.status(403).json({ code: 'FORBIDDEN' });

    const reactions = await messagesService.getReactions(req.params.messageId);
    res.json(reactions);
  });

  // ── Pins ─────────────────────────────────────────────────────────────────

  // Get pinned messages
  router.get('/channels/:channelId/pins', auth, async (req, res) => {
    const channelId = req.params.channelId;
    const channel = await checkChannelAccess(channelId, req.user!.userId);
    if (!channel) return res.status(403).json({ code: 'FORBIDDEN' });

    const pins = await messagesService.getPins(channelId);
    res.json(pins);
  });

  // Pin a message
  router.put('/channels/:channelId/pins/:messageId', auth, async (req, res) => {
    const channelId = req.params.channelId;
    const channel = await checkChannelAccess(channelId, req.user!.userId);
    if (!channel) return res.status(403).json({ code: 'FORBIDDEN' });

    // TODO: Check MANAGE_MESSAGES permission
    const result = await messagesService.pinMessage(channelId, req.params.messageId, req.user!.userId);

    if (result && typeof result === 'object' && 'error' in result) {
      return res.status(400).json({ code: result.error });
    }

    if (channel.guildId) {
      ctx.io.to(`guild:${channel.guildId}`).emit('CHANNEL_PINS_UPDATE', {
        channelId,
        lastPinTimestamp: new Date().toISOString(),
      });
    }

    res.status(204).send();
  });

  // Unpin a message
  router.delete('/channels/:channelId/pins/:messageId', auth, async (req, res) => {
    const channelId = req.params.channelId;
    const channel = await checkChannelAccess(channelId, req.user!.userId);
    if (!channel) return res.status(403).json({ code: 'FORBIDDEN' });

    await messagesService.unpinMessage(channelId, req.params.messageId);

    if (channel.guildId) {
      ctx.io.to(`guild:${channel.guildId}`).emit('CHANNEL_PINS_UPDATE', {
        channelId,
        lastPinTimestamp: new Date().toISOString(),
      });
    }

    res.status(204).send();
  });

  return router;
}
