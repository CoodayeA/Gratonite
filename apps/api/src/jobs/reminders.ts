import { db } from '../db/index';
import { logger } from '../lib/logger';
import { messageReminders } from '../db/schema/message-reminders';
import { messages } from '../db/schema/messages';
import { lte, and, eq } from 'drizzle-orm';
import { getIO } from '../lib/socket-io';

export function startRemindersJob() {
  setInterval(async () => {
    try {
      const due = await db
        .select({
          id: messageReminders.id,
          userId: messageReminders.userId,
          messageId: messageReminders.messageId,
          channelId: messageReminders.channelId,
          guildId: messageReminders.guildId,
          note: messageReminders.note,
          messageContent: messages.content,
        })
        .from(messageReminders)
        .leftJoin(messages, eq(messageReminders.messageId, messages.id))
        .where(and(
          lte(messageReminders.remindAt, new Date()),
          eq(messageReminders.fired, false),
        ));

      for (const reminder of due) {
        try {
          await db.update(messageReminders)
            .set({ fired: true })
            .where(eq(messageReminders.id, reminder.id));

          try {
            getIO().to(`user:${reminder.userId}`).emit('REMINDER_FIRED', {
              id: reminder.id,
              messageId: reminder.messageId,
              channelId: reminder.channelId,
              guildId: reminder.guildId,
              note: reminder.note,
              messageContent: reminder.messageContent,
            });
          } catch { /* socket not ready */ }
        } catch (err) {
          logger.error('[reminders] Error firing reminder:', err);
        }
      }
    } catch (err) {
      logger.error('[reminders] Job error:', err);
    }
  }, 30_000);
}
