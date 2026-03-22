/**
 * routes/messages.ts — Express router for message CRUD and typing indicators.
 *
 * Mounted at /api/v1/channels/:channelId/messages in src/routes/index.ts with
 * `mergeParams: true` so that `:channelId` from the parent router is visible
 * inside this router's handlers via `req.params.channelId`.
 *
 * Endpoints:
 *   GET    /                — Fetch messages with cursor pagination (newest first)
 *   POST   /                — Send a new message; emits `message:new` via Socket.io
 *   PATCH  /:messageId      — Edit a message (author only); emits `message:update`
 *   DELETE /:messageId      — Delete a message (author or guild owner); emits `message:delete`
 *   POST   /typing          — Broadcast typing indicator; emits `typing:start`
 *
 * All routes require authentication. Access to a channel is gated by
 * `canAccessChannel` — the user must be a guild member (guild channels) or a
 * DM participant (DM channels).
 *
 * Socket.io events emitted by this router:
 *   MESSAGE_CREATE — Payload: full message object with embedded author info
 *   MESSAGE_UPDATE — Payload: updated message object with embedded author info
 *   MESSAGE_DELETE — Payload: { id: string, channelId: string }
 *   TYPING_START   — Payload: { userId: string, channelId: string }
 *
 * @module routes/messages
 */

import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { z } from 'zod';
import { eq, and, lt, gt, desc, isNull, or, sql } from 'drizzle-orm';

import { db } from '../db/index';
import { messages } from '../db/schema/messages';
import { channels } from '../db/schema/channels';
import { dmChannelMembers } from '../db/schema/channels';
import { dmReadState } from '../db/schema/dm-read-state';
import { channelReadState } from '../db/schema/channel-read-state';
import { files } from '../db/schema/files';
import { users } from '../db/schema/users';
import { guilds } from '../db/schema/guilds';
import { guildMembers } from '../db/schema/guilds';
import { messageReactions } from '../db/schema/reactions';
import { channelPins } from '../db/schema/pins';
import { threads } from '../db/schema/threads';
import { messageEditHistory } from '../db/schema/messageEditHistory';
import { inArray } from 'drizzle-orm';
import { Permissions } from '../db/schema/roles';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { messageRateLimit } from '../middleware/rateLimit';
import { getIO } from '../lib/socket-io';
import { hasPermission, hasChannelPermission } from './roles';
import { createNotification } from '../lib/notifications';
import { dispatchMessageCreate, dispatchEvent } from '../lib/webhook-dispatch';
import { scrapeUrl, extractUrls } from '../lib/og-scraper';
import { redis } from '../lib/redis';
import { workflows, workflowTriggers, workflowActions } from '../db/schema/workflows';
import { automodRules } from '../db/schema/automod-rules';
import { scheduledMessages } from '../db/schema/scheduled-messages';
import { messageDrafts } from '../db/schema/message-drafts';
import { guildWordFilters } from '../db/schema/guild-word-filters';
import { messagesSentTotal } from '../lib/metrics';
import { AppError, handleAppError } from '../lib/errors.js';
import { safeJsonParse } from '../lib/safe-json.js';
import { incrementChallengeProgress } from './daily-challenges';
import { messageService, ServiceError } from '../services/message.service';

/** Use mergeParams so `:channelId` from the parent mount path is accessible. */
export const messagesRouter = Router({ mergeParams: true });

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * resolveChannel — Fetch a channel row and verify the user has access.
 *
 * For guild channels: user must be a guild member.
 * For DM channels: user must be a dm_channel_members participant.
 *
 * @param channelId - UUID of the channel.
 * @param userId    - UUID of the authenticated user.
 * @returns         The channel row.
 * @throws {AppError} 404 if channel not found, 403 if no access.
 */
async function resolveChannel(
  channelId: string,
  userId: string,
): Promise<typeof channels.$inferSelect> {
  const [channel] = await db
    .select()
    .from(channels)
    .where(eq(channels.id, channelId))
    .limit(1);

  if (!channel) {
    throw new AppError(404, 'Channel not found', 'NOT_FOUND');
  }

  if (channel.guildId) {
    // Guild channel — verify membership.
    const [membership] = await db
      .select({ id: guildMembers.id })
      .from(guildMembers)
      .where(and(eq(guildMembers.guildId, channel.guildId), eq(guildMembers.userId, userId)))
      .limit(1);

    if (!membership) {
      throw new AppError(403, 'You are not a member of this guild', 'FORBIDDEN');
    }
  } else {
    // DM channel — verify participation.
    const [participation] = await db
      .select({ id: dmChannelMembers.id })
      .from(dmChannelMembers)
      .where(and(eq(dmChannelMembers.channelId, channelId), eq(dmChannelMembers.userId, userId)))
      .limit(1);

    if (!participation) {
      throw new AppError(403, 'You do not have access to this channel', 'FORBIDDEN');
    }
  }

  return channel;
}

/**
 * formatMessage — Shape a database message row for API responses.
 *
 * Embeds the `author` object inline so clients don't need to make a
 * separate request to resolve the author's display name and avatar.
 *
 * @param msg    - The message row from the database.
 * @param author - The author's user row (may be null for deleted accounts).
 * @returns      An object suitable for JSON serialisation in API responses.
 */
