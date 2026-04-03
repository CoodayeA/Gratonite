/**
 * services/message.service.ts — Business logic for message operations.
 *
 * Extracted from routes/messages.ts, routes/reactions.ts, routes/pins.ts
 * to separate HTTP concerns from domain logic. Route handlers validate
 * input and translate service errors to HTTP responses.
 *
 * @module services/message.service
 */

import { eq, and, lt, gt, desc, isNull, or, sql, inArray, count } from 'drizzle-orm';

import { db } from '../db/index';
import { messages } from '../db/schema/messages';
import { channels, dmChannelMembers } from '../db/schema/channels';
import { channelReadState } from '../db/schema/channel-read-state';
import { files } from '../db/schema/files';
import { users } from '../db/schema/users';
import { guilds } from '../db/schema/guilds';
import { guildMembers } from '../db/schema/guilds';
import { messageReactions } from '../db/schema/reactions';
import { channelPins } from '../db/schema/pins';
import { threads } from '../db/schema/threads';
import { messageEditHistory } from '../db/schema/messageEditHistory';
import { messageDrafts } from '../db/schema/message-drafts';
import { scheduledMessages } from '../db/schema/scheduled-messages';
import { automodRules } from '../db/schema/automod-rules';
import { guildWordFilters } from '../db/schema/guild-word-filters';
import { workflows, workflowTriggers, workflowActions } from '../db/schema/workflows';
import { Permissions } from '../db/schema/roles';
import { getIO } from '../lib/socket-io';
import { hasPermission, hasChannelPermission } from '../routes/roles';
import { createNotification } from '../lib/notifications';
import { dispatchMessageCreate, dispatchEvent } from '../lib/webhook-dispatch';
import { scrapeUrl, extractUrls } from '../lib/og-scraper';
import { unfurlGitHubUrl } from '../lib/unfurl/github';
import { redis } from '../lib/redis';
import { logger } from '../lib/logger';
import { messagesSentTotal } from '../lib/metrics';
import { incrementChallengeProgress } from '../routes/daily-challenges';

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

/**
 * ServiceError — Thrown by service methods to signal a business-rule violation.
 * Route handlers catch these and translate `code` to an HTTP status.
 */
export class ServiceError extends Error {
  constructor(
    public code:
      | 'NOT_FOUND'
      | 'FORBIDDEN'
      | 'VALIDATION_ERROR'
      | 'CONFLICT'
      | 'RATE_LIMITED'
      | 'AUTOMOD_BLOCKED'
      | 'BLOCKED_CONTENT'
      | 'WORD_FILTER_WARN'
      | 'ALREADY_SENT'
      | 'MAX_PINS',
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

// ---------------------------------------------------------------------------
// Helpers (private to service)
// ---------------------------------------------------------------------------

/**
 * resolveChannel — Fetch a channel row and verify the user has access.
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
    throw new ServiceError('NOT_FOUND', 'Channel not found');
  }

  if (channel.guildId) {
    const [membership] = await db
      .select({ id: guildMembers.id })
      .from(guildMembers)
      .where(and(eq(guildMembers.guildId, channel.guildId), eq(guildMembers.userId, userId)))
      .limit(1);

    if (!membership) {
      throw new ServiceError('FORBIDDEN', 'You are not a member of this guild');
    }
  } else {
    const [participation] = await db
      .select({ id: dmChannelMembers.id })
      .from(dmChannelMembers)
      .where(and(eq(dmChannelMembers.channelId, channelId), eq(dmChannelMembers.userId, userId)))
      .limit(1);

    if (!participation) {
      throw new ServiceError('FORBIDDEN', 'You do not have access to this channel');
    }
  }

  return channel;
}

/**
 * formatMessage — Shape a database message row for API responses.
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
    isFederated: msg.originInstanceId != null,
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
// MessageService
// ---------------------------------------------------------------------------

export class MessageService {
  /**
   * 1. getMessages — Paginated message fetch with author join, reactions, pins, threads.
   */
  async getMessages(
    channelId: string,
    userId: string,
    options?: { before?: string; limit?: number },
  ) {
    await resolveChannel(channelId, userId);

    const limit = Math.min(options?.limit ?? 50, 100);
    const beforeId = options?.before;

    let cursorCondition = undefined;
    if (beforeId) {
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
        isEncrypted: messages.isEncrypted,
        encryptedContent: messages.encryptedContent,
        keyVersion: messages.keyVersion,
        originInstanceId: messages.originInstanceId,
        authorId: messages.authorId,
        authorUsername: users.username,
        authorDisplayName: users.displayName,
        authorAvatarHash: users.avatarHash,
        authorNameplateStyle: users.nameplateStyle,
        authorIsBot: users.isBot,
      })
      .from(messages)
      .leftJoin(users, eq(users.id, messages.authorId))
      .where(
        and(
          eq(messages.channelId, channelId),
          or(
            isNull(messages.threadId),
            sql`${messages.id} IN (SELECT origin_message_id FROM threads WHERE origin_message_id IS NOT NULL)`,
          ),
          or(isNull(messages.expiresAt), gt(messages.expiresAt, new Date())),
          ...(cursorCondition ? [cursorCondition] : []),
        ),
      )
      .orderBy(desc(messages.createdAt))
      .limit(limit);

    // Fetch reactions for all returned messages in one query
    const messageIds = rows.map((r: any) => r.id);
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
      pinnedSet = new Set(pinRows.map((p: any) => p.messageId));
    }

