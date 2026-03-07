import { db } from '../db/index';
import { scheduledMessages } from '../db/schema/scheduled-messages';
import { messages } from '../db/schema/messages';
import { lte, isNull, and, eq } from 'drizzle-orm';
import { getIO } from '../lib/socket-io';

export function startScheduledMessagesJob() {
  setInterval(async () => {
    try {
      const pending = await db
        .select()
        .from(scheduledMessages)
        .where(and(
          lte(scheduledMessages.scheduledAt, new Date()),
          isNull(scheduledMessages.sentAt),
          isNull(scheduledMessages.cancelledAt),
        ));

      for (const sm of pending) {
        try {
          const [msg] = await db.insert(messages).values({
            channelId: sm.channelId,
            authorId: sm.authorId,
            content: sm.content,
            attachments: sm.attachments as any[],
          }).returning();

          await db.update(scheduledMessages)
            .set({ sentAt: new Date() })
            .where(eq(scheduledMessages.id, sm.id));

          try {
            getIO().to(`channel:${sm.channelId}`).emit('MESSAGE_CREATE', msg);
          } catch { /* socket not ready */ }
        } catch (err) {
          console.error('[scheduledMessages] Error sending scheduled message:', err);
        }
      }
    } catch (err) {
      console.error('[scheduledMessages] Job error:', err);
    }
  }, 30_000);
}