function formatMessage(
  msg: typeof messages.$inferSelect,
  author: Pick<typeof users.$inferSelect, 'id' | 'username' | 'displayName' | 'avatarHash' | 'nameplateStyle'> & { isBot?: boolean } | null,
) {
  return {
    id: msg.id,
    channelId: msg.channelId,
    authorId: msg.authorId,
    content: msg.content,
    attachments: msg.attachments,
    edited: msg.edited,
    editedAt: msg.editedAt,
    createdAt: msg.createdAt,
    embeds: msg.embeds ?? [],
    components: msg.components ?? [],
    expiresAt: msg.expiresAt ?? null,
    replyToId: msg.replyToId ?? null,
    isEncrypted: msg.isEncrypted ?? false,
    encryptedContent: msg.encryptedContent ?? null,
    keyVersion: msg.keyVersion ?? null,
    author: author
      ? {
          id: author.id,
          username: author.username,
          displayName: author.displayName,
          avatarHash: author.avatarHash,
          nameplateStyle: author.nameplateStyle ?? 'none',
          isBot: author.isBot ?? false,
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

/**
 * Schema for POST / — send message.
 * At least one of `content` or `attachmentIds` must be present.
 */
const sendMessageSchema = z
  .object({
    content: z.string().min(1).max(2000).optional().nullable(),
    attachmentIds: z.array(z.string().uuid()).optional(),
    replyToId: z.string().uuid().optional(),
    threadId: z.string().uuid().optional(),
    expiresIn: z.number().int().positive().max(60 * 60 * 24 * 30).optional(), // seconds, max 30 days
    scheduledAt: z.string().datetime().optional(), // ISO 8601 date for scheduled messages
    forwardedFromMessageId: z.string().uuid().optional(),
    isEncrypted: z.boolean().optional(),
    encryptedContent: z.string().optional(),
    keyVersion: z.number().int().optional(),
    embeds: z.array(z.object({
      type: z.literal('rich'),
      title: z.string().max(256).optional(),
      description: z.string().max(4096).optional(),
      url: z.string().max(2000).optional(),
      color: z.string().max(7).optional(),
      image: z.string().max(2000).optional(),
      thumbnail: z.string().max(2000).optional(),
      fields: z.array(z.object({
        name: z.string().max(256),
        value: z.string().max(1024),
        inline: z.boolean().optional(),
      })).max(25).optional(),
    })).max(5).optional(),
  })
  .refine((d) => d.content || (d.attachmentIds && d.attachmentIds.length > 0) || (d.isEncrypted && d.encryptedContent) || (d.embeds && d.embeds.length > 0), {
    message: 'Message must have content, at least one attachment, encrypted content, or embeds',
  });

/**
 * Schema for PATCH /:messageId — edit message.
 */
const editMessageSchema = z.object({
  content: z.string().min(1).max(2000).optional(),
  encryptedContent: z.string().optional(),
  isEncrypted: z.boolean().optional(),
  keyVersion: z.number().int().optional(),
}).refine((d) => d.content !== undefined || d.isEncrypted, {
  message: 'Edit must have content or be an encrypted update',
});

// ---------------------------------------------------------------------------
// GET /
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/channels/:channelId/messages
 *
 * Fetch messages in a channel using cursor-based pagination. Messages are
 * returned newest-first. Provide `?before=<messageId>` to fetch messages
 * older than the given message ID. The cursor is based on `created_at` /
 * `id` to avoid skipping messages created at the same millisecond.
 *
 * Author info is included inline (joined from `users` table). If the author's
 * account has been deleted, `author` is null.
 *
 * @auth    requireAuth, canAccessChannel
 * @param   channelId {string}    — Channel UUID (from parent router path)
 * @query   before?   {string}    — Message UUID cursor; fetch messages older than this
 * @query   limit?    {number}    — Max results (default 50, max 100)
 * @returns 200 Array of message objects with embedded author info, newest first
 * @returns 403 No access to channel
 * @returns 404 Channel not found
 */
messagesRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelId } = req.params as Record<string, string>;
    const limitParam = Number(req.query.limit) || 50;
    const beforeId = typeof req.query.before === 'string' ? req.query.before : undefined;

    const result = await messageService.getMessages(channelId, req.userId!, {
      before: beforeId,
      limit: limitParam,
    });

    res.status(200).json(result);
  } catch (err) {
    if (err instanceof ServiceError) {
      const status = err.code === 'NOT_FOUND' ? 404 : err.code === 'FORBIDDEN' ? 403 : 400;
      res.status(status).json({ code: err.code, message: err.message });
      return;
    }
    handleAppError(res, err, 'messages');
  }
});

// ---------------------------------------------------------------------------
// GET /jump-to-date
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/channels/:channelId/messages/jump-to-date
 *
 * Find the first message on or after a given date and return a window of
 * messages around it (25 before + target + 25 after = ~51 messages).
 * Used by the "Jump to Date" calendar picker.
 *
 * @auth    requireAuth, canAccessChannel
 * @param   channelId {string}    — Channel UUID (from parent router path)
 * @query   date      {string}    — ISO date string (YYYY-MM-DD or full ISO 8601)
 * @returns 200 { targetMessageId, messages: [...] }
 * @returns 400 Missing or invalid date
 * @returns 404 No messages found on or after date
 */
