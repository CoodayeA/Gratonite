import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, desc, count, max, sql, asc } from 'drizzle-orm';
import { db } from '../db/index';
import { threads, threadMembers } from '../db/schema/threads';
import { messages } from '../db/schema/messages';
import { users } from '../db/schema/users';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { getIO } from '../lib/socket-io';

export const threadsRouter = Router({ mergeParams: true });

const createThreadSchema = z.object({
  name: z.string().min(1).max(100),
  messageId: z.string().uuid().optional(),
  body: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

/** POST /channels/:channelId/threads */
threadsRouter.post('/', requireAuth, validate(createThreadSchema), async (req: Request, res: Response): Promise<void> => {
  const { channelId } = req.params as Record<string, string>;
  const { name, messageId, body } = req.body;

  const [thread] = await db.insert(threads).values({
    channelId,
    name,
    creatorId: req.userId!,
    originMessageId: messageId || null,
  }).returning();

  // Auto-join creator
  await db.insert(threadMembers).values({ threadId: thread.id, userId: req.userId! });

  // If created from a message, update the message's threadId
  if (messageId) {
    await db.update(messages).set({ threadId: thread.id }).where(eq(messages.id, messageId));
  }

  // If a body is provided (forum post), create the initial message in the thread
  if (body && body.trim()) {
    await db.insert(messages).values({
      channelId,
      authorId: req.userId!,
      content: body.trim(),
      threadId: thread.id,
    });
  }

  try {
    getIO().to(`channel:${channelId}`).emit('THREAD_CREATE', thread);
  } catch {}

  res.status(201).json(thread);
});

/** GET /channels/:channelId/threads?sort=latest|top */
threadsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { channelId } = req.params as Record<string, string>;
  const sortParam = (req.query.sort as string) || 'latest';

  // Fetch threads with creator info
  const threadList = await db.select({
    id: threads.id,
    channelId: threads.channelId,
    name: threads.name,
    creatorId: threads.creatorId,
    originMessageId: threads.originMessageId,
    archived: threads.archived,
    locked: threads.locked,
    createdAt: threads.createdAt,
    creatorName: users.displayName,
    creatorUsername: users.username,
    creatorAvatarHash: users.avatarHash,
  }).from(threads)
    .leftJoin(users, eq(users.id, threads.creatorId))
    .where(and(eq(threads.channelId, channelId), eq(threads.archived, false)))
    .orderBy(desc(threads.createdAt));

  // Fetch message counts for each thread
  const threadIds = threadList.map(t => t.id);
  let messageCounts: Record<string, { messageCount: number; lastActivity: string | null }> = {};
  if (threadIds.length > 0) {
    const counts = await db.select({
      threadId: messages.threadId,
      messageCount: count(messages.id),
      lastActivity: max(messages.createdAt),
    }).from(messages)
      .where(sql`${messages.threadId} IN (${sql.join(threadIds.map(id => sql`${id}`), sql`, `)})`)
      .groupBy(messages.threadId);

    for (const c of counts) {
      if (c.threadId) {
        messageCounts[c.threadId] = {
          messageCount: Number(c.messageCount),
          lastActivity: c.lastActivity ? new Date(c.lastActivity).toISOString() : null,
        };
      }
    }
  }

  let result = threadList.map(t => ({
    id: t.id,
    channelId: t.channelId,
    name: t.name,
    creatorId: t.creatorId,
    creatorName: t.creatorName ?? t.creatorUsername ?? 'Unknown',
    creatorAvatarHash: t.creatorAvatarHash,
    originMessageId: t.originMessageId,
    archived: t.archived,
    locked: t.locked,
    createdAt: t.createdAt,
    messageCount: messageCounts[t.id]?.messageCount ?? 0,
    lastActivity: messageCounts[t.id]?.lastActivity ?? (t.createdAt ? new Date(t.createdAt).toISOString() : null),
  }));

  // Sort
  if (sortParam === 'top') {
    result.sort((a, b) => b.messageCount - a.messageCount);
  } else {
    // 'latest' — sort by last activity
    result.sort((a, b) => {
      const aTime = a.lastActivity ? new Date(a.lastActivity).getTime() : 0;
      const bTime = b.lastActivity ? new Date(b.lastActivity).getTime() : 0;
      return bTime - aTime;
    });
  }

  res.json(result);
});

/** GET /threads/:threadId */
threadsRouter.get('/:threadId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { threadId } = req.params as Record<string, string>;
  const [thread] = await db.select().from(threads).where(eq(threads.id, threadId)).limit(1);
  if (!thread) { res.status(404).json({ code: 'NOT_FOUND', message: 'Thread not found' }); return; }

  // Get member count
  const members = await db.select({ userId: threadMembers.userId }).from(threadMembers).where(eq(threadMembers.threadId, threadId));

  res.json({ ...thread, memberCount: members.length });
});

/** GET /threads/:threadId/messages — same as channel messages but scoped to thread */
threadsRouter.get('/:threadId/messages', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { threadId } = req.params as Record<string, string>;
  const limit = Math.min(Number(req.query.limit) || 50, 100);

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
    .where(eq(messages.threadId, threadId))
    .orderBy(desc(messages.createdAt))
    .limit(limit);

  res.json(rows.map(r => ({
    id: r.id,
    channelId: r.channelId,
    authorId: r.authorId,
    content: r.content,
    attachments: r.attachments,
    edited: r.edited,
    editedAt: r.editedAt,
    createdAt: r.createdAt,
    threadId: r.threadId,
    replyToId: r.replyToId,
    author: r.authorId ? { id: r.authorId, username: r.authorUsername, displayName: r.authorDisplayName, avatarHash: r.authorAvatarHash } : null,
  })));
});
