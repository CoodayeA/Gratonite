/**
 * message-expiry.ts — Background cron job for disappearing messages.
 *
 * Every 60 seconds, deletes messages whose `expires_at` has passed and emits
 * `MESSAGE_DELETE` socket events so clients remove them in real time.
 *
 * Started from `src/index.ts` after the HTTP server is listening.
 */

import { lt } from 'drizzle-orm';
import { logger } from './logger';
import { db } from '../db/index';
import { messages } from '../db/schema/messages';
import { getIO } from './socket-io';

const INTERVAL_MS = 60_000;

/** Core processor — used by both the legacy setInterval and BullMQ worker. */
export async function processMessageExpiry(): Promise<void> {
  const now = new Date();

  const deleted = await db
    .delete(messages)
    .where(lt(messages.expiresAt, now))
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

  console.info(`[message-expiry] Deleted ${deleted.length} expired message(s)`);
}

/** @deprecated Legacy setInterval starter — kept for fallback. Use BullMQ worker instead. */
export function startMessageExpiryCron(): void {
  setInterval(async () => {
    try {
      await processMessageExpiry();
    } catch (err) {
      logger.error('[message-expiry] Error during expiry sweep:', err);
    }
  }, INTERVAL_MS);
}