messagesRouter.get('/jump-to-date', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelId } = req.params as Record<string, string>;
    await resolveChannel(channelId, req.userId!);

    const dateStr = typeof req.query.date === 'string' ? req.query.date : undefined;
    if (!dateStr) {
      res.status(400).json({ error: 'Missing required query parameter: date' });
      return;
    }

    const targetDate = new Date(dateStr);
    if (isNaN(targetDate.getTime())) {
      res.status(400).json({ error: 'Invalid date format' });
      return;
    }

    // Find the first message on or after the target date
    const [targetMsg] = await db
      .select({ id: messages.id, createdAt: messages.createdAt })
      .from(messages)
      .where(
        and(
          eq(messages.channelId, channelId),
          gt(messages.createdAt, targetDate),
          or(isNull(messages.threadId), sql`${messages.id} IN (SELECT origin_message_id FROM threads WHERE origin_message_id IS NOT NULL)`),
          or(isNull(messages.expiresAt), gt(messages.expiresAt, new Date())),
        ),
      )
      .orderBy(messages.createdAt)
      .limit(1);

    if (!targetMsg) {
      res.status(404).json({ error: 'No messages found on or after this date' });
      return;
    }

    // Fetch 25 messages before and 25 after the target (inclusive)
    const [beforeRows, afterRows] = await Promise.all([
      db
        .select({
          id: messages.id, channelId: messages.channelId, content: messages.content,
          attachments: messages.attachments, edited: messages.edited, editedAt: messages.editedAt,
          createdAt: messages.createdAt, expiresAt: messages.expiresAt, replyToId: messages.replyToId,
          embeds: messages.embeds, isEncrypted: messages.isEncrypted, encryptedContent: messages.encryptedContent,
          keyVersion: messages.keyVersion, authorId: messages.authorId,
          authorUsername: users.username, authorDisplayName: users.displayName,
          authorAvatarHash: users.avatarHash, authorNameplateStyle: users.nameplateStyle, authorIsBot: users.isBot,
        })
        .from(messages)
        .leftJoin(users, eq(users.id, messages.authorId))
        .where(
          and(
            eq(messages.channelId, channelId),
            lt(messages.createdAt, targetMsg.createdAt),
            or(isNull(messages.threadId), sql`${messages.id} IN (SELECT origin_message_id FROM threads WHERE origin_message_id IS NOT NULL)`),
            or(isNull(messages.expiresAt), gt(messages.expiresAt, new Date())),
          ),
        )
        .orderBy(desc(messages.createdAt))
        .limit(25),
      db
        .select({
          id: messages.id, channelId: messages.channelId, content: messages.content,
          attachments: messages.attachments, edited: messages.edited, editedAt: messages.editedAt,
          createdAt: messages.createdAt, expiresAt: messages.expiresAt, replyToId: messages.replyToId,
          embeds: messages.embeds, isEncrypted: messages.isEncrypted, encryptedContent: messages.encryptedContent,
          keyVersion: messages.keyVersion, authorId: messages.authorId,
          authorUsername: users.username, authorDisplayName: users.displayName,
          authorAvatarHash: users.avatarHash, authorNameplateStyle: users.nameplateStyle, authorIsBot: users.isBot,
        })
        .from(messages)
        .leftJoin(users, eq(users.id, messages.authorId))
        .where(
          and(
            eq(messages.channelId, channelId),
            gt(messages.createdAt, targetMsg.createdAt),
            or(isNull(messages.threadId), sql`${messages.id} IN (SELECT origin_message_id FROM threads WHERE origin_message_id IS NOT NULL)`),
            or(isNull(messages.expiresAt), gt(messages.expiresAt, new Date())),
          ),
        )
        .orderBy(messages.createdAt)
        .limit(25),
    ]);

    // Also fetch the target message itself
    const [targetRow] = await db
      .select({
        id: messages.id, channelId: messages.channelId, content: messages.content,
        attachments: messages.attachments, edited: messages.edited, editedAt: messages.editedAt,
        createdAt: messages.createdAt, expiresAt: messages.expiresAt, replyToId: messages.replyToId,
        embeds: messages.embeds, isEncrypted: messages.isEncrypted, encryptedContent: messages.encryptedContent,
        keyVersion: messages.keyVersion, authorId: messages.authorId,
        authorUsername: users.username, authorDisplayName: users.displayName,
        authorAvatarHash: users.avatarHash, authorNameplateStyle: users.nameplateStyle, authorIsBot: users.isBot,
      })
      .from(messages)
      .leftJoin(users, eq(users.id, messages.authorId))
      .where(eq(messages.id, targetMsg.id))
      .limit(1);

    // Combine: before (reversed to chronological) + target + after
    const allRows = [...beforeRows.reverse(), ...(targetRow ? [targetRow] : []), ...afterRows];

    // Fetch reactions for all returned messages
    const messageIds = allRows.map((r) => r.id);
    let reactionRows: { messageId: string; userId: string; emoji: string }[] = [];
    if (messageIds.length > 0) {
      reactionRows = await db
        .select({ messageId: messageReactions.messageId, userId: messageReactions.userId, emoji: messageReactions.emoji })
        .from(messageReactions)
        .where(inArray(messageReactions.messageId, messageIds));
    }
    const reactionsByMessage = new Map<string, Map<string, { emoji: string; count: number; userIds: string[] }>>();
    for (const r of reactionRows) {
      if (!reactionsByMessage.has(r.messageId)) reactionsByMessage.set(r.messageId, new Map());
      const emojiMap = reactionsByMessage.get(r.messageId)!;
      if (!emojiMap.has(r.emoji)) emojiMap.set(r.emoji, { emoji: r.emoji, count: 0, userIds: [] });
      const entry = emojiMap.get(r.emoji)!;
      entry.count++;
      entry.userIds.push(r.userId);
    }

    const formatted = allRows.map((row) => {
      const emojiMap = reactionsByMessage.get(row.id);
      const reactions = emojiMap
        ? Array.from(emojiMap.values()).map((e) => ({
            emoji: e.emoji,
            count: e.count,
            me: e.userIds.includes(req.userId!),
          }))
        : [];

      return {
        id: row.id,
        channelId: row.channelId,
        authorId: row.authorId,
        content: row.content,
        attachments: row.attachments,
        edited: row.edited,
        editedAt: row.editedAt,
        createdAt: row.createdAt,
        embeds: row.embeds ?? [],
        expiresAt: row.expiresAt ?? null,
        replyToId: row.replyToId ?? null,
        isEncrypted: row.isEncrypted ?? false,
        encryptedContent: row.encryptedContent ?? null,
        keyVersion: row.keyVersion ?? null,
        reactions,
        author: row.authorId
          ? {
              id: row.authorId,
              username: row.authorUsername,
              displayName: row.authorDisplayName,
              avatarHash: row.authorAvatarHash,
              nameplateStyle: row.authorNameplateStyle ?? 'none',
              isBot: row.authorIsBot ?? false,
            }
          : null,
      };
    });

    res.status(200).json({
      targetMessageId: targetMsg.id,
      messages: formatted,
    });
  } catch (err) {
    handleAppError(res, err, 'messages');
  }
});

