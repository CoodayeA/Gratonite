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
import { inArray } from 'drizzle-orm';
import { Permissions } from '../db/schema/roles';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { messageRateLimit } from '../middleware/rateLimit';
import { getIO } from '../lib/socket-io';
import { hasPermission, hasChannelPermission } from './roles';
import { createNotification } from '../lib/notifications';
import { dispatchMessageCreate } from '../lib/webhook-dispatch';
import { scrapeUrl, extractUrls } from '../lib/og-scraper';
import { redis } from '../lib/redis';
import { workflows, workflowTriggers, workflowActions } from '../db/schema/workflows';
import { automodRules } from '../db/schema/automod-rules';
import { scheduledMessages } from '../db/schema/scheduled-messages';
import { messageDrafts } from '../db/schema/message-drafts';
import { guildWordFilters } from '../db/schema/guild-word-filters';
import { messagesSentTotal } from '../lib/metrics';

/** Use mergeParams so `:channelId` from the parent mount path is accessible. */
export const messagesRouter = Router({ mergeParams: true });

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * AppError — Lightweight typed HTTP error.
 */
class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code: string = 'UNKNOWN_ERROR',
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * handleAppError — Shared error handler for message route handlers.
 *
 * @param res - Express Response.
 * @param err - The caught error.
 */
function handleAppError(res: Response, err: unknown): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ code: err.code, message: err.message });
  } else {
    console.error('[messages] unexpected error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
}

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
  author: Pick<typeof users.$inferSelect, 'id' | 'username' | 'displayName' | 'avatarHash' | 'nameplateStyle'> | null,
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
    expiresAt: msg.expiresAt ?? null,
    replyToId: msg.replyToId ?? null,
    author: author
      ? {
          id: author.id,
          username: author.username,
          displayName: author.displayName,
          avatarHash: author.avatarHash,
          nameplateStyle: author.nameplateStyle ?? 'none',
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
    content: z.string().min(1).max(2000).optional(),
    attachmentIds: z.array(z.string().uuid()).optional(),
    replyToId: z.string().uuid().optional(),
    threadId: z.string().uuid().optional(),
    expiresIn: z.number().int().positive().max(60 * 60 * 24 * 30).optional(), // seconds, max 30 days
    scheduledAt: z.string().datetime().optional(), // ISO 8601 date for scheduled messages
    forwardedFromMessageId: z.string().uuid().optional(),
  })
  .refine((d) => d.content !== undefined || (d.attachmentIds && d.attachmentIds.length > 0), {
    message: 'Message must have content or at least one attachment',
  });

/**
 * Schema for PATCH /:messageId — edit message.
 */
