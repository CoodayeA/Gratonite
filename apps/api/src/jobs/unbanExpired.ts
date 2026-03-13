import { eq, lt, and, isNotNull, inArray } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { db } from '../db/index';
import { guildBans } from '../db/schema/bans';
import { getIO } from '../lib/socket-io';

/**
 * Background job: every 60 seconds, find expired temp bans and remove them.
 */
export function startUnbanExpiredJob(): void {
  setInterval(async () => {
    try {
      const expired = await db
        .select({ id: guildBans.id, guildId: guildBans.guildId, userId: guildBans.userId })
        .from(guildBans)
        .where(and(isNotNull(guildBans.expiresAt), lt(guildBans.expiresAt, new Date())));

      if (expired.length > 0) {
        await db.delete(guildBans).where(inArray(guildBans.id, expired.map(b => b.id)));

        const io = getIO();
        for (const ban of expired) {
          try {
            io.to(`guild:${ban.guildId}`).emit('GUILD_BAN_REMOVE', {
              guildId: ban.guildId,
              userId: ban.userId,
            });
          } catch { /* socket may not be initialised */ }
        }
      }

      if (expired.length > 0) {
        console.info(`[unban-expired] Removed ${expired.length} expired ban(s)`);
      }
    } catch (err) {
      logger.error('[unban-expired] Error:', err);
    }
  }, 60_000);
}
