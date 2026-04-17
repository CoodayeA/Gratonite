import { and, asc, count, desc, eq, lt, max, sql } from 'drizzle-orm';
import { db } from '../db/index';
import { channels } from '../db/schema/channels';
import { messages } from '../db/schema/messages';
import { threads, threadMembers } from '../db/schema/threads';
import { users } from '../db/schema/users';
import { getIO } from '../lib/socket-io';
import { logger } from '../lib/logger';
import { assertCanSendMessage, messageService, ServiceError } from './message.service';

type ForumTagConfig = { id: string; name: string; color?: string };

type AttachmentSnapshot = {
  id: string;
  url: string;
  filename: string;
  size: number;
  mimeType: string;
};

export type ForumThreadListItem = {
  id: string;
  channelId: string;
  name: string;
  creatorId: string;
  creatorName: string;
  creatorAvatarHash: string | null;
  originMessageId: string | null;
  archived: boolean;
  locked: boolean;
  forumTagIds: string[] | null;
  tags: string[];
  archiveAfter: number | null;
  createdAt: Date;
  messageCount: number;
  lastActivity: string | null;
  opPreview: string | null;
  opAttachment: AttachmentSnapshot | null;
};

export type ThreadMessageListItem = {
  id: string;
  channelId: string;
  authorId: string | null;
  content: string | null;
  attachments: AttachmentSnapshot[];
  edited: boolean;
  editedAt: Date | null;
  createdAt: Date;
  threadId: string | null;
  replyToId: string | null;
  author: {
    id: string;
    username: string | null;
    displayName: string | null;
    avatarHash: string | null;
  } | null;
};

function normalizeTags(tags: unknown): ForumTagConfig[] {
  return Array.isArray(tags)
    ? tags.filter((tag): tag is ForumTagConfig => (
      tag != null
      && typeof tag === 'object'
      && typeof (tag as ForumTagConfig).id === 'string'
      && typeof (tag as ForumTagConfig).name === 'string'
    ))
    : [];
}

async function validateForumTags(channelId: string, tags?: string[]) {
  if (!tags || tags.length === 0) return null;

  const [channel] = await db
    .select({ forumTags: channels.forumTags })
    .from(channels)
    .where(eq(channels.id, channelId))
    .limit(1);

  if (!channel) {
    throw new ServiceError('NOT_FOUND', 'Channel not found');
  }

  const configuredTags = normalizeTags(channel.forumTags);
  const validTagIds = new Set(configuredTags.map((tag) => tag.id));
  const uniqueTags = [...new Set(tags)];
  const invalid = uniqueTags.find((tagId) => !validTagIds.has(tagId));
  if (invalid) {
    throw new ServiceError('VALIDATION_ERROR', `Unknown forum tag: ${invalid}`);
  }

  return uniqueTags;
}

export async function createForumThread(data: {
  channelId: string;
  authorId: string;
  name: string;
  messageId?: string;
  body?: string | null;
  attachmentIds?: string[];
  tags?: string[];
  archiveAfter?: number | null;
}) {
  await assertCanSendMessage(data.channelId, data.authorId);
  const normalizedTags = await validateForumTags(data.channelId, data.tags);

  const [thread] = await db.insert(threads).values({
    channelId: data.channelId,
    name: data.name,
    creatorId: data.authorId,
    originMessageId: data.messageId || null,
    forumTagIds: normalizedTags,
    archiveAfter: data.archiveAfter || null,
  }).returning();

  try {
    await db.insert(threadMembers).values({ threadId: thread.id, userId: data.authorId });

    if (data.messageId) {
      await db.update(messages).set({ threadId: thread.id }).where(eq(messages.id, data.messageId));
    }

    const body = data.body?.trim();
    const attachmentIds = data.attachmentIds ?? [];
    if (body || attachmentIds.length > 0) {
      await messageService.createMessage(data.channelId, data.authorId, {
        content: body || null,
        attachmentIds: attachmentIds.length > 0 ? attachmentIds : undefined,
        threadId: thread.id,
      });
    }
  } catch (err) {
    if (data.messageId) {
      await db.update(messages).set({ threadId: null }).where(eq(messages.id, data.messageId));
    }
    await db.delete(threads).where(eq(threads.id, thread.id));
    throw err;
  }

  try {
    getIO().to(`channel:${data.channelId}`).emit('THREAD_CREATE', thread);
  } catch (err) {
    logger.debug({ msg: 'socket emit failed', event: 'THREAD_CREATE', err });
  }

  return thread;
}

