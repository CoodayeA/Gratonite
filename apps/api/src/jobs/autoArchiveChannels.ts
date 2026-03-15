import { eq, and, isNotNull, sql, ne } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { db } from '../db/index';
import { channels } from '../db/schema/channels';
import { messages } from '../db/schema/messages';
import { getIO } from '../lib/socket-io';

/** BullMQ processor — executes the auto-archive logic. */
export async function processAutoArchiveChannels(): Promise<void> {
  await runAutoArchive();
}

/**
 * @deprecated Use BullMQ scheduler in worker.ts instead.
 * Background job: every hour, find channels with auto_archive_days set
 * that have had no messages for N days, and archive them.
 */
export function startAutoArchiveChannelsJob(): void {
  // Run once on startup after a short delay, then every hour
  setTimeout(runAutoArchive, 30_000);
  setInterval(runAutoArchive, 60 * 60 * 1000);
}

async function runAutoArchive(): Promise<void> {
  try {
    // Find all guild channels with auto_archive_days set, not already archived
    const candidates = await db
      .select({
        id: channels.id,
        guildId: channels.guildId,
        name: channels.name,
        autoArchiveDays: channels.autoArchiveDays,
      })
      .from(channels)
      .where(
        and(
          isNotNull(channels.autoArchiveDays),
          isNotNull(channels.guildId),
          eq(channels.archived, false),
          ne(channels.type, 'GUILD_CATEGORY'),
        ),
      );

    if (candidates.length === 0) return;

    let archivedCount = 0;

    for (const ch of candidates) {
      if (!ch.autoArchiveDays || ch.autoArchiveDays <= 0) continue;

      const cutoff = new Date(Date.now() - ch.autoArchiveDays * 86400000);

      // Check if there are any messages after the cutoff
      const [recent] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(messages)
        .where(
          and(
            eq(messages.channelId, ch.id),
            sql`${messages.createdAt} > ${cutoff}`,
          ),
        );

      if (recent && recent.count === 0) {
        // No messages in the configured period — archive
        await db
          .update(channels)
          .set({ archived: true, updatedAt: new Date() })
          .where(eq(channels.id, ch.id));

        archivedCount++;

        // Emit channel update so clients see the archive state
        if (ch.guildId) {
          try {
            getIO().to(`guild:${ch.guildId}`).emit('CHANNEL_UPDATE', {
              channelId: ch.id,
              guildId: ch.guildId,
              archived: true,
            });
          } catch { /* socket may not be initialised */ }
        }
      }
    }

    if (archivedCount > 0) {
      console.info(`[auto-archive] Archived ${archivedCount} inactive channel(s)`);
    }
  } catch (err) {
    logger.error('[auto-archive] Error:', err);
  }
}