// ---------------------------------------------------------------------------
// GET /jump-to-message
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/channels/:channelId/messages/jump-to-message
 *
 * Given a specific message ID, return a window of messages around it
 * (25 before + target + 25 after = ~51 messages).
 * Used for notification click-through and search result navigation.
 *
 * @auth    requireAuth, canAccessChannel
 * @param   channelId {string}    — Channel UUID (from parent router path)
 * @query   messageId {string}    — Target message UUID
 * @returns 200 { targetMessageId, messages: [...] }
 * @returns 400 Missing messageId
 * @returns 404 Message not found in this channel
 */
messagesRouter.get('/jump-to-message', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelId } = req.params as Record<string, string>;
    await resolveChannel(channelId, req.userId!);

    const messageId = typeof req.query.messageId === 'string' ? req.query.messageId : undefined;
    if (!messageId) {
      res.status(400).json({ error: 'Missing required query parameter: messageId' });
      return;
    }

    // Find the target message and verify it belongs to this channel
    const [targetMsg] = await db
      .select({ id: messages.id, createdAt: messages.createdAt })
      .from(messages)
      .where(
        and(
          eq(messages.id, messageId),
          eq(messages.channelId, channelId),
          or(isNull(messages.expiresAt), gt(messages.expiresAt, new Date())),
        ),
      )
      .limit(1);

    if (!targetMsg) {
      res.status(404).json({ error: 'Message not found in this channel' });
      return;
    }

    // Fetch 25 messages before and 25 after the target (inclusive)
    const [beforeRows, afterRows] = await Promise.all([
      db
        .select({
          id: messages.id, channelId: messages.channelId, content: messages.content,
          attachments: messages.attachments, edited: messages.edited, editedAt: messages.editedAt,
          createdAt: messages.createdAt, expiresAt: messages.expiresAt, replyToId: messages.replyToId,
          embeds: messages.embeds, isEncrypted: messages.isEncrypted, encryptedContent: messages.encryptedContent,
          keyVersion: messages.keyVersion, authorId: messages.authorId,
          authorUsername: users.username, authorDisplayName: users.displayName,
          authorAvatarHash: users.avatarHash, authorNameplateStyle: users.nameplateStyle, authorIsBot: users.isBot,
        })
        .from(messages)
        .leftJoin(users, eq(users.id, messages.authorId))
        .where(
          and(
            eq(messages.channelId, channelId),
            lt(messages.createdAt, targetMsg.createdAt),
            or(isNull(messages.threadId), sql`${messages.id} IN (SELECT origin_message_id FROM threads WHERE origin_message_id IS NOT NULL)`),
            or(isNull(messages.expiresAt), gt(messages.expiresAt, new Date())),
          ),
        )
        .orderBy(desc(messages.createdAt))
        .limit(25),
      db
        .select({
          id: messages.id, channelId: messages.channelId, content: messages.content,
          attachments: messages.attachments, edited: messages.edited, editedAt: messages.editedAt,
          createdAt: messages.createdAt, expiresAt: messages.expiresAt, replyToId: messages.replyToId,
          embeds: messages.embeds, isEncrypted: messages.isEncrypted, encryptedContent: messages.encryptedContent,
          keyVersion: messages.keyVersion, authorId: messages.authorId,
          authorUsername: users.username, authorDisplayName: users.displayName,
          authorAvatarHash: users.avatarHash, authorNameplateStyle: users.nameplateStyle, authorIsBot: users.isBot,
        })
        .from(messages)
        .leftJoin(users, eq(users.id, messages.authorId))
        .where(
          and(
            eq(messages.channelId, channelId),
            gt(messages.createdAt, targetMsg.createdAt),
            or(isNull(messages.threadId), sql`${messages.id} IN (SELECT origin_message_id FROM threads WHERE origin_message_id IS NOT NULL)`),
            or(isNull(messages.expiresAt), gt(messages.expiresAt, new Date())),
          ),
        )
        .orderBy(messages.createdAt)
        .limit(25),
    ]);

    // Also fetch the target message itself
    const [targetRow] = await db
      .select({
        id: messages.id, channelId: messages.channelId, content: messages.content,
        attachments: messages.attachments, edited: messages.edited, editedAt: messages.editedAt,
        createdAt: messages.createdAt, expiresAt: messages.expiresAt, replyToId: messages.replyToId,
        embeds: messages.embeds, isEncrypted: messages.isEncrypted, encryptedContent: messages.encryptedContent,
        keyVersion: messages.keyVersion, authorId: messages.authorId,
        authorUsername: users.username, authorDisplayName: users.displayName,
        authorAvatarHash: users.avatarHash, authorNameplateStyle: users.nameplateStyle, authorIsBot: users.isBot,
      })
      .from(messages)
      .leftJoin(users, eq(users.id, messages.authorId))
      .where(eq(messages.id, targetMsg.id))
      .limit(1);

    // Combine: before (reversed to chronological) + target + after
    const allRows = [...beforeRows.reverse(), ...(targetRow ? [targetRow] : []), ...afterRows];

    // Fetch reactions for all returned messages
    const messageIds = allRows.map((r) => r.id);
    let reactionRows: { messageId: string; userId: string; emoji: string }[] = [];
    if (messageIds.length > 0) {
      reactionRows = await db
        .select({ messageId: messageReactions.messageId, userId: messageReactions.userId, emoji: messageReactions.emoji })
        .from(messageReactions)
        .where(inArray(messageReactions.messageId, messageIds));
    }
    const reactionsByMessage = new Map<string, Map<string, { emoji: string; count: number; userIds: string[] }>>();
    for (const r of reactionRows) {
      if (!reactionsByMessage.has(r.messageId)) reactionsByMessage.set(r.messageId, new Map());
      const emojiMap = reactionsByMessage.get(r.messageId)!;
      if (!emojiMap.has(r.emoji)) emojiMap.set(r.emoji, { emoji: r.emoji, count: 0, userIds: [] });
      const entry = emojiMap.get(r.emoji)!;
      entry.count++;
      entry.userIds.push(r.userId);
    }

    const formatted = allRows.map((row) => {
      const emojiMap = reactionsByMessage.get(row.id);
      const reactions = emojiMap
        ? Array.from(emojiMap.values()).map((e) => ({
            emoji: e.emoji,
            count: e.count,
            me: e.userIds.includes(req.userId!),
          }))
        : [];

      return {
        id: row.id,
        channelId: row.channelId,
        authorId: row.authorId,
        content: row.content,
        attachments: row.attachments,
        edited: row.edited,
        editedAt: row.editedAt,
        createdAt: row.createdAt,
        embeds: row.embeds ?? [],
        expiresAt: row.expiresAt ?? null,
        replyToId: row.replyToId ?? null,
        isEncrypted: row.isEncrypted ?? false,
        encryptedContent: row.encryptedContent ?? null,
        keyVersion: row.keyVersion ?? null,
        reactions,
        author: row.authorId
          ? {
              id: row.authorId,
              username: row.authorUsername,
              displayName: row.authorDisplayName,
              avatarHash: row.authorAvatarHash,
              nameplateStyle: row.authorNameplateStyle ?? 'none',
              isBot: row.authorIsBot ?? false,
            }
          : null,
      };
    });

    res.status(200).json({
      targetMessageId: targetMsg.id,
      messages: formatted,
    });
  } catch (err) {
    handleAppError(res, err, 'messages');
  }
});

