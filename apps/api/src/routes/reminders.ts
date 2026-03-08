import { Router, Request, Response } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/index';
import { messageReminders } from '../db/schema/message-reminders';
import { messages } from '../db/schema/messages';
import { channels } from '../db/schema/channels';
import { requireAuth } from '../middleware/auth';

export const remindersRouter = Router();

// POST /reminders — create reminder
remindersRouter.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { messageId, channelId, guildId, remindAt, note } = req.body as {
    messageId: string;
    channelId: string;
    guildId?: string;
    remindAt: string;
    note?: string;
  };

  if (!messageId || !channelId || !remindAt) {
    res.status(400).json({ error: 'messageId, channelId, and remindAt are required' });
    return;
  }

  const remindDate = new Date(remindAt);
  if (isNaN(remindDate.getTime()) || remindDate <= new Date()) {
    res.status(400).json({ error: 'remindAt must be a valid future date' });
    return;
  }

  const [reminder] = await db.insert(messageReminders).values({
    userId: req.userId!,
    messageId,
    channelId,
    guildId: guildId || null,
    remindAt: remindDate,
    note: note || null,
  }).returning();

  res.status(201).json(reminder);
});

// GET /reminders — list my active reminders
remindersRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const rows = await db.select({
    id: messageReminders.id,
    messageId: messageReminders.messageId,
    channelId: messageReminders.channelId,
    guildId: messageReminders.guildId,
    remindAt: messageReminders.remindAt,
    note: messageReminders.note,
    createdAt: messageReminders.createdAt,
    messageContent: messages.content,
    channelName: channels.name,
  })
    .from(messageReminders)
    .leftJoin(messages, eq(messageReminders.messageId, messages.id))
    .leftJoin(channels, eq(messageReminders.channelId, channels.id))
    .where(and(
      eq(messageReminders.userId, req.userId!),
      eq(messageReminders.fired, false),
    ))
    .orderBy(desc(messageReminders.remindAt));

  res.json(rows);
});

// DELETE /reminders/:id — cancel a reminder
remindersRouter.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params as Record<string, string>;

  const [existing] = await db.select().from(messageReminders)
    .where(and(eq(messageReminders.id, id), eq(messageReminders.userId, req.userId!)))
    .limit(1);

  if (!existing) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Reminder not found' });
    return;
  }

  await db.delete(messageReminders).where(eq(messageReminders.id, id));
  res.json({ code: 'OK', message: 'Reminder cancelled' });
});
