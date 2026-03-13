import { lt, and, isNotNull } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { db } from '../db/index';
import { users } from '../db/schema/users';

/**
 * Background job: every 5 minutes, null out expired status_emoji/status_expires_at.
 */
export function startExpireStatusesJob(): void {
  setInterval(async () => {
    try {
      await db
        .update(users)
        .set({ statusEmoji: null, statusExpiresAt: null })
        .where(and(isNotNull(users.statusExpiresAt), lt(users.statusExpiresAt, new Date())));
    } catch (err) {
      logger.error('[expire-statuses] Error:', err);
    }
  }, 5 * 60_000); // 5 minutes
}