// ---------------------------------------------------------------------------
// POST /
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/channels/:channelId/messages
 *
 * Send a new message to the channel. At least one of `content` or
 * `attachmentIds` must be present. If `attachmentIds` is provided, the
 * referenced file records must exist and must have been uploaded by the
 * authenticated user — this prevents attaching other users' files.
 *
 * A `message:new` Socket.io event is emitted to the `channel:<channelId>`
 * room so connected clients receive the message in real time.
 *
 * @auth    requireAuth, canAccessChannel
 * @param   channelId {string}    — Channel UUID
 * @body    { content?: string, attachmentIds?: string[] }
 * @returns 201 Created message with embedded author info
 * @returns 400 Validation failure or invalid attachmentIds
 * @returns 403 No access to channel
 * @returns 404 Channel not found
 *
 * Side effects:
 *   - Inserts a row in `messages`.
 *   - Emits `message:new` to `channel:<channelId>` room via Socket.io.
 */
messagesRouter.post(
  '/',
  requireAuth,
  messageRateLimit,
  validate(sendMessageSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { channelId } = req.params as Record<string, string>;
      const body = req.body as z.infer<typeof sendMessageSchema>;

      const result = await messageService.createMessage(channelId, req.userId!, body);

      if (result.scheduled) {
        res.status(202).json(result.data);
      } else {
        res.status(201).json(result.data);
      }
    } catch (err) {
      if (err instanceof ServiceError) {
        const statusMap: Record<string, number> = {
          NOT_FOUND: 404,
          FORBIDDEN: 403,
          VALIDATION_ERROR: 400,
          AUTOMOD_BLOCKED: 403,
          BLOCKED_CONTENT: 400,
          WORD_FILTER_WARN: 400,
          RATE_LIMITED: 429,
        };
        const status = statusMap[err.code] ?? 400;
        if (err.code === 'RATE_LIMITED') {
          res.status(status).json({ error: 'SLOW_MODE', retryAfter: err.retryAfter });
        } else {
          res.status(status).json({ code: err.code, message: err.message });
        }
        return;
      }
      handleAppError(res, err, 'messages');
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /:messageId
// ---------------------------------------------------------------------------

/**
 * PATCH /api/v1/channels/:channelId/messages/:messageId
 *
 * Edit the content of an existing message. Only the original author may
 * edit their message. Sets `edited = true` and `editedAt = now()`.
 *
 * A `message:update` Socket.io event is emitted to the channel room.
 *
 * @auth    requireAuth, canAccessChannel, message author
 * @param   channelId {string}  — Channel UUID
 * @param   messageId {string}  — Message UUID
 * @body    { content: string } — New content (1–2000 chars)
 * @returns 200 Updated message with embedded author info
 * @returns 400 Validation failure
 * @returns 403 Not the message author or no channel access
 * @returns 404 Channel or message not found
 *
 * Side effects:
 *   - Updates `messages` row (content, edited, editedAt).
 *   - Emits `message:update` to `channel:<channelId>` via Socket.io.
 */
messagesRouter.patch(
  '/:messageId',
  requireAuth,
  validate(editMessageSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { channelId, messageId } = req.params as Record<string, string>;
      const body = req.body as z.infer<typeof editMessageSchema>;

      const payload = await messageService.updateMessage(channelId, messageId, req.userId!, body);

      res.status(200).json(payload);
    } catch (err) {
      if (err instanceof ServiceError) {
        const status = err.code === 'NOT_FOUND' ? 404 : err.code === 'FORBIDDEN' ? 403 : 400;
        res.status(status).json({ code: err.code, message: err.message });
        return;
      }
      handleAppError(res, err, 'messages');
    }
  },
);

// ---------------------------------------------------------------------------
// GET /:messageId/history — Fetch edit history for a message
// ---------------------------------------------------------------------------

messagesRouter.get(
  '/:messageId/history',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { channelId, messageId } = req.params as Record<string, string>;
      await resolveChannel(channelId, req.userId!);

      const history = await db
        .select()
        .from(messageEditHistory)
        .where(eq(messageEditHistory.messageId, messageId))
        .orderBy(desc(messageEditHistory.editedAt));

      res.status(200).json(history);
    } catch (err) {
      handleAppError(res, err, 'messages');
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /bulk — Bulk delete messages
// ---------------------------------------------------------------------------

messagesRouter.delete(
  '/bulk',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { channelId } = req.params as Record<string, string>;
      const { ids } = req.body as { ids: string[] };

      if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100) {
        res.status(400).json({ code: 'VALIDATION_ERROR', message: 'ids must be an array of 1-100 message IDs' });
        return;
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!ids.every((id: string) => uuidRegex.test(id))) {
        res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid message ID format' });
        return;
      }

      const channel = await resolveChannel(channelId, req.userId!);

      if (!channel.guildId) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'Bulk delete is only available in guild channels' });
        return;
      }

      const canManage = await hasPermission(req.userId!, channel.guildId, Permissions.MANAGE_MESSAGES);
      if (!canManage) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_MESSAGES permission' });
        return;
      }

      await db.delete(messages)
        .where(and(inArray(messages.id, ids), eq(messages.channelId, channelId)));

      for (const id of ids) {
        getIO().to(`channel:${channelId}`).emit('MESSAGE_DELETE', { id, channelId });
      }

      res.json({ deleted: ids.length });
    } catch (err) {
      handleAppError(res, err, 'messages');
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /:messageId
// ---------------------------------------------------------------------------

/**
 * DELETE /api/v1/channels/:channelId/messages/:messageId
 *
 * Delete a message. The caller must be either the message's author or
 * the guild owner (for guild channels). DM messages may only be deleted
 * by their author.
 *
 * A `message:delete` Socket.io event is emitted to the channel room.
 *
 * @auth    requireAuth, canAccessChannel, author or guild owner
 * @param   channelId {string} — Channel UUID
 * @param   messageId {string} — Message UUID
 * @returns 200 { message: 'Message deleted' }
 * @returns 403 Not the author or guild owner
 * @returns 404 Channel or message not found
 *
 * Side effects:
 *   - Deletes the `messages` row.
 *   - Emits `message:delete` to `channel:<channelId>` via Socket.io.
 */
messagesRouter.delete(
  '/:messageId',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { channelId, messageId } = req.params as Record<string, string>;

      await messageService.deleteMessage(channelId, messageId, req.userId!);

      res.status(200).json({ code: 'OK', message: 'Message deleted' });
    } catch (err) {
      if (err instanceof ServiceError) {
        const status = err.code === 'NOT_FOUND' ? 404 : err.code === 'FORBIDDEN' ? 403 : 400;
        res.status(status).json({ code: err.code, message: err.message });
        return;
      }
      handleAppError(res, err, 'messages');
    }
  },
);