    // Fetch thread reply counts
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

    return rows.map((row: any) => {
      const emojiMap = reactionsByMessage.get(row.id);
      const reactions = emojiMap
        ? Array.from(emojiMap.values()).map((e) => ({
            emoji: e.emoji,
            count: e.count,
            me: e.userIds.includes(userId),
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
        isFederated: row.originInstanceId != null,
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
              isBot: row.authorIsBot ?? false,
            }
          : null,
      };
    });
  }

  /**
   * 2. createMessage — Send a message (with embeds, attachments, replies).
   *
   * Returns the formatted message payload. Handles automod, word filters,
   * slow mode, scheduled messages, notifications, XP, and embed scraping.
   */
  async createMessage(
    channelId: string,
    authorId: string,
    data: {
      content?: string | null;
      attachmentIds?: string[];
      replyToId?: string;
      threadId?: string;
      expiresIn?: number;
      scheduledAt?: string;
      forwardedFromMessageId?: string;
      isEncrypted?: boolean;
      encryptedContent?: string;
      keyVersion?: number;
      embeds?: Array<{
        type: 'rich';
        title?: string;
        description?: string;
        url?: string;
        color?: string;
        image?: string;
        thumbnail?: string;
        fields?: Array<{ name: string; value: string; inline?: boolean }>;
      }>;
    },
  ) {
    const channel = await resolveChannel(channelId, authorId);

    // Check SEND_MESSAGES permission for guild channels
    if (channel.guildId) {
      const canSend = await hasChannelPermission(authorId, channel.guildId, channelId, Permissions.SEND_MESSAGES);
      if (!canSend) {
        throw new ServiceError('FORBIDDEN', 'Missing SEND_MESSAGES permission in this channel');
      }
    }

    // Check if user is timed out in this guild
    if (channel.guildId) {
      const [member] = await db.select({ timeoutUntil: guildMembers.timeoutUntil })
        .from(guildMembers)
        .where(and(eq(guildMembers.guildId, channel.guildId), eq(guildMembers.userId, authorId)))
        .limit(1);
      if (member?.timeoutUntil && member.timeoutUntil > new Date()) {
        throw new ServiceError('FORBIDDEN', 'You are timed out in this server');
      }
    }

    // Slow mode enforcement
    const [slowCh] = await db.select({ rateLimitPerUser: channels.rateLimitPerUser }).from(channels).where(eq(channels.id, channelId)).limit(1);
    if (slowCh?.rateLimitPerUser && slowCh.rateLimitPerUser > 0) {
      const slowKey = `slowmode:${channelId}:${authorId}`;
      const remaining = await redis.ttl(slowKey);
      if (remaining > 0) {
        throw new ServiceError('RATE_LIMITED', 'Slow mode active', remaining);
      }
    }

    const { content, attachmentIds, replyToId, threadId, expiresIn, scheduledAt, forwardedFromMessageId, isEncrypted, encryptedContent, keyVersion, embeds: userEmbeds } = data;

    // Handle scheduled messages
    if (scheduledAt) {
      const scheduledDate = new Date(scheduledAt);
      if (scheduledDate <= new Date()) {
        throw new ServiceError('VALIDATION_ERROR', 'scheduledAt must be in the future');
      }
      const [scheduled] = await db.insert(scheduledMessages).values({
        channelId,
        authorId,
        content: content ?? '',
        scheduledAt: scheduledDate,
      }).returning();
      return { scheduled: true as const, data: scheduled };
    }

    // Automod check
    if (channel.guildId && content) {
      try {
        const rules = await db.select().from(automodRules)
          .where(and(eq(automodRules.guildId, channel.guildId), eq(automodRules.enabled, true)));

        for (const rule of rules) {
          if (rule.triggerType !== 'KEYWORD') continue;
          const metadata = rule.triggerMetadata as { keywords?: string[] };
          const keywords: string[] = metadata?.keywords || [];
          if (keywords.length > 1000) continue;
          const totalSize = keywords.reduce((sum, kw) => sum + kw.length, 0);
          if (totalSize > 50_000) continue;
          const msgLower = content.toLowerCase();
          const matched = keywords.some((kw: string) => msgLower.includes(kw.toLowerCase()));
          if (!matched) continue;

          const actions = (rule.actions as Array<{ type: string; alertChannelId?: string }>) || [];
          for (const action of actions) {
            if (action.type === 'BLOCK_MESSAGE') {
              throw new ServiceError('AUTOMOD_BLOCKED', 'Message blocked by auto-moderation');
            }
          }
        }
      } catch (err) {
        if (err instanceof ServiceError) throw err;
        /* automod should not break message sending */
      }
    }

    // Block file attachments if disabled
    if (attachmentIds && attachmentIds.length > 0 && channel.attachmentsEnabled === false) {
      throw new ServiceError('FORBIDDEN', 'File attachments are disabled in this channel');
    }

    // Word filter check
    let wordFilterDeleteAfterInsert = false;
    if (channel.guildId && content) {
      try {
        const [wordFilter] = await db.select().from(guildWordFilters)
          .where(eq(guildWordFilters.guildId, channel.guildId!)).limit(1);
        if (wordFilter && wordFilter.words && wordFilter.words.length > 0) {
          const contentLower = content.toLowerCase();
          const matched = wordFilter.words.some((w: string) => contentLower.includes(w.toLowerCase()));
          if (matched) {
            if (wordFilter.action === 'block') {
              throw new ServiceError('BLOCKED_CONTENT', 'Your message contains blocked words');
            }
            if (wordFilter.action === 'warn') {
              throw new ServiceError('WORD_FILTER_WARN', 'Your message was blocked for containing filtered words. This is a warning.');
            }
            if (wordFilter.action === 'delete') {
              wordFilterDeleteAfterInsert = true;
            }
          }
        }
      } catch (err) {
        if (err instanceof ServiceError) throw err;
        /* word filter should not break message sending */
      }
    }

    // Resolve attachments and verify ownership
    let attachmentSnapshot: Array<{
      id: string;
      url: string;
      filename: string;
      size: number;
      mimeType: string;
    }> = [];

    if (attachmentIds && attachmentIds.length > 0) {
      const fileRows = await db
        .select()
        .from(files)
        .where(
          or(
            ...attachmentIds.map((id) => eq(files.id, id)),
          ) as ReturnType<typeof eq>,
        );

      if (fileRows.length !== attachmentIds.length) {
        throw new ServiceError('VALIDATION_ERROR', 'One or more attachment IDs are invalid');
      }

      for (const file of fileRows) {
        if (file.uploaderId !== authorId) {
          throw new ServiceError('VALIDATION_ERROR', 'You can only attach files you have uploaded');
        }
      }

      attachmentSnapshot = fileRows.map((f: any) => ({
        id: f.id,
        url: f.url,
        filename: f.filename,
        size: f.size,
        mimeType: f.mimeType,
      }));
    }

    // Compute expiresAt
    let expiresAt: Date | undefined;
    if (expiresIn) {
      expiresAt = new Date(Date.now() + expiresIn * 1000);
    } else if (channel.disappearTimer) {
      expiresAt = new Date(Date.now() + channel.disappearTimer * 1000);
    }

    // Build embeds
    const embeds: Array<Record<string, unknown>> = [];
    if (forwardedFromMessageId) {
      const [sourceMsg] = await db
        .select({ channelId: messages.channelId })
        .from(messages)
        .where(eq(messages.id, forwardedFromMessageId))
        .limit(1);
      if (!sourceMsg) {
        throw new ServiceError('VALIDATION_ERROR', 'Forwarded message not found');
      }
      const [sourceChannel] = await db
        .select({ guildId: channels.guildId })
        .from(channels)
        .where(eq(channels.id, sourceMsg.channelId))
        .limit(1);
      if (sourceChannel?.guildId) {
        const [srcMembership] = await db
          .select({ id: guildMembers.id })
          .from(guildMembers)
          .where(and(eq(guildMembers.guildId, sourceChannel.guildId), eq(guildMembers.userId, authorId)))
          .limit(1);
        if (!srcMembership) {
          throw new ServiceError('FORBIDDEN', 'You do not have access to the forwarded message');
        }
      } else {
        const [srcDmMembership] = await db
          .select({ id: dmChannelMembers.id })
          .from(dmChannelMembers)
          .where(and(eq(dmChannelMembers.channelId, sourceMsg.channelId), eq(dmChannelMembers.userId, authorId)))
          .limit(1);
        if (!srcDmMembership) {
          throw new ServiceError('FORBIDDEN', 'You do not have access to the forwarded message');
        }
      }
      embeds.push({ type: 'forwarded', messageId: forwardedFromMessageId });
    }
    if (userEmbeds && userEmbeds.length > 0) {
      embeds.push(...userEmbeds);
    }

    // Insert the message
    const [newMessage] = await db
      .insert(messages)
      .values({
        channelId,
        authorId,
        content: content ?? null,
        attachments: attachmentSnapshot,
        ...(embeds.length > 0 ? { embeds } : {}),
        ...(replyToId ? { replyToId } : {}),
        ...(threadId ? { threadId } : {}),
        ...(expiresAt ? { expiresAt } : {}),
        ...(isEncrypted ? { isEncrypted, encryptedContent: encryptedContent ?? null, ...(keyVersion !== undefined ? { keyVersion } : {}) } : {}),
      })
      .returning();

    // Fetch author info
    const [author] = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarHash: users.avatarHash,
        nameplateStyle: users.nameplateStyle,
        isBot: users.isBot,
      })
      .from(users)
      .where(eq(users.id, authorId))
      .limit(1);

    const payload = formatMessage(newMessage, author ?? null);

    // Set slow mode cooldown
    const [currentSlowCh] = await db.select({ rateLimitPerUser: channels.rateLimitPerUser }).from(channels).where(eq(channels.id, channelId)).limit(1);
    if (currentSlowCh?.rateLimitPerUser && currentSlowCh.rateLimitPerUser > 0) {
      await redis.set(`slowmode:${channelId}:${authorId}`, '1', 'EX', currentSlowCh.rateLimitPerUser);
    }

    // Emit real-time event
    try {
      getIO().to(`channel:${channelId}`).emit('MESSAGE_CREATE', payload);
      messagesSentTotal.inc();
    } catch {
      // Socket.io not yet initialised (e.g. test environment); non-fatal.
    }

    // Word filter "delete" action
    if (wordFilterDeleteAfterInsert) {
      setTimeout(async () => {
        try {
          await db.delete(messages).where(eq(messages.id, newMessage.id));
          getIO().to(`channel:${channelId}`).emit('MESSAGE_DELETE', { id: newMessage.id, channelId });
        } catch { /* non-fatal */ }
      }, 5000);
    }

    // Award XP (fire and forget)
    ;(async () => {
      try {
        const xpKey = `xp:cooldown:${authorId}:${channelId}`;
        const already = await redis.get(xpKey);
        if (!already) {
          await redis.set(xpKey, '1', 'EX', 60);
          const updatedUser = await db.update(users)
            .set({ xp: sql`xp + 5` })
            .where(eq(users.id, authorId))
            .returning({ xp: users.xp, level: users.level });
          if (updatedUser.length > 0) {
            const { xp, level } = updatedUser[0];
            const newLevel = Math.floor(Math.sqrt((xp ?? 0) / 100)) + 1;
            if (newLevel > (level ?? 1)) {
              await db.update(users).set({ level: newLevel }).where(eq(users.id, authorId));
              try {
                const io = getIO();
                io.to(`user:${authorId}`).emit('LEVEL_UP', { level: newLevel });
              } catch { /* non-fatal */ }
            }
          }
        }
        // Check achievements
        const { checkAchievements } = await import('../routes/achievements');
        await checkAchievements(authorId, 'message_sent');
      } catch { /* non-critical */ }
    })();

    // Notification generation (fire-and-forget)
    const senderName = author?.displayName || author?.username || 'Someone';
    const preview = isEncrypted ? 'Encrypted message' : (content ?? '').slice(0, 100);

    const [chan] = await db
      .select({ guildId: channels.guildId, type: channels.type })
      .from(channels)
      .where(eq(channels.id, channelId))
      .limit(1);

    // Webhook bot dispatch
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

    // Channel read-state: increment mention counts
    if (content && chan?.guildId) {
      const mentionRegex = /<@([a-f0-9-]{36})>/g;
      const rawMentionedIds = new Set<string>();
      let mentionResult = mentionRegex.exec(content);
      while (mentionResult !== null) {
        if (mentionResult[1] !== authorId) rawMentionedIds.add(mentionResult[1]);
        mentionResult = mentionRegex.exec(content);
      }

      let mentionedIds = new Set<string>();
      if (rawMentionedIds.size > 0) {
        const memberRows = await db.select({ userId: guildMembers.userId })
          .from(guildMembers)
          .where(and(eq(guildMembers.guildId, chan.guildId), inArray(guildMembers.userId, [...rawMentionedIds])));
        mentionedIds = new Set(memberRows.map((m: any) => m.userId));
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

    // AutoMod workflow check (fire-and-forget)
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
          logger.error('[automod] check failed:', automodErr);
        }
      })();
    }

    // DM notification
    if (chan && !chan.guildId) {
      const dmMembers = await db
        .select({ userId: dmChannelMembers.userId })
        .from(dmChannelMembers)
        .where(eq(dmChannelMembers.channelId, channelId));

      for (const member of dmMembers) {
        if (member.userId !== authorId) {
          createNotification({
            userId: member.userId,
            type: 'dm',
            title: `New message from ${senderName}`,
            body: preview || '(attachment)',
            data: { senderId: authorId, senderName, channelId, messageId: newMessage.id },
          }).catch(err => logger.error('[messages] notification failed:', err));
        }
      }
    }

    // @mention notifications
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
            if (mentionedUser && mentionedUser.id !== authorId) {
              createNotification({
                userId: mentionedUser.id,
                type: 'mention',
                title: `${senderName} mentioned you`,
                body: preview,
                data: { senderId: authorId, senderName, channelId, guildId: chan?.guildId ?? null, messageId: newMessage.id },
              }).catch(err => logger.error('[messages] mention notification failed:', err));
            }
          } catch { /* skip failed lookups */ }
        }
      }
    }

    // Group mention notifications (@everyone, @here, @channel, @online)
    if (content && chan?.guildId) {
      const groupMentionPattern = /@(everyone|here|channel|online)\b/;
      const groupMatch = groupMentionPattern.exec(content);
      if (groupMatch) {
        const mentionType = groupMatch[1]; // 'everyone', 'here', 'channel', 'online'
        (async () => {
          try {
            // Get all guild members
            const allMembers = await db
              .select({ userId: guildMembers.userId })
              .from(guildMembers)
              .where(eq(guildMembers.guildId, chan.guildId!));

            // Collect already-mentioned user IDs from individual mentions to deduplicate
            const alreadyMentionedIds = new Set<string>();
            if (content) {
              const individualMentionRegex = /<@([a-f0-9-]{36})>/g;
              let im: RegExpExecArray | null;
              while ((im = individualMentionRegex.exec(content)) !== null) {
                alreadyMentionedIds.add(im[1]);
              }
            }

            let targetUserIds: string[];
            if (mentionType === 'everyone') {
              targetUserIds = allMembers.map(m => m.userId).filter(uid => uid !== authorId && !alreadyMentionedIds.has(uid));
            } else if (mentionType === 'here' || mentionType === 'online') {
              // Filter by online presence via Redis
              const onlineIds: string[] = [];
              for (const member of allMembers) {
                if (member.userId === authorId || alreadyMentionedIds.has(member.userId)) continue;
                try {
                  const status = await redis.get(`presence:${member.userId}`);
                  if (status && status !== 'offline' && status !== 'invisible') {
                    onlineIds.push(member.userId);
                  }
                } catch { /* skip */ }
              }
              targetUserIds = onlineIds;
            } else {
              // @channel — all members (same as @everyone for now)
              targetUserIds = allMembers.map(m => m.userId).filter(uid => uid !== authorId && !alreadyMentionedIds.has(uid));
            }

            // Resolve channel name for notification title
            let channelName = 'a channel';
            try {
              const [chanRow] = await db.select({ name: channels.name }).from(channels).where(eq(channels.id, channelId)).limit(1);
              if (chanRow?.name) channelName = chanRow.name;
            } catch { /* skip */ }

            // Process in batches of 100
            const BATCH_SIZE = 100;
            for (let i = 0; i < targetUserIds.length; i += BATCH_SIZE) {
              const batch = targetUserIds.slice(i, i + BATCH_SIZE);
              await Promise.allSettled(batch.map(async (userId) => {
                // Increment mention count in channel read state
                try {
                  const [row] = await db
                    .insert(channelReadState)
                    .values({ channelId, userId, lastReadAt: new Date(0), mentionCount: 1 })
                    .onConflictDoUpdate({
                      target: [channelReadState.channelId, channelReadState.userId],
                      set: { mentionCount: sql`${channelReadState.mentionCount} + 1` },
                    })
                    .returning({ mentionCount: channelReadState.mentionCount });

                  try {
                    getIO().to(`user:${userId}`).emit('MENTION_CREATED', {
                      channelId,
                      guildId: chan.guildId,
                      mentionCount: row?.mentionCount ?? 1,
                    });
                  } catch { /* non-fatal */ }
                } catch { /* skip */ }

                // Create notification
                createNotification({
                  userId,
                  type: 'mention',
                  title: `${senderName} mentioned @${mentionType} in #${channelName}`,
                  body: preview,
                  data: { senderId: authorId, senderName, channelId, guildId: chan.guildId ?? null, messageId: newMessage.id },
                }).catch(err => logger.error('[messages] group mention notification failed:', err));
              }));
            }
          } catch (err) {
            logger.error('[messages] group mention processing failed:', err);
          }
        })();
      }
    }

    // Clear draft (fire-and-forget)
    db.delete(messageDrafts)
      .where(and(eq(messageDrafts.userId, authorId), eq(messageDrafts.channelId, channelId)))
      .catch((err: any) => logger.error('[messages] draft cleanup failed:', err));

    // Daily challenge progress (fire-and-forget)
    incrementChallengeProgress(authorId, 'send_messages');
    if (replyToId) incrementChallengeProgress(authorId, 'reply_to_messages');

    // URL embed scraping (fire-and-forget)
    (async () => {
      const urls = extractUrls(content || '');
      if (urls.length === 0) return;

      // Try GitHub unfurling first for github.com URLs, fall back to OG scraping
      const embedResults = await Promise.all(
        urls.map(async (u) => {
          if (/^https?:\/\/github\.com\//i.test(u)) {
            const ghEmbed = await unfurlGitHubUrl(u);
            if (ghEmbed) return ghEmbed;
          }
          return scrapeUrl(u);
        }),
      );
      const scrapedEmbeds = embedResults.filter(Boolean);
      if (scrapedEmbeds.length === 0) return;

      await db.update(messages).set({ embeds: scrapedEmbeds }).where(eq(messages.id, newMessage.id));

      getIO().to(`channel:${channelId}`).emit('MESSAGE_EMBED_UPDATE', {
        messageId: newMessage.id,
        embeds: scrapedEmbeds,
      });
    })().catch(err => logger.error('[messages] embed scraping failed:', err));

    return { scheduled: false as const, data: payload };
  }

  /**
   * 3. updateMessage — Edit a message (author only).
   */
  async updateMessage(
    channelId: string,
    messageId: string,
    authorId: string,
    data: {
      content?: string;
      encryptedContent?: string;
      isEncrypted?: boolean;
      keyVersion?: number;
    },
  ) {
    await resolveChannel(channelId, authorId);

    const [message] = await db
      .select()
      .from(messages)
      .where(and(eq(messages.id, messageId), eq(messages.channelId, channelId)))
      .limit(1);

    if (!message) {
      throw new ServiceError('NOT_FOUND', 'Message not found');
    }

    if (message.authorId !== authorId) {
      throw new ServiceError('FORBIDDEN', 'You can only edit your own messages');
    }

    const { content, encryptedContent, isEncrypted, keyVersion } = data;

    // Save current content to edit history before overwriting
    if (message.content) {
      await db.insert(messageEditHistory).values({
        messageId: message.id,
        content: message.content,
      });
    }

    const updateFields: Record<string, unknown> = { edited: true, editedAt: new Date() };
    if (isEncrypted) {
      updateFields.content = null;
      updateFields.encryptedContent = encryptedContent ?? null;
      updateFields.isEncrypted = true;
      if (keyVersion !== undefined) updateFields.keyVersion = keyVersion;
    } else {
      updateFields.content = content;
      updateFields.isEncrypted = false;
      updateFields.encryptedContent = null;
    }

    const [updated] = await db
      .update(messages)
      .set(updateFields)
      .where(eq(messages.id, messageId))
      .returning();

    // Fetch author info
    const [author] = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarHash: users.avatarHash,
        nameplateStyle: users.nameplateStyle,
        isBot: users.isBot,
      })
      .from(users)
      .where(eq(users.id, authorId))
      .limit(1);

    const payload = formatMessage(updated, author ?? null);

    try {
      getIO().to(`channel:${channelId}`).emit('MESSAGE_UPDATE', payload);
    } catch {
      // Non-fatal if Socket.io not initialised.
    }

    // Dispatch message_update to installed bots
    const [editChan] = await db.select({ guildId: channels.guildId }).from(channels)
      .where(eq(channels.id, channelId)).limit(1);
    if (editChan?.guildId) {
      dispatchEvent(editChan.guildId, 'message_update', {
        channelId, messageId, content: updated.content ?? '',
        authorId: updated.authorId,
      });
    }

    return payload;
  }

  /**
   * 4. deleteMessage — Delete a message (author or permission check).
   */
  async deleteMessage(channelId: string, messageId: string, userId: string) {
    const channel = await resolveChannel(channelId, userId);

    const [message] = await db
      .select()
      .from(messages)
      .where(and(eq(messages.id, messageId), eq(messages.channelId, channelId)))
      .limit(1);

    if (!message) {
      throw new ServiceError('NOT_FOUND', 'Message not found');
    }

    const isAuthor = message.authorId === userId;
    let canManageMessages = false;

    if (!isAuthor && channel.guildId) {
      canManageMessages = await hasPermission(userId, channel.guildId, Permissions.MANAGE_MESSAGES);
    }

    if (!isAuthor && !canManageMessages) {
      throw new ServiceError('FORBIDDEN', 'You do not have permission to delete this message');
    }

    await db.delete(messages).where(eq(messages.id, messageId));

    try {
      getIO()
        .to(`channel:${channelId}`)
        .emit('MESSAGE_DELETE', { id: messageId, channelId });
    } catch {
      // Non-fatal.
    }

    // Dispatch message_delete to installed bots
    if (channel.guildId) {
      dispatchEvent(channel.guildId, 'message_delete', { channelId, messageId });
    }
  }

  /**
   * 5. addReaction — Add a reaction to a message.
   */
  async addReaction(channelId: string, messageId: string, userId: string, emoji: string) {
    const decodedEmoji = decodeURIComponent(emoji);

    // Verify message exists in channel
    const [msg] = await db.select({ id: messages.id }).from(messages)
      .where(and(eq(messages.id, messageId), eq(messages.channelId, channelId))).limit(1);
    if (!msg) {
      throw new ServiceError('NOT_FOUND', 'Message not found');
    }

    // Add reaction (upsert)
    await db.insert(messageReactions).values({
      messageId,
      userId,
      emoji: decodedEmoji,
    }).onConflictDoNothing();

    try {
      getIO().to(`channel:${channelId}`).emit('MESSAGE_REACTION_ADD', {
        messageId, channelId, userId, emoji: decodedEmoji,
      });
    } catch { /* non-fatal */ }

    // Dispatch reaction_add to installed bots
    const [reactChan] = await db.select({ guildId: channels.guildId }).from(channels)
      .where(eq(channels.id, channelId)).limit(1);
    if (reactChan?.guildId) {
      dispatchEvent(reactChan.guildId, 'reaction_add', {
        channelId, messageId, userId, emoji: decodedEmoji,
      });
    }

    // Daily challenge progress (fire-and-forget)
    incrementChallengeProgress(userId, 'react_to_messages');
    incrementChallengeProgress(userId, 'send_reactions');
  }

  /**
   * 6. removeReaction — Remove a reaction from a message.
   */
  async removeReaction(channelId: string, messageId: string, userId: string, emoji: string) {
    const decodedEmoji = decodeURIComponent(emoji);

    await db.delete(messageReactions).where(
      and(
        eq(messageReactions.messageId, messageId),
        eq(messageReactions.userId, userId),
        eq(messageReactions.emoji, decodedEmoji),
      ),
    );

    try {
      getIO().to(`channel:${channelId}`).emit('MESSAGE_REACTION_REMOVE', {
        messageId, channelId, userId, emoji: decodedEmoji,
      });
    } catch { /* non-fatal */ }

    // Dispatch reaction_remove to installed bots
    const [rmChan] = await db.select({ guildId: channels.guildId }).from(channels)
      .where(eq(channels.id, channelId)).limit(1);
    if (rmChan?.guildId) {
      dispatchEvent(rmChan.guildId, 'reaction_remove', {
        channelId, messageId, userId, emoji: decodedEmoji,
      });
    }
  }

  /**
   * 7. pinMessage — Pin a message in a channel.
   */
  async pinMessage(channelId: string, messageId: string, userId: string) {
    // Verify message exists in channel
    const [msg] = await db.select({ id: messages.id }).from(messages)
      .where(and(eq(messages.id, messageId), eq(messages.channelId, channelId))).limit(1);
    if (!msg) {
      throw new ServiceError('NOT_FOUND', 'Message not found');
    }

    // Check max 50 pins
    const [{ pinCount }] = await db.select({ pinCount: count() }).from(channelPins).where(eq(channelPins.channelId, channelId));
    if (pinCount >= 50) {
      throw new ServiceError('MAX_PINS', 'Maximum 50 pins per channel');
    }

    await db.insert(channelPins).values({
      channelId,
      messageId,
      pinnedBy: userId,
    }).onConflictDoNothing();

    // Daily challenge progress (fire-and-forget)
    incrementChallengeProgress(userId, 'pin_messages');

    try {
      getIO().to(`channel:${channelId}`).emit('CHANNEL_PINS_UPDATE', { channelId, messageId, pinned: true });
    } catch { /* non-fatal */ }
  }

  /**
   * 8. unpinMessage — Unpin a message from a channel.
   */
  async unpinMessage(channelId: string, messageId: string) {
    await db.delete(channelPins).where(
      and(eq(channelPins.channelId, channelId), eq(channelPins.messageId, messageId)),
    );

    try {
      getIO().to(`channel:${channelId}`).emit('CHANNEL_PINS_UPDATE', { channelId, messageId, pinned: false });
    } catch { /* non-fatal */ }
  }
}

export const messageService = new MessageService();