const editMessageSchema = z.object({
  content: z.string().min(1).max(2000),
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
    await resolveChannel(channelId, req.userId!);

    const limitParam = Number(req.query.limit) || 50;
    const limit = Math.min(limitParam, 100);
    const beforeId = typeof req.query.before === 'string' ? req.query.before : undefined;

    // Build cursor condition.
    let cursorCondition = undefined;
    if (beforeId) {
      // Fetch the cursor message's createdAt to build the keyset cursor.
      const [cursorMsg] = await db
        .select({ createdAt: messages.createdAt })
        .from(messages)
        .where(eq(messages.id, beforeId))
        .limit(1);

      if (cursorMsg) {
        cursorCondition = lt(messages.createdAt, cursorMsg.createdAt);
      }
    }

    const rows = await db
      .select({
        id: messages.id,
        channelId: messages.channelId,
        content: messages.content,
        attachments: messages.attachments,
        edited: messages.edited,
        editedAt: messages.editedAt,
        createdAt: messages.createdAt,
        expiresAt: messages.expiresAt,
        replyToId: messages.replyToId,
        embeds: messages.embeds,
        authorId: messages.authorId,
        authorUsername: users.username,
        authorDisplayName: users.displayName,
        authorAvatarHash: users.avatarHash,
        authorNameplateStyle: users.nameplateStyle,
      })
      .from(messages)
      .leftJoin(users, eq(users.id, messages.authorId))
      .where(
        and(
          eq(messages.channelId, channelId),
          or(isNull(messages.expiresAt), gt(messages.expiresAt, new Date())),
          ...(cursorCondition ? [cursorCondition] : []),
        ),
      )
      .orderBy(desc(messages.createdAt))
      .limit(limit);

    // Fetch reactions for all returned messages in one query
    const messageIds = rows.map((r) => r.id);
    let reactionRows: { messageId: string; userId: string; emoji: string }[] = [];
    if (messageIds.length > 0) {
      reactionRows = await db
        .select({ messageId: messageReactions.messageId, userId: messageReactions.userId, emoji: messageReactions.emoji })
        .from(messageReactions)
        .where(inArray(messageReactions.messageId, messageIds));
    }

    // Group reactions by messageId -> emoji
    const reactionsByMessage = new Map<string, Map<string, { emoji: string; count: number; userIds: string[] }>>();
    for (const r of reactionRows) {
      if (!reactionsByMessage.has(r.messageId)) reactionsByMessage.set(r.messageId, new Map());
      const emojiMap = reactionsByMessage.get(r.messageId)!;
      if (!emojiMap.has(r.emoji)) emojiMap.set(r.emoji, { emoji: r.emoji, count: 0, userIds: [] });
      const entry = emojiMap.get(r.emoji)!;
      entry.count++;
      entry.userIds.push(r.userId);
    }

    // Fetch pinned message IDs for this channel in one query
    let pinnedSet = new Set<string>();
    if (messageIds.length > 0) {
      const pinRows = await db
        .select({ messageId: channelPins.messageId })
        .from(channelPins)
        .where(inArray(channelPins.messageId, messageIds));
      pinnedSet = new Set(pinRows.map((p) => p.messageId));
    }

    // Fetch thread reply counts: count messages per thread, grouped by originMessageId
    const threadReplyCountMap = new Map<string, number>();
    if (messageIds.length > 0) {
      const threadRows = await db
        .select({
          originMessageId: threads.originMessageId,
          replyCount: sql<number>`cast(count(${messages.id}) as int)`,
        })
        .from(threads)
        .leftJoin(messages, eq(messages.threadId, threads.id))
        .where(inArray(threads.originMessageId, messageIds))
        .groupBy(threads.originMessageId);
      for (const t of threadRows) {
        if (t.originMessageId) threadReplyCountMap.set(t.originMessageId, t.replyCount ?? 0);
      }
    }

    const formatted = rows.map((row) => {
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
        pinned: pinnedSet.has(row.id),
        threadReplyCount: threadReplyCountMap.get(row.id) ?? 0,
        reactions,
        author: row.authorId
          ? {
              id: row.authorId,
              username: row.authorUsername,
              displayName: row.authorDisplayName,
              avatarHash: row.authorAvatarHash,
              nameplateStyle: row.authorNameplateStyle ?? 'none',
            }
          : null,
      };
    });

    res.status(200).json(formatted);
  } catch (err) {
    handleAppError(res, err);
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
      const channel = await resolveChannel(channelId, req.userId!);

      // Check SEND_MESSAGES permission for guild channels
      if (channel.guildId) {
        const canSend = await hasChannelPermission(req.userId!, channel.guildId, channelId, Permissions.SEND_MESSAGES);
        if (!canSend) {
          throw new AppError(403, 'Missing SEND_MESSAGES permission in this channel', 'FORBIDDEN');
        }
      }

      // Check if user is timed out in this guild
      if (channel.guildId) {
        const [member] = await db.select({ timeoutUntil: guildMembers.timeoutUntil })
          .from(guildMembers)
          .where(and(eq(guildMembers.guildId, channel.guildId), eq(guildMembers.userId, req.userId!)))
          .limit(1);
        if (member?.timeoutUntil && member.timeoutUntil > new Date()) {
          res.status(403).json({ code: 'FORBIDDEN', message: 'You are timed out in this server' });
          return;
        }
      }

      // Slow mode enforcement
      const [slowCh] = await db.select({ rateLimitPerUser: channels.rateLimitPerUser }).from(channels).where(eq(channels.id, channelId)).limit(1);
      if (slowCh?.rateLimitPerUser && slowCh.rateLimitPerUser > 0) {
        const slowKey = `slowmode:${channelId}:${req.userId}`;
        const remaining = await redis.ttl(slowKey);
        if (remaining > 0) {
          res.status(429).json({ error: 'SLOW_MODE', retryAfter: remaining }); return;
        }
      }

      const { content, attachmentIds, replyToId, threadId, expiresIn, scheduledAt, forwardedFromMessageId } = req.body as z.infer<typeof sendMessageSchema>;

      // Handle scheduled messages: insert into scheduled_messages instead of messages
      if (scheduledAt) {
        const scheduledDate = new Date(scheduledAt);
        if (scheduledDate <= new Date()) {
          res.status(400).json({ code: 'VALIDATION_ERROR', message: 'scheduledAt must be in the future' });
          return;
        }
        const [scheduled] = await db.insert(scheduledMessages).values({
          channelId,
          authorId: req.userId!,
          content: content ?? '',
          scheduledAt: scheduledDate,
        }).returning();
        res.status(202).json(scheduled);
        return;
      }

      // Automod check: check message content against enabled keyword rules
      if (channel.guildId && content) {
        try {
          const rules = await db.select().from(automodRules)
            .where(and(eq(automodRules.guildId, channel.guildId), eq(automodRules.enabled, true)));

          for (const rule of rules) {
            if (rule.triggerType !== 'KEYWORD') continue;
            const metadata = rule.triggerMetadata as { keywords?: string[] };
            const keywords: string[] = metadata?.keywords || [];
            const msgLower = content.toLowerCase();
            const matched = keywords.some((kw: string) => msgLower.includes(kw.toLowerCase()));
            if (!matched) continue;

            const actions = (rule.actions as Array<{ type: string; alertChannelId?: string }>) || [];
            for (const action of actions) {
              if (action.type === 'BLOCK_MESSAGE') {
                res.status(403).json({ code: 'AUTOMOD_BLOCKED', message: 'Message blocked by auto-moderation' });
                return;
              }
            }
          }
        } catch { /* automod should not break message sending */ }
      }

      // Word filter check
      if (channel.guildId && content) {
        try {
          const [wordFilter] = await db.select().from(guildWordFilters)
            .where(eq(guildWordFilters.guildId, channel.guildId!)).limit(1);
          if (wordFilter && wordFilter.words && wordFilter.words.length > 0) {
            const contentLower = content.toLowerCase();
            const matched = wordFilter.words.some((w: string) => contentLower.includes(w.toLowerCase()));
            if (matched && wordFilter.action === 'block') {
              res.status(400).json({ code: 'BLOCKED_CONTENT', message: 'Your message contains blocked words' });
              return;
            }
          }
        } catch { /* word filter should not break message sending */ }
      }

      // Resolve attachments and verify ownership.
      let attachmentSnapshot: Array<{
        id: string;
        url: string;
        filename: string;
        size: number;
        mimeType: string;
      }> = [];

      if (attachmentIds && attachmentIds.length > 0) {
        // Fetch all referenced files in one query.
        const fileRows = await db
          .select()
          .from(files)
          .where(
            or(
              ...attachmentIds.map((id) => eq(files.id, id)),
            ) as ReturnType<typeof eq>,
          );

        // Ensure all requested IDs were found and belong to this user.
        if (fileRows.length !== attachmentIds.length) {
          res.status(400).json({ code: 'VALIDATION_ERROR', message: 'One or more attachment IDs are invalid' });
          return;
        }

        for (const file of fileRows) {
          if (file.uploaderId !== req.userId) {
            res.status(400).json({ code: 'VALIDATION_ERROR', message: 'You can only attach files you have uploaded' });
            return;
          }
        }

        attachmentSnapshot = fileRows.map((f) => ({
          id: f.id,
          url: f.url,
          filename: f.filename,
          size: f.size,
          mimeType: f.mimeType,
        }));
      }

      // Compute expiresAt: client-specified expiresIn takes priority, then channel disappear timer.
      let expiresAt: Date | undefined;
      if (expiresIn) {
        expiresAt = new Date(Date.now() + expiresIn * 1000);
      } else if (channel.disappearTimer) {
        expiresAt = new Date(Date.now() + channel.disappearTimer * 1000);
      }

      // Build embeds: include forwarded message reference if provided
      const embeds: Array<Record<string, unknown>> = [];
      if (forwardedFromMessageId) {
        embeds.push({ type: 'forwarded', messageId: forwardedFromMessageId });
      }

      // Insert the message.
      const [newMessage] = await db
        .insert(messages)
        .values({
          channelId,
          authorId: req.userId!,
          content: content ?? null,
          attachments: attachmentSnapshot,
          ...(embeds.length > 0 ? { embeds } : {}),
          ...(replyToId ? { replyToId } : {}),
          ...(threadId ? { threadId } : {}),
          ...(expiresAt ? { expiresAt } : {}),
        })
        .returning();

      // Fetch author info for the response and Socket.io payload.
      const [author] = await db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarHash: users.avatarHash,
          nameplateStyle: users.nameplateStyle,
        })
        .from(users)
        .where(eq(users.id, req.userId!))
        .limit(1);

      const payload = formatMessage(newMessage, author ?? null);

      // Set slow mode cooldown after successful message insert
      if (slowCh?.rateLimitPerUser && slowCh.rateLimitPerUser > 0) {
        await redis.set(`slowmode:${channelId}:${req.userId}`, '1', 'EX', slowCh.rateLimitPerUser);
      }

      // Emit real-time event to all clients subscribed to this channel.
      try {
        getIO().to(`channel:${channelId}`).emit('MESSAGE_CREATE', payload);
        messagesSentTotal.inc();
      } catch {
        // Socket.io not yet initialised (e.g. test environment); non-fatal.
      }

      // Award XP (non-critical, fire and forget)
      ;(async () => {
        try {
          const xpKey = `xp:cooldown:${req.userId!}:${channelId}`;
          const already = await redis.get(xpKey);
          if (!already) {
            await redis.set(xpKey, '1', 'EX', 60);
            const updatedUser = await db.update(users)
              .set({ xp: sql`xp + 5` })
              .where(eq(users.id, req.userId!))
              .returning({ xp: users.xp, level: users.level });
            if (updatedUser.length > 0) {
              const { xp, level } = updatedUser[0];
              const newLevel = Math.floor(Math.sqrt((xp ?? 0) / 100)) + 1;
              if (newLevel > (level ?? 1)) {
                await db.update(users).set({ level: newLevel }).where(eq(users.id, req.userId!));
                try {
                  const io = getIO();
                  io.to(`user:${req.userId!}`).emit('LEVEL_UP', { level: newLevel });
                } catch { /* non-fatal */ }
              }
            }
          }
          // Check achievements
          const { checkAchievements } = await import('./achievements');
          await checkAchievements(req.userId!, 'message_sent');
        } catch { /* non-critical */ }
      })();

      // --- Notification generation (fire-and-forget) ---
      const senderName = author?.displayName || author?.username || 'Someone';
      const preview = (content ?? '').slice(0, 100);

      // Resolve the channel to check if it's a DM or guild channel.
      const [chan] = await db
        .select({ guildId: channels.guildId, type: channels.type })
        .from(channels)
        .where(eq(channels.id, channelId))
        .limit(1);

      // --- Webhook bot dispatch (guild channels only, fire-and-forget) ---
      if (chan?.guildId && author) {
        dispatchMessageCreate({
          guildId: chan.guildId,
          channelId,
          messageId: newMessage.id,
          content: content ?? '',
          author: {
            id: author.id,
            username: author.username,
            displayName: author.displayName ?? null,
          },
          timestamp: newMessage.createdAt.toISOString(),
        });
      }

      // --- Channel read-state: increment mention counts for <@userId> mentions ---
      if (content && chan?.guildId) {
        const mentionRegex = /<@([a-f0-9-]{36})>/g;
        const rawMentionedIds = new Set<string>();
        let mentionResult = mentionRegex.exec(content);
        while (mentionResult !== null) {
          if (mentionResult[1] !== req.userId!) rawMentionedIds.add(mentionResult[1]);
          mentionResult = mentionRegex.exec(content);
        }

        // Filter to only actual guild members to prevent mention spam for non-members
        let mentionedIds = new Set<string>();
        if (rawMentionedIds.size > 0) {
          const memberRows = await db.select({ userId: guildMembers.userId })
            .from(guildMembers)
            .where(and(eq(guildMembers.guildId, chan.guildId), inArray(guildMembers.userId, [...rawMentionedIds])));
          mentionedIds = new Set(memberRows.map(m => m.userId));
        }

        for (const mentionedUserId of mentionedIds) {
          try {
            const [row] = await db
              .insert(channelReadState)
              .values({
                channelId,
                userId: mentionedUserId,
                lastReadAt: new Date(0),
                mentionCount: 1,
              })
              .onConflictDoUpdate({
                target: [channelReadState.channelId, channelReadState.userId],
                set: {
                  mentionCount: sql`${channelReadState.mentionCount} + 1`,
                },
              })
              .returning({ mentionCount: channelReadState.mentionCount });

            try {
              getIO().to(`user:${mentionedUserId}`).emit('MENTION_CREATED', {
                channelId,
                guildId: chan.guildId,
                mentionCount: row?.mentionCount ?? 1,
              });
            } catch { /* non-fatal */ }
          } catch { /* skip failed upserts */ }
        }
      }

      // --- AutoMod check (fire-and-forget) ---
      if (chan?.guildId && content) {
        (async () => {
          try {
            const guildWorkflows = await db
              .select()
              .from(workflows)
              .where(and(eq(workflows.guildId, chan.guildId!), eq(workflows.enabled, true)));

            for (const wf of guildWorkflows) {
              const triggers = await db
                .select()
                .from(workflowTriggers)
                .where(and(eq(workflowTriggers.workflowId, wf.id), eq(workflowTriggers.type, 'message_contains')));

              for (const trigger of triggers) {
                const config = trigger.config as { keywords?: string[] };
                const keywords: string[] = config?.keywords || [];
                const msgLower = content.toLowerCase();
                const matched = keywords.some((kw: string) => msgLower.includes(kw.toLowerCase()));
                if (!matched) continue;

                const actions = await db
                  .select()
                  .from(workflowActions)
                  .where(eq(workflowActions.workflowId, wf.id));

                for (const action of actions) {
                  if (action.type === 'delete_message') {
                    await db.delete(messages).where(eq(messages.id, newMessage.id));
                    getIO().to(`channel:${channelId}`).emit('MESSAGE_DELETE', { id: newMessage.id, channelId });
                  }
                }
              }
            }
          } catch (automodErr) {
            console.error('[automod] check failed:', automodErr);
          }
        })();
      }

      // 1) DM notification — notify the other participant(s)
      if (chan && !chan.guildId) {
        const dmMembers = await db
          .select({ userId: dmChannelMembers.userId })
          .from(dmChannelMembers)
          .where(eq(dmChannelMembers.channelId, channelId));

        for (const member of dmMembers) {
          if (member.userId !== req.userId!) {
            createNotification({
              userId: member.userId,
              type: 'dm',
              title: `New message from ${senderName}`,
              body: preview || '(attachment)',
              data: { senderId: req.userId!, senderName, channelId },
            }).catch(() => {});
          }
        }
      }

      // 2) @mention notifications — parse @username from content
      if (content) {
        const mentionPattern = /@([a-zA-Z0-9_]+)/g;
        const mentionedUsernames = new Set<string>();
        let mentionMatch: RegExpExecArray | null;
        while ((mentionMatch = mentionPattern.exec(content)) !== null) {
          mentionedUsernames.add(mentionMatch[1].toLowerCase());
        }

        if (mentionedUsernames.size > 0) {
          for (const uname of mentionedUsernames) {
            try {
              const rows = await db
                .select({ id: users.id, username: users.username })
                .from(users)
                .where(eq(users.username, uname))
                .limit(1);

              const mentionedUser = rows[0];
              if (mentionedUser && mentionedUser.id !== req.userId!) {
                createNotification({
                  userId: mentionedUser.id,
                  type: 'mention',
                  title: `${senderName} mentioned you`,
                  body: preview,
                  data: { senderId: req.userId!, senderName, channelId, guildId: chan?.guildId ?? null },
                }).catch(() => {});
              }
            } catch { /* skip failed lookups */ }
          }
        }
      }

      res.status(201).json(payload);

      // Clear draft for this user/channel (fire-and-forget)
      db.delete(messageDrafts)
        .where(and(eq(messageDrafts.userId, req.userId!), eq(messageDrafts.channelId, channelId)))
        .catch(() => {});

      // Fire-and-forget URL embed scraping
      (async () => {
        const urls = extractUrls(content || '');
        if (urls.length === 0) return;

        const embedResults = await Promise.all(urls.map(u => scrapeUrl(u)));
        const embeds = embedResults.filter(Boolean);
        if (embeds.length === 0) return;

        await db.update(messages).set({ embeds }).where(eq(messages.id, newMessage.id));

        getIO().to(`channel:${channelId}`).emit('MESSAGE_EMBED_UPDATE', {
          messageId: newMessage.id,
          embeds,
        });
      })().catch(() => {});
    } catch (err) {
      handleAppError(res, err);
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
      await resolveChannel(channelId, req.userId!);

      const [message] = await db
        .select()
        .from(messages)
        .where(and(eq(messages.id, messageId), eq(messages.channelId, channelId)))
        .limit(1);

      if (!message) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Message not found' });
        return;
      }

      if (message.authorId !== req.userId) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'You can only edit your own messages' });
        return;
      }

      const { content } = req.body as z.infer<typeof editMessageSchema>;

      const [updated] = await db
        .update(messages)
        .set({ content, edited: true, editedAt: new Date() })
        .where(eq(messages.id, messageId))
        .returning();

      // Fetch author info.
      const [author] = await db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarHash: users.avatarHash,
          nameplateStyle: users.nameplateStyle,
        })
        .from(users)
        .where(eq(users.id, req.userId!))
        .limit(1);

      const payload = formatMessage(updated, author ?? null);

      try {
        getIO().to(`channel:${channelId}`).emit('MESSAGE_UPDATE', payload);
      } catch {
        // Non-fatal if Socket.io not initialised.
      }

      res.status(200).json(payload);
    } catch (err) {
      handleAppError(res, err);
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
      handleAppError(res, err);
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
      const channel = await resolveChannel(channelId, req.userId!);

      const [message] = await db
        .select()
        .from(messages)
        .where(and(eq(messages.id, messageId), eq(messages.channelId, channelId)))
        .limit(1);

      if (!message) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Message not found' });
        return;
      }

      // Allow deletion if: (a) caller is the author, OR (b) caller has MANAGE_MESSAGES permission.
      const isAuthor = message.authorId === req.userId;
      let canManageMessages = false;

      if (!isAuthor && channel.guildId) {
        canManageMessages = await hasPermission(req.userId!, channel.guildId, Permissions.MANAGE_MESSAGES);
      }

      if (!isAuthor && !canManageMessages) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'You do not have permission to delete this message' });
        return;
      }

      await db.delete(messages).where(eq(messages.id, messageId));

      try {
        getIO()
          .to(`channel:${channelId}`)
          .emit('MESSAGE_DELETE', { id: messageId, channelId });
      } catch {
        // Non-fatal.
      }

      res.status(200).json({ code: 'OK', message: 'Message deleted' });
    } catch (err) {
      handleAppError(res, err);
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
    } catch {
      // Non-fatal if Socket.io not initialised.
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    handleAppError(res, err);
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
    handleAppError(res, err);
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

    // Only track read state for DM channels.
    if (channel.guildId) {
      res.status(200).json({ ok: true });
      return;
    }

    const { lastReadMessageId } = req.body as z.infer<typeof readSchema>;

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
    } catch {
      // Non-fatal.
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    handleAppError(res, err);
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
      res.status(200).json([]);
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
    handleAppError(res, err);
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
    handleAppError(res, err);
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
      .orderBy(scheduledMessages.scheduledAt);
    res.json(rows);
  } catch (err) {
    handleAppError(res, err);
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
    handleAppError(res, err);
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
    if (cached) { res.json(JSON.parse(cached)); return; }

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
    handleAppError(res, err);
  }
});