// ---------------------------------------------------------------------------
// POST /typing
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/channels/:channelId/messages/typing
 *
 * Broadcast a typing indicator to all clients subscribed to the channel.
 * This endpoint is lightweight — it does not persist anything to the database.
 * Clients should call it periodically (e.g. every 5 seconds while the user is
 * typing) and stop calling it when the user sends the message or goes idle.
 *
 * @auth    requireAuth, canAccessChannel
 * @param   channelId {string} — Channel UUID
 * @returns 200 { ok: true }
 * @returns 403 No access to channel
 * @returns 404 Channel not found
 *
 * Side effects:
 *   - Emits `typing:start` to `channel:<channelId>` via Socket.io with
 *     payload `{ userId, channelId }`.
 */
messagesRouter.post('/typing', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelId } = req.params as Record<string, string>;
    await resolveChannel(channelId, req.userId!);

    try {
      const [userRow] = await db
        .select({ username: users.username })
        .from(users)
        .where(eq(users.id, req.userId!))
        .limit(1);
      const username = userRow?.username ?? 'Someone';

      getIO()
        .to(`channel:${channelId}`)
        .emit('TYPING_START', { userId: req.userId!, channelId, username });
    } catch (err) {
      logger.debug({ msg: 'socket emit failed', event: 'TYPING_START', err });
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    handleAppError(res, err, 'messages');
  }
});

// ---------------------------------------------------------------------------
// POST /ack  (Channel unread badges)
// ---------------------------------------------------------------------------

const ackSchema = z.object({
  lastMessageId: z.string().uuid().optional(),
});

messagesRouter.post('/ack', requireAuth, validate(ackSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelId } = req.params as Record<string, string>;
    await resolveChannel(channelId, req.userId!);

    const { lastMessageId } = req.body as z.infer<typeof ackSchema>;
    const now = new Date();

    await db
      .insert(channelReadState)
      .values({
        channelId,
        userId: req.userId!,
        lastReadAt: now,
        lastReadMessageId: lastMessageId ?? null,
        mentionCount: 0,
      })
      .onConflictDoUpdate({
        target: [channelReadState.channelId, channelReadState.userId],
        set: {
          lastReadAt: now,
          lastReadMessageId: lastMessageId ?? null,
          mentionCount: 0,
        },
      });

    res.status(204).end();
  } catch (err) {
    handleAppError(res, err, 'messages');
  }
});