export async function updateForumThread(data: {
  threadId: string;
  authorId: string;
  name?: string;
  body?: string | null;
  attachmentIds?: string[];
  tags?: string[];
}) {
  const [thread] = await db.select().from(threads).where(eq(threads.id, data.threadId)).limit(1);
  if (!thread) {
    throw new ServiceError('NOT_FOUND', 'Thread not found');
  }

  await assertCanSendMessage(thread.channelId, data.authorId);

  if (thread.creatorId !== data.authorId) {
    throw new ServiceError('FORBIDDEN', 'You can only edit your own forum posts');
  }

  const [op] = await db.select({
    id: messages.id,
    content: messages.content,
    attachments: messages.attachments,
  })
    .from(messages)
    .where(eq(messages.threadId, thread.id))
    .orderBy(asc(messages.createdAt))
    .limit(1);

  const nextName = data.name !== undefined ? data.name.trim() : thread.name;
  const nextTags = data.tags !== undefined ? await validateForumTags(thread.channelId, data.tags) : thread.forumTagIds;
  const nextContent = data.body !== undefined ? (data.body?.trim() || null) : (op?.content ?? null);
  const currentAttachmentIds = Array.isArray(op?.attachments)
    ? op.attachments
      .map((attachment) => typeof attachment?.id === 'string' ? attachment.id : null)
      .filter((attachmentId): attachmentId is string => Boolean(attachmentId))
    : [];
  const nextAttachmentIds = data.attachmentIds !== undefined ? data.attachmentIds : currentAttachmentIds;
  const updatingOp = data.body !== undefined || data.attachmentIds !== undefined;

  if (updatingOp && !nextContent && nextAttachmentIds.length === 0) {
    throw new ServiceError('VALIDATION_ERROR', 'Forum posts must keep text or at least one attachment');
  }

  const metadataChanged = nextName !== thread.name
    || data.tags !== undefined;
  let updatedThread = thread;

  if (metadataChanged) {
    [updatedThread] = await db.update(threads)
      .set({
        name: nextName,
        forumTagIds: nextTags,
      })
      .where(eq(threads.id, thread.id))
      .returning();
  }

  try {
    if (updatingOp) {
      if (op) {
        await messageService.updateMessage(thread.channelId, op.id, data.authorId, {
          content: nextContent,
          attachmentIds: nextAttachmentIds,
        });
      } else {
        await messageService.createMessage(thread.channelId, data.authorId, {
          content: nextContent,
          attachmentIds: nextAttachmentIds,
          threadId: thread.id,
        });
      }
    }
  } catch (err) {
    if (metadataChanged) {
      await db.update(threads)
        .set({
          name: thread.name,
          forumTagIds: thread.forumTagIds,
        })
        .where(eq(threads.id, thread.id));
    }
    throw err;
  }

  try {
    getIO().to(`channel:${thread.channelId}`).emit('THREAD_UPDATE', updatedThread);
  } catch (err) {
    logger.debug({ msg: 'socket emit failed', event: 'THREAD_UPDATE', err });
  }

  return updatedThread;
}

