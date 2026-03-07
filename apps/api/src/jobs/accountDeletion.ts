import { db } from '../db/index';
import { sql } from 'drizzle-orm';

export function startAccountDeletionJob() {
  setInterval(async () => {
    try {
      await db.execute(sql`
        UPDATE users
        SET
          username = 'deleted_' || substring(id::text, 1, 8),
          email = 'deleted_' || substring(id::text, 1, 8) || '@deleted.local',
          avatar_hash = NULL,
          display_name = 'Deleted User',
          deleted_at = now()
        WHERE
          deletion_requested_at IS NOT NULL
          AND deletion_requested_at < now() - interval '30 days'
          AND deleted_at IS NULL
      `);
    } catch (err) {
      console.error('[accountDeletion] Job error:', err);
    }
  }, 24 * 60 * 60 * 1000);
}