// ---------------------------------------------------------------------------
// POST /read  (A1 — Read Receipts)
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/channels/:channelId/messages/read
 *
 * Mark the channel as read for the calling user up to the latest message.
 * Upserts a `dm_read_state` row. Emits `MESSAGE_READ` to the DM channel room
 * so the sender can update their read-receipt indicator in real time.
 *
 * Only meaningful for DM and GROUP_DM channels; silently succeeds for guild
 * channels (no read state stored, no event emitted).
 *
 * @auth    requireAuth
 * @body    { lastReadMessageId?: string } — optional, defaults to latest message
 * @returns 200 { ok: true }
 */
const readSchema = z.object({
  lastReadMessageId: z.string().uuid().optional(),
});

messagesRouter.post('/read', requireAuth, validate(readSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelId } = req.params as Record<string, string>;
    const channel = await resolveChannel(channelId, req.userId!);

    const { lastReadMessageId } = req.body as z.infer<typeof readSchema>;

    // Guild channel read receipts — track via channelReadState
    if (channel.guildId) {
      let resolvedId = lastReadMessageId;
      if (!resolvedId) {
        const [latest] = await db
          .select({ id: messages.id })
          .from(messages)
          .where(
            and(
              eq(messages.channelId, channelId),
              or(isNull(messages.expiresAt), gt(messages.expiresAt, new Date())),
            ),
          )
          .orderBy(desc(messages.createdAt))
          .limit(1);
        resolvedId = latest?.id;
      }

      const now = new Date();
      await db
        .insert(channelReadState)
        .values({
          channelId,
          userId: req.userId!,
          lastReadAt: now,
          lastReadMessageId: resolvedId ?? null,
          mentionCount: 0,
        })
        .onConflictDoUpdate({
          target: [channelReadState.channelId, channelReadState.userId],
          set: { lastReadAt: now, lastReadMessageId: resolvedId ?? null },
        });

      try {
        getIO().to(`channel:${channelId}`).emit('MESSAGE_READ', {
          channelId,
          userId: req.userId!,
          lastReadAt: now.toISOString(),
          lastReadMessageId: resolvedId ?? null,
        });
      } catch (err) { logger.debug({ msg: 'socket emit failed', event: 'MESSAGE_READ', err }); }

      res.status(200).json({ ok: true });
      return;
    }

    // Resolve the latest visible (non-expired) message ID if not provided.
    let resolvedMessageId = lastReadMessageId;
    if (!resolvedMessageId) {
      const [latest] = await db
        .select({ id: messages.id })
        .from(messages)
        .where(
          and(
            eq(messages.channelId, channelId),
            or(isNull(messages.expiresAt), gt(messages.expiresAt, new Date())),
          ),
        )
        .orderBy(desc(messages.createdAt))
        .limit(1);
      resolvedMessageId = latest?.id;
    }

    const now = new Date();

    await db
      .insert(dmReadState)
      .values({
        channelId,
        userId: req.userId!,
        lastReadAt: now,
        lastReadMessageId: resolvedMessageId ?? null,
      })
      .onConflictDoUpdate({
        target: [dmReadState.channelId, dmReadState.userId],
        set: {
          lastReadAt: now,
          lastReadMessageId: resolvedMessageId ?? null,
        },
      });

    try {
      getIO().to(`channel:${channelId}`).emit('MESSAGE_READ', {
        channelId,
        userId: req.userId!,
        lastReadAt: now.toISOString(),
        lastReadMessageId: resolvedMessageId ?? null,
      });

      // Emit DM_READ to the other participant (for read receipt indicator)
      const otherMembers = await db.select({ userId: dmChannelMembers.userId })
        .from(dmChannelMembers)
        .where(eq(dmChannelMembers.channelId, channelId));
      for (const member of otherMembers) {
        if (member.userId !== req.userId!) {
          getIO().to(`user:${member.userId}`).emit('DM_READ', {
            channelId, userId: req.userId!, lastReadMessageId: resolvedMessageId ?? null,
          });
        }
      }
    } catch (err) {
      logger.debug({ msg: 'socket emit failed', event: 'DM_READ', err });
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    handleAppError(res, err, 'messages');
  }
});

// ---------------------------------------------------------------------------
// GET /read-state  (A1 — Read Receipts)
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/channels/:channelId/messages/read-state
 *
 * Returns the read state for all participants of a DM channel.
 * Returns an empty array for guild channels.
 *
 * @auth    requireAuth
 * @returns 200 Array of { userId, lastReadAt, lastReadMessageId }
 */
messagesRouter.get('/read-state', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelId } = req.params as Record<string, string>;
    const channel = await resolveChannel(channelId, req.userId!);

    if (channel.guildId) {
      // Verify user is a guild member before exposing read receipts
      const [membership] = await db
        .select({ id: guildMembers.id })
        .from(guildMembers)
        .where(and(eq(guildMembers.guildId, channel.guildId), eq(guildMembers.userId, req.userId!)))
        .limit(1);
      if (!membership) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'Not a guild member' });
        return;
      }
      // Return recent read receipts (limit to 50 most recent to avoid large payloads)
      const guildRows = await db
        .select({
          userId: channelReadState.userId,
          lastReadAt: channelReadState.lastReadAt,
          lastReadMessageId: channelReadState.lastReadMessageId,
        })
        .from(channelReadState)
        .where(eq(channelReadState.channelId, channelId))
        .limit(50);
      res.status(200).json(guildRows);
      return;
    }

    const rows = await db
      .select({
        userId: dmReadState.userId,
        lastReadAt: dmReadState.lastReadAt,
        lastReadMessageId: dmReadState.lastReadMessageId,
      })
      .from(dmReadState)
      .where(eq(dmReadState.channelId, channelId));

    res.status(200).json(rows);
  } catch (err) {
    handleAppError(res, err, 'messages');
  }
});