export async function listForumThreads(channelId: string, userId: string, options: {
  sort?: string;
  filter?: string;
} = {}): Promise<ForumThreadListItem[]> {
  const filter = options.filter || 'active';

  const conditions = [eq(threads.channelId, channelId)];
  if (filter === 'archived') {
    conditions.push(eq(threads.archived, true));
  } else if (filter === 'mine') {
    conditions.push(eq(threads.creatorId, userId));
  } else {
    conditions.push(eq(threads.archived, false));
  }

  const threadList = await db.select({
    id: threads.id,
    channelId: threads.channelId,
    name: threads.name,
    creatorId: threads.creatorId,
    originMessageId: threads.originMessageId,
    archived: threads.archived,
    locked: threads.locked,
    forumTagIds: threads.forumTagIds,
    archiveAfter: threads.archiveAfter,
    createdAt: threads.createdAt,
    creatorName: users.displayName,
    creatorUsername: users.username,
    creatorAvatarHash: users.avatarHash,
  }).from(threads)
    .leftJoin(users, eq(users.id, threads.creatorId))
    .where(and(...conditions))
    .orderBy(desc(threads.createdAt));

  const threadIds = threadList.map((thread) => thread.id);
  const messageCounts = new Map<string, { messageCount: number; lastActivity: string | null }>();
  const opMessages = new Map<string, { content: string | null; attachments: AttachmentSnapshot[] }>();

  if (threadIds.length > 0) {
    const counts = await db.select({
      threadId: messages.threadId,
      messageCount: count(messages.id),
      lastActivity: max(messages.createdAt),
    }).from(messages)
      .where(sql`${messages.threadId} IN (${sql.join(threadIds.map((id) => sql`${id}`), sql`, `)})`)
      .groupBy(messages.threadId);

    for (const item of counts) {
      if (item.threadId) {
        messageCounts.set(item.threadId, {
          messageCount: Number(item.messageCount),
          lastActivity: item.lastActivity ? new Date(item.lastActivity).toISOString() : null,
        });
      }
    }

    const firstMessages = await db.select({
      threadId: messages.threadId,
      content: messages.content,
      attachments: messages.attachments,
      createdAt: messages.createdAt,
    }).from(messages)
      .where(sql`${messages.threadId} IN (${sql.join(threadIds.map((id) => sql`${id}`), sql`, `)})`)
      .orderBy(messages.createdAt);

    for (const msg of firstMessages) {
      if (!msg.threadId || opMessages.has(msg.threadId)) continue;
      opMessages.set(msg.threadId, {
        content: msg.content,
        attachments: Array.isArray(msg.attachments) ? msg.attachments as AttachmentSnapshot[] : [],
      });
    }
  }

  const result = threadList.map((thread) => {
    const countsForThread = messageCounts.get(thread.id);
    const op = opMessages.get(thread.id);
    const opAttachment = op?.attachments.find((attachment) => attachment.mimeType?.startsWith('image/'))
      ?? op?.attachments[0]
      ?? null;
    const tags = thread.forumTagIds ?? [];

    return {
      id: thread.id,
      channelId: thread.channelId,
      name: thread.name,
      creatorId: thread.creatorId,
      creatorName: thread.creatorName ?? thread.creatorUsername ?? 'Unknown',
      creatorAvatarHash: thread.creatorAvatarHash,
      originMessageId: thread.originMessageId,
      archived: thread.archived,
      locked: thread.locked,
      forumTagIds: tags,
      tags,
      archiveAfter: thread.archiveAfter,
      createdAt: thread.createdAt,
      messageCount: countsForThread?.messageCount ?? 0,
      lastActivity: countsForThread?.lastActivity ?? (thread.createdAt ? new Date(thread.createdAt).toISOString() : null),
      opPreview: op?.content ?? null,
      opAttachment,
    };
  });

  if (options.sort === 'top') {
    result.sort((a, b) => b.messageCount - a.messageCount);
  } else {
    result.sort((a, b) => {
      const aTime = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
      const bTime = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
      return bTime - aTime;
    });
  }

  return result;
}

export async function getThreadMessages(threadId: string, options: {
  before?: string;
  limit?: number;
} = {}): Promise<ThreadMessageListItem[]> {
  const limit = Math.min(options.limit ?? 50, 100);
  let beforeCreatedAt: Date | undefined;

  if (options.before) {
    const [cursor] = await db.select({ createdAt: messages.createdAt })
      .from(messages)
      .where(and(eq(messages.threadId, threadId), eq(messages.id, options.before)))
      .limit(1);

    if (cursor?.createdAt) {
      beforeCreatedAt = cursor.createdAt;
    }
  }

  const rows = await db.select({
    id: messages.id,
    channelId: messages.channelId,
    content: messages.content,
    attachments: messages.attachments,
    edited: messages.edited,
    editedAt: messages.editedAt,
    createdAt: messages.createdAt,
    authorId: messages.authorId,
    threadId: messages.threadId,
    replyToId: messages.replyToId,
    authorUsername: users.username,
    authorDisplayName: users.displayName,
    authorAvatarHash: users.avatarHash,
  })
    .from(messages)
    .leftJoin(users, eq(users.id, messages.authorId))
    .where(and(
      eq(messages.threadId, threadId),
      ...(beforeCreatedAt ? [lt(messages.createdAt, beforeCreatedAt)] : []),
    ))
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    channelId: row.channelId,
    authorId: row.authorId,
    content: row.content,
    attachments: Array.isArray(row.attachments) ? row.attachments as AttachmentSnapshot[] : [],
    edited: row.edited,
    editedAt: row.editedAt,
    createdAt: row.createdAt,
    threadId: row.threadId,
    replyToId: row.replyToId,
    author: row.authorId ? {
      id: row.authorId,
      username: row.authorUsername,
      displayName: row.authorDisplayName,
      avatarHash: row.authorAvatarHash,
    } : null,
  }));
}
