import { Router, Request, Response } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db/index';
import { requireAuth } from '../middleware/auth';
import { handleAppError } from '../lib/errors.js';

export const friendSuggestionsRouter = Router();

// ---------------------------------------------------------------------------
// GET /api/v1/friend-suggestions — Users sharing servers but not friends
// ---------------------------------------------------------------------------
friendSuggestionsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).userId as string;

    // Find users who share guilds with the current user but are NOT friends/blocked/pending.
    // Rank by: number of shared servers + mutual friend count (approximated by shared servers).
    const rows = await db.execute(sql`
      WITH my_guilds AS (
        SELECT guild_id FROM guild_members WHERE user_id = ${userId}
      ),
      candidates AS (
        SELECT gm.user_id,
               COUNT(DISTINCT gm.guild_id) AS shared_servers
        FROM guild_members gm
        INNER JOIN my_guilds mg ON mg.guild_id = gm.guild_id
        WHERE gm.user_id != ${userId}
          AND gm.user_id NOT IN (
            SELECT CASE WHEN requester_id = ${userId} THEN addressee_id ELSE requester_id END
            FROM relationships
            WHERE requester_id = ${userId} OR addressee_id = ${userId}
          )
        GROUP BY gm.user_id
      ),
      mutual_counts AS (
        SELECT c.user_id,
               c.shared_servers,
               COUNT(DISTINCT mf.addressee_id) AS mutual_friends
        FROM candidates c
        LEFT JOIN relationships mf
          ON mf.requester_id = c.user_id
          AND mf.type = 'FRIEND'
          AND mf.addressee_id IN (
            SELECT addressee_id FROM relationships WHERE requester_id = ${userId} AND type = 'FRIEND'
          )
        GROUP BY c.user_id, c.shared_servers
      )
      SELECT mc.user_id AS id,
             u.username,
             u.display_name,
             u.avatar_hash,
             mc.shared_servers::int AS "sharedServers",
             mc.mutual_friends::int AS "mutualFriends"
      FROM mutual_counts mc
      INNER JOIN users u ON u.id = mc.user_id
      WHERE u.deleted_at IS NULL
      ORDER BY (mc.shared_servers + mc.mutual_friends) DESC, mc.shared_servers DESC
      LIMIT 20
    `);

    res.json(rows.rows ?? []);
  } catch (err) {
    handleAppError(res, err, 'friend-suggestions');
  }
});