// ---------------------------------------------------------------------------
// PATCH /disappear-timer  (A2 — Disappearing Messages)
// ---------------------------------------------------------------------------

/**
 * PATCH /api/v1/channels/:channelId/messages/disappear-timer
 *
 * Set or clear the disappearing-message timer for a DM or GROUP_DM channel.
 * After this is set, new messages will have `expiresAt` computed automatically.
 *
 * @auth    requireAuth (must be a participant in the channel)
 * @body    { seconds: number | null } — seconds until expiry; null to disable
 * @returns 200 { disappearTimer: number | null }
 */
const disappearTimerSchema = z.object({
  seconds: z.number().int().positive().nullable(),
});

messagesRouter.patch('/disappear-timer', requireAuth, validate(disappearTimerSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelId } = req.params as Record<string, string>;
    const channel = await resolveChannel(channelId, req.userId!);

    // Require MANAGE_CHANNELS permission for guild channels (any DM participant can set timer).
    if (channel.guildId) {
      const canManage = await hasChannelPermission(req.userId!, channel.guildId, channelId, Permissions.MANAGE_CHANNELS);
      if (!canManage) {
        throw new AppError(403, 'You need the Manage Channels permission to set disappearing messages in a guild channel', 'FORBIDDEN');
      }
    }

    const { seconds } = req.body as z.infer<typeof disappearTimerSchema>;

    const [updated] = await db
      .update(channels)
      .set({ disappearTimer: seconds })
      .where(eq(channels.id, channelId))
      .returning({ disappearTimer: channels.disappearTimer });

    res.status(200).json({ disappearTimer: updated.disappearTimer });
  } catch (err) {
    handleAppError(res, err, 'messages');
  }
});

// ---------------------------------------------------------------------------
// GET /scheduled — list pending scheduled messages for this channel (author only)
// ---------------------------------------------------------------------------
messagesRouter.get('/scheduled', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelId } = req.params as Record<string, string>;
    await resolveChannel(channelId, req.userId!);
    const rows = await db.select()
      .from(scheduledMessages)
      .where(and(
        eq(scheduledMessages.channelId, channelId),
        eq(scheduledMessages.authorId, req.userId!),
        isNull(scheduledMessages.sentAt),
        isNull(scheduledMessages.cancelledAt),
      ))
      .orderBy(scheduledMessages.scheduledAt)
      .limit(100);
    res.json(rows);
  } catch (err) {
    handleAppError(res, err, 'messages');
  }
});

// ---------------------------------------------------------------------------
// DELETE /scheduled/:id — cancel a scheduled message
// ---------------------------------------------------------------------------
messagesRouter.delete('/scheduled/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelId, id } = req.params as Record<string, string>;
    await resolveChannel(channelId, req.userId!);
    const [sm] = await db.select()
      .from(scheduledMessages)
      .where(and(eq(scheduledMessages.id, id), eq(scheduledMessages.channelId, channelId)))
      .limit(1);
    if (!sm) { res.status(404).json({ code: 'NOT_FOUND', message: 'Scheduled message not found' }); return; }
    if (sm.authorId !== req.userId) { res.status(403).json({ code: 'FORBIDDEN', message: 'Not your scheduled message' }); return; }
    if (sm.sentAt) { res.status(400).json({ code: 'ALREADY_SENT', message: 'Message has already been sent' }); return; }
    await db.update(scheduledMessages).set({ cancelledAt: new Date() }).where(eq(scheduledMessages.id, id));
    res.json({ ok: true });
  } catch (err) {
    handleAppError(res, err, 'messages');
  }
});

// ---------------------------------------------------------------------------
// POST /:messageId/translate — Translate a message via DeepL
// ---------------------------------------------------------------------------
messagesRouter.post('/:messageId/translate', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const messageId = req.params.messageId as string;
    const { targetLang = 'EN' } = req.body as { targetLang?: string };
    const [msg] = await db.select({ content: messages.content }).from(messages).where(eq(messages.id, messageId)).limit(1);
    if (!msg || !msg.content) { res.status(404).json({ code: 'NOT_FOUND', message: 'Message not found' }); return; }

    const cacheKey = `translate:${messageId}:${targetLang.toUpperCase()}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsed = safeJsonParse(cached, null);
      if (parsed) { res.json(parsed); return; }
    }

    const deeplKey = process.env.DEEPL_API_KEY;
    if (!deeplKey) {
      res.json({ translatedText: msg.content, detectedLanguage: 'EN' });
      return;
    }

    const deeplRes = await fetch(`https://api-free.deepl.com/v2/translate`, {
      method: 'POST',
      headers: { 'Authorization': `DeepL-Auth-Key ${deeplKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: [msg.content], target_lang: targetLang.toUpperCase() }),
    });

    if (!deeplRes.ok) {
      res.status(502).json({ code: 'TRANSLATION_FAILED', message: 'Translation service unavailable' });
      return;
    }

    const data = await deeplRes.json() as { translations: Array<{ text: string; detected_source_language: string }> };
    const result = { translatedText: data.translations[0].text, detectedLanguage: data.translations[0].detected_source_language };
    await redis.set(cacheKey, JSON.stringify(result), 'EX', 3600);
    res.json(result);
  } catch (err) {
    handleAppError(res, err, 'messages');
  }
});
