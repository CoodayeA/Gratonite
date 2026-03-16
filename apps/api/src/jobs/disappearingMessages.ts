/**
 * jobs/disappearingMessages.ts — Background cron job for disappearing messages.
 *
 * Every 30 seconds, deletes messages whose `expires_at` has passed and emits
 * `MESSAGE_DELETE` socket events so clients remove them in real time.
 *
 * This is a thin wrapper around the shared processMessageExpiry() function
 * in lib/message-expiry.ts, which handles the actual deletion logic.
 */

import { lt, isNotNull, and } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { db } from '../db/index';
import { messages } from '../db/schema/messages';
import { getIO } from '../lib/socket-io';

/** Core processor — used by both the legacy setInterval and BullMQ worker. */
export async function processDisappearingMessages(): Promise<void> {
  const now = new Date();

  const deleted = await db
    .delete(messages)
    .where(and(isNotNull(messages.expiresAt), lt(messages.expiresAt, now)))
    .returning({ id: messages.id, channelId: messages.channelId });

  if (deleted.length === 0) return;

  const io = getIO();

  // Group by channel to minimise emit calls.
  const byChannel = new Map<string, string[]>();
  for (const { id, channelId } of deleted) {
    if (!byChannel.has(channelId)) byChannel.set(channelId, []);
    byChannel.get(channelId)!.push(id);
  }

  for (const [channelId, ids] of byChannel) {
    for (const id of ids) {
      try {
        io.to(`channel:${channelId}`).emit('MESSAGE_DELETE', { id, channelId });
      } catch {
        // Non-fatal if socket unavailable for this channel.
      }
    }
  }

  logger.info(`[disappearingMessages] Deleted ${deleted.length} expired message(s)`);
}

/** @deprecated Legacy setInterval starter — kept for fallback. Use BullMQ worker instead. */
export function startDisappearingMessagesJob() {
  setInterval(async () => {
    try {
      await processDisappearingMessages();
    } catch (err) {
      logger.error('[disappearingMessages] Job error:', err);
    }
  }, 30_000);
}
