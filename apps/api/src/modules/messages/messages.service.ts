import { eq, and, sql, lt, gt, desc, inArray, isNull } from 'drizzle-orm';
import {
  messages,
  messageAttachments,
  messageReactions,
  messageReactionUsers,
  messageEditHistory,
  channelPins,
  channels,
} from '@gratonite/db';
import type { AppContext } from '../../lib/context.js';
import { generateId } from '../../lib/snowflake.js';
import { logger } from '../../lib/logger.js';
import type { CreateMessageInput, UpdateMessageInput } from './messages.schemas.js';

export function createMessagesService(ctx: AppContext) {
  async function createMessage(
    channelId: string,
    authorId: string,
    guildId: string | null,
    input: CreateMessageInput,
  ) {
    const messageId = generateId();

    // Parse mentions from content
    const mentionMatches = input.content.match(/<@!?(\d+)>/g) ?? [];
    const mentionIds = mentionMatches.map((m) => m.replace(/<@!?/, '').replace(/>/, ''));
    const mentionEveryone = input.content.includes('@everyone') || input.content.includes('@here');
    const roleMentionMatches = input.content.match(/<@&(\d+)>/g) ?? [];
    const roleMentionIds = roleMentionMatches.map((m) => m.replace(/<@&/, '').replace(/>/, ''));

    // Build message reference snapshot if replying
    let referencedMessage = null;
    if (input.messageReference) {
      const [ref] = await ctx.db
        .select({ id: messages.id, content: messages.content, authorId: messages.authorId })
        .from(messages)
        .where(eq(messages.id, input.messageReference.messageId))
        .limit(1);

      if (ref) {
        referencedMessage = {
          id: ref.id,
          content: ref.content.substring(0, 200),
          authorId: ref.authorId,
        };
      }
    }

    const [message] = await ctx.db
      .insert(messages)
      .values({
        id: messageId,
        channelId,
        guildId,
        authorId,
        content: input.content,
        type: input.messageReference ? 19 : 0, // 19 = REPLY, 0 = DEFAULT
        nonce: input.nonce ?? null,
        tts: input.tts ?? false,
        mentions: mentionIds,
        mentionRoles: roleMentionIds,
        mentionEveryone,
        stickerIds: input.stickerIds ?? [],
        messageReference: input.messageReference
          ? { messageId: input.messageReference.messageId, channelId: String(channelId) }
          : null,
        referencedMessage,
      })
      .returning();

    // Update channel's last message ID
    await ctx.db
      .update(channels)
      .set({ lastMessageId: messageId })
      .where(eq(channels.id, channelId));

    return message;
  }

  async function getMessage(messageId: string) {
    const [message] = await ctx.db
      .select()
      .from(messages)
      .where(and(eq(messages.id, messageId), sql`${messages.deletedAt} IS NULL`))
      .limit(1);
    return message ?? null;
  }

  async function getMessages(
    channelId: string,
    options: { limit: number; before?: string; after?: string; around?: string },
  ) {
    const { limit } = options;

    if (options.around) {
      const aroundId = options.around;
      const halfLimit = Math.floor(limit / 2);

      const beforeMessages = await ctx.db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.channelId, channelId),
            lt(messages.id, aroundId),
            sql`${messages.deletedAt} IS NULL`,
          ),
        )
        .orderBy(desc(messages.id))
        .limit(halfLimit);

      const afterMessages = await ctx.db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.channelId, channelId),
            gt(messages.id, aroundId),
            sql`${messages.deletedAt} IS NULL`,
          ),
        )
        .orderBy(messages.id)
        .limit(halfLimit);

      const [center] = await ctx.db
        .select()
        .from(messages)
        .where(and(eq(messages.id, aroundId), sql`${messages.deletedAt} IS NULL`))
        .limit(1);

      const result = [...beforeMessages.reverse(), ...(center ? [center] : []), ...afterMessages];
      return result;
    }

    if (options.before) {
      return ctx.db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.channelId, channelId),
            lt(messages.id, options.before),
            sql`${messages.deletedAt} IS NULL`,
          ),
        )
        .orderBy(desc(messages.id))
        .limit(limit);
    }

    if (options.after) {
      const results = await ctx.db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.channelId, channelId),
            gt(messages.id, options.after),
            sql`${messages.deletedAt} IS NULL`,
          ),
        )
        .orderBy(messages.id)
        .limit(limit);
      return results;
    }

    // Default: most recent messages
    return ctx.db
      .select()
      .from(messages)
      .where(
        and(eq(messages.channelId, channelId), sql`${messages.deletedAt} IS NULL`),
      )
      .orderBy(desc(messages.id))
      .limit(limit);
  }

  async function updateMessage(messageId: string, authorId: string, input: UpdateMessageInput) {
    const [existing] = await ctx.db
      .select()
      .from(messages)
      .where(and(eq(messages.id, messageId), sql`${messages.deletedAt} IS NULL`))
      .limit(1);

    if (!existing) return null;
    if (existing.authorId !== authorId) return { error: 'FORBIDDEN' as const };

    // Save edit history
    await ctx.db.insert(messageEditHistory).values({
      id: generateId(),
      messageId,
      content: existing.content,
    });

    const [updated] = await ctx.db
      .update(messages)
      .set({
        content: input.content,
        editedTimestamp: new Date(),
      })
      .where(eq(messages.id, messageId))
      .returning();

    return updated;
  }

  async function deleteMessage(messageId: string, userId: string, isAdmin = false) {
    const [existing] = await ctx.db
      .select()
      .from(messages)
      .where(and(eq(messages.id, messageId), sql`${messages.deletedAt} IS NULL`))
      .limit(1);

    if (!existing) return null;
    if (existing.authorId !== userId && !isAdmin) return { error: 'FORBIDDEN' as const };

    // Soft delete
    await ctx.db
      .update(messages)
      .set({ deletedAt: new Date() })
      .where(eq(messages.id, messageId));

    return existing;
  }

  // ── Reactions ────────────────────────────────────────────────────────────

  async function addReaction(messageId: string, userId: string, emojiName: string, emojiId?: string) {
    // Check if user already reacted with this emoji
    const [existing] = await ctx.db
      .select()
      .from(messageReactionUsers)
      .where(
        and(
          eq(messageReactionUsers.messageId, messageId),
          eq(messageReactionUsers.userId, userId),
          eq(messageReactionUsers.emojiName, emojiName),
        ),
      )
      .limit(1);

    if (existing) return false; // Already reacted

    // Add user reaction
    await ctx.db.insert(messageReactionUsers).values({
      messageId,
      userId,
      emojiName,
      emojiId: emojiId ?? null,
    });

    // Upsert aggregate count
    const [existingReaction] = await ctx.db
      .select()
      .from(messageReactions)
      .where(
        and(
          eq(messageReactions.messageId, messageId),
          eq(messageReactions.emojiName, emojiName),
        ),
      )
      .limit(1);

    if (existingReaction) {
      await ctx.db
        .update(messageReactions)
        .set({ count: sql`${messageReactions.count} + 1` })
        .where(
          and(
            eq(messageReactions.messageId, messageId),
            eq(messageReactions.emojiName, emojiName),
          ),
        );
    } else {
      await ctx.db.insert(messageReactions).values({
        messageId,
        emojiName,
        emojiId: emojiId ?? null,
        count: 1,
      });
    }

    return true;
  }

  async function removeReaction(messageId: string, userId: string, emojiName: string) {
    const deleted = await ctx.db
      .delete(messageReactionUsers)
      .where(
        and(
          eq(messageReactionUsers.messageId, messageId),
          eq(messageReactionUsers.userId, userId),
          eq(messageReactionUsers.emojiName, emojiName),
        ),
      );

    // Decrement aggregate count
    await ctx.db
      .update(messageReactions)
      .set({ count: sql`GREATEST(${messageReactions.count} - 1, 0)` })
      .where(
        and(
          eq(messageReactions.messageId, messageId),
          eq(messageReactions.emojiName, emojiName),
        ),
      );

    // Clean up zero-count reactions
    await ctx.db
      .delete(messageReactions)
      .where(
        and(
          eq(messageReactions.messageId, messageId),
          eq(messageReactions.emojiName, emojiName),
          eq(messageReactions.count, 0),
        ),
      );
  }

  async function getReactions(messageId: string) {
    return ctx.db
      .select()
      .from(messageReactions)
      .where(eq(messageReactions.messageId, messageId));
  }

  // ── Pins ─────────────────────────────────────────────────────────────────

  async function pinMessage(channelId: string, messageId: string, userId: string) {
    // Check pin limit (50 per channel)
    const [count] = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(channelPins)
      .where(eq(channelPins.channelId, channelId));

    if ((count?.count ?? 0) >= 50) {
      return { error: 'PIN_LIMIT_REACHED' as const };
    }

    await ctx.db.insert(channelPins).values({ channelId, messageId, pinnedBy: userId });

    await ctx.db
      .update(messages)
      .set({ pinned: true })
      .where(eq(messages.id, messageId));

    return true;
  }

  async function unpinMessage(channelId: string, messageId: string) {
    await ctx.db
      .delete(channelPins)
      .where(and(eq(channelPins.channelId, channelId), eq(channelPins.messageId, messageId)));

    await ctx.db
      .update(messages)
      .set({ pinned: false })
      .where(eq(messages.id, messageId));
  }

  async function getPins(channelId: string) {
    const pins = await ctx.db
      .select({ messageId: channelPins.messageId })
      .from(channelPins)
      .where(eq(channelPins.channelId, channelId))
      .orderBy(desc(channelPins.pinnedAt));

    if (pins.length === 0) return [];

    const messageIds = pins.map((p) => p.messageId);
    return ctx.db
      .select()
      .from(messages)
      .where(and(inArray(messages.id, messageIds), isNull(messages.deletedAt)));
  }

  return {
    createMessage,
    getMessage,
    getMessages,
    updateMessage,
    deleteMessage,
    addReaction,
    removeReaction,
    getReactions,
    pinMessage,
    unpinMessage,
    getPins,
  };
}

export type MessagesService = ReturnType<typeof createMessagesService>;
