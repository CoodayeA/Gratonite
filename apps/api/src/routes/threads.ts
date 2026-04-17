import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/index';
import { threads, threadMembers } from '../db/schema/threads';
import { messages } from '../db/schema/messages';
import { users } from '../db/schema/users';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createForumThread, getThreadMessages, listForumThreads } from '../services/thread.service';
import { ServiceError } from '../services/message.service';

export const threadsRouter = Router({ mergeParams: true });

const VALID_ARCHIVE_AFTER = [3600, 86400, 259200, 604800]; // 1h, 24h, 3d, 1w

const createThreadSchema = z.object({
  name: z.string().min(1).max(100),
  messageId: z.string().uuid().optional(),
  body: z.string().optional().nullable(),
  attachmentIds: z.array(z.string().uuid()).optional(),
  tags: z.array(z.string()).optional(),
  archiveAfter: z.number().int().refine(v => VALID_ARCHIVE_AFTER.includes(v)).optional(),
});

/** POST /channels/:channelId/threads */
threadsRouter.post('/', requireAuth, validate(createThreadSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelId } = req.params as Record<string, string>;
    const { name, messageId, body, attachmentIds, tags, archiveAfter } = req.body as z.infer<typeof createThreadSchema>;

    const thread = await createForumThread({
      channelId,
      authorId: req.userId!,
      name,
      messageId,
      body,
      attachmentIds,
      tags,
      archiveAfter,
    });

    res.status(201).json(thread);
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
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to create thread' });
  }
});

/** GET /channels/:channelId/threads?sort=latest|top&filter=active|archived|mine */
threadsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { channelId } = req.params as Record<string, string>;
  const sortParam = (req.query.sort as string) || 'latest';
  const filter = (req.query.filter as string) || 'active';

  const result = await listForumThreads(channelId, req.userId!, { sort: sortParam, filter });

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
  const before = typeof req.query.before === 'string' ? req.query.before : undefined;
  const rows = await getThreadMessages(threadId, { before, limit });
  res.json(rows);
});
