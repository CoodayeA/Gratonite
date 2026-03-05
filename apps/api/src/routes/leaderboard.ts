/**
 * routes/leaderboard.ts — Express router for leaderboard endpoints.
 *
 * Mounted at /api/v1 by src/routes/index.ts (root-level paths).
 *
 * Endpoints:
 *   GET /leaderboard                     — Global leaderboard (all guilds)
 *   GET /guilds/:guildId/leaderboard     — Per-guild leaderboard
 *
 * Both endpoints support a `period` query param: 'week' | 'month' | 'all'.
 * Results are ordered by message count descending, limited to top 50.
 *
 * @module routes/leaderboard
 */

import { Router, Request, Response } from 'express';
import { sql, eq, and, gte, desc } from 'drizzle-orm';

import { db } from '../db/index';
import { users } from '../db/schema/users';
import { guildMembers } from '../db/schema/guilds';
import { fameTransactions } from '../db/schema/fameTransactions';
import { requireAuth } from '../middleware/auth';

export const leaderboardRouter = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the `period` query param into a Date cutoff.
 * Returns null for 'all' (no date filter).
 */
function periodCutoff(period: string | undefined): Date | null {
  const now = new Date();
  switch (period) {
    case 'week': {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return d;
    }
    case 'month': {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 1);
      return d;
    }
    case 'all':
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// GET /leaderboard — Global leaderboard
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/leaderboard?period=week|month|all
 *
 * Returns top users across all guilds ranked by message count.
 * Each entry includes rank, userId, username, displayName, avatarHash,
 * messageCount, gratonitesEarned (derived from messageCount), and memberSince.
 *
 * @auth    requireAuth
 * @query   period? {string} — 'week' | 'month' | 'all' (default: 'week')
 * @returns 200 Array of leaderboard entries
 */
leaderboardRouter.get(
  '/leaderboard',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const period = typeof req.query.period === 'string' ? req.query.period : 'week';
      const cutoff = periodCutoff(period);

      // Build date condition on fame transactions
      const dateCondition = cutoff
        ? gte(fameTransactions.createdAt, cutoff)
        : undefined;

      const conditions = dateCondition ? [dateCondition] : [];

      // Aggregate fame received by user
      const rows = await db
        .select({
          userId: fameTransactions.receiverId,
          username: users.username,
          displayName: users.displayName,
          avatarHash: users.avatarHash,
          fameReceived: sql<number>`count(*)::int`.as('fame_received'),
          memberSince: users.createdAt,
        })
        .from(fameTransactions)
        .innerJoin(users, eq(users.id, fameTransactions.receiverId))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .groupBy(fameTransactions.receiverId, users.username, users.displayName, users.avatarHash, users.createdAt)
        .orderBy(desc(sql`count(*)`))
        .limit(50);

      const result = rows.map((row, i) => ({
        rank: i + 1,
        userId: row.userId,
        username: row.username,
        displayName: row.displayName,
        avatarHash: row.avatarHash,
        fameReceived: row.fameReceived,
        memberSince: row.memberSince?.toISOString() ?? null,
      }));

      res.status(200).json(result);
    } catch (err) {
      console.error('[leaderboard] global error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /guilds/:guildId/leaderboard — Per-guild leaderboard
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/guilds/:guildId/leaderboard?period=week|month|all
 *
 * Returns top members of a specific guild ranked by message count in that
 * guild's channels. The caller must be a member of the guild.
 *
 * @auth    requireAuth
 * @param   guildId {string} — Guild UUID
 * @query   period? {string} — 'week' | 'month' | 'all' (default: 'week')
 * @returns 200 Array of leaderboard entries
 * @returns 403 Not a member
 */
leaderboardRouter.get(
  '/guilds/:guildId/leaderboard',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { guildId } = req.params as Record<string, string>;
      const period = typeof req.query.period === 'string' ? req.query.period : 'week';
      const cutoff = periodCutoff(period);

      // Check membership
      const [membership] = await db
        .select({ id: guildMembers.id })
        .from(guildMembers)
        .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, req.userId!)))
        .limit(1);

      if (!membership) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'You are not a member of this guild' });
        return;
      }

      // Build conditions: fame transactions in this guild
      const dateCondition = cutoff
        ? gte(fameTransactions.createdAt, cutoff)
        : undefined;

      const conditions = [
        eq(fameTransactions.guildId, guildId),
        ...(dateCondition ? [dateCondition] : []),
      ];

      const rows = await db
        .select({
          userId: fameTransactions.receiverId,
          username: users.username,
          displayName: users.displayName,
          avatarHash: users.avatarHash,
          fameReceived: sql<number>`count(*)::int`.as('fame_received'),
          joinedAt: guildMembers.joinedAt,
        })
        .from(fameTransactions)
        .innerJoin(users, eq(users.id, fameTransactions.receiverId))
        .innerJoin(
          guildMembers,
          and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, fameTransactions.receiverId)),
        )
        .where(and(...conditions))
        .groupBy(
          fameTransactions.receiverId,
          users.username,
          users.displayName,
          users.avatarHash,
          guildMembers.joinedAt,
        )
        .orderBy(desc(sql`count(*)`))
        .limit(50);

      const result = rows.map((row, i) => ({
        rank: i + 1,
        userId: row.userId,
        username: row.username,
        displayName: row.displayName,
        avatarHash: row.avatarHash,
        fameReceived: row.fameReceived,
        memberSince: row.joinedAt?.toISOString() ?? null,
      }));

      res.status(200).json(result);
    } catch (err) {
      console.error('[leaderboard] guild error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);
