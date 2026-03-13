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
import { logger } from '../lib/logger';
import { sql, eq, and, gte, desc } from 'drizzle-orm';

import { db } from '../db/index';
import { users } from '../db/schema/users';
import { guildMembers } from '../db/schema/guilds';
import { fameTransactions } from '../db/schema/fameTransactions';
import { requireAuth } from '../middleware/auth';
import { toRows } from '../lib/to-rows.js';
import { redis } from '../lib/redis';

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
// ---------------------------------------------------------------------------
// GET /leaderboard/global — Global leaderboard with metric support (Wave 3)
// ---------------------------------------------------------------------------

leaderboardRouter.get(
  '/leaderboard/global',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const metric = typeof req.query.metric === 'string' ? req.query.metric : 'level';
      const page = Math.max(Math.min(Number(req.query.page) || 0, 200), 0); // cap at page 200 (10000 / 50)
      const offset = Math.min(page * 50, 10000);

      // Check Redis cache
      const cacheKey = `leaderboard:global:${metric}:${page}`;
      const cached = await redis.get(cacheKey);
      if (cached) {
        res.status(200).json(JSON.parse(cached));
        return;
      }

      type LeaderboardRow = { userId: string; username: string; displayName: string; avatarHash: string | null; score: number };

      let rawResult: unknown;

      if (metric === 'level' || metric === 'xp') {
        rawResult = await db.execute(sql`
          SELECT id as "userId", username, display_name as "displayName", avatar_hash as "avatarHash",
                 COALESCE(level, 1) as score
          FROM users
          ORDER BY COALESCE(xp, 0) DESC
          LIMIT 50 OFFSET ${offset}
        `);
      } else if (metric === 'coins') {
        rawResult = await db.execute(sql`
          SELECT id as "userId", username, display_name as "displayName", avatar_hash as "avatarHash",
                 COALESCE(coins, 0) as score
          FROM users
          ORDER BY COALESCE(coins, 0) DESC
          LIMIT 50 OFFSET ${offset}
        `);
      } else {
        // messages — use fame transactions as proxy
        rawResult = await db.execute(sql`
          SELECT u.id as "userId", u.username, u.display_name as "displayName", u.avatar_hash as "avatarHash",
                 COUNT(ft.id)::int as score
          FROM users u
          LEFT JOIN fame_transactions ft ON ft.receiver_id = u.id
          GROUP BY u.id
          ORDER BY COUNT(ft.id) DESC
          LIMIT 50 OFFSET ${offset}
        `);
      }

      const result = toRows<LeaderboardRow>(rawResult).map((row, i) => ({
        rank: offset + i + 1,
        userId: row.userId,
        username: row.username,
        displayName: row.displayName,
        avatarHash: row.avatarHash,
        score: Number(row.score ?? 0),
        level: metric === 'level' ? Number(row.score ?? 1) : undefined,
        coins: metric === 'coins' ? Number(row.score ?? 0) : undefined,
      }));

      await redis.set(cacheKey, JSON.stringify(result), 'EX', 300); // 5 min cache
      res.status(200).json(result);
    } catch (err) {
      logger.error('[leaderboard] global/metric error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /leaderboard — Global leaderboard (legacy fame-based)
// ---------------------------------------------------------------------------

leaderboardRouter.get(
  '/leaderboard',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const period = typeof req.query.period === 'string' ? req.query.period : 'week';
      const page = Math.max(Math.min(Number(req.query.page) || 0, 200), 0);
      const offset = Math.min(page * 50, 10000);
      const cutoff = periodCutoff(period);

      // Check Redis cache
      const cacheKey = `leaderboard:legacy:${period}:${page}`;
      const cached = await redis.get(cacheKey);
      if (cached) {
        res.status(200).json(JSON.parse(cached));
        return;
      }

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
        .limit(50)
        .offset(offset);

      const result = rows.map((row, i) => ({
        rank: offset + i + 1,
        userId: row.userId,
        username: row.username,
        displayName: row.displayName,
        avatarHash: row.avatarHash,
        fameReceived: row.fameReceived,
        memberSince: row.memberSince?.toISOString() ?? null,
      }));

      await redis.set(cacheKey, JSON.stringify(result), 'EX', 300); // 5 min cache
      res.status(200).json(result);
    } catch (err) {
      logger.error('[leaderboard] global error:', err);
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
      const metric = typeof req.query.metric === 'string' ? req.query.metric : 'messages';
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

      // For level/coins metrics — pull from users directly, filtered to guild members
      if (metric === 'level' || metric === 'coins') {
        type GuildLeaderboardRow = { userId: string; username: string; displayName: string; avatarHash: string | null; score: number; joinedAt: string | null };
        const orderCol = metric === 'level' ? 'COALESCE(u.xp, 0)' : 'COALESCE(u.coins, 0)';
        const scoreCol = metric === 'level' ? 'COALESCE(u.level, 1)' : 'COALESCE(u.coins, 0)';
        const rawResult = await db.execute(sql`
          SELECT u.id as "userId", u.username, u.display_name as "displayName", u.avatar_hash as "avatarHash",
                 ${sql.raw(scoreCol)} as score, gm.joined_at as "joinedAt"
          FROM users u
          INNER JOIN guild_members gm ON gm.guild_id = ${guildId}::uuid AND gm.user_id = u.id
          ORDER BY ${sql.raw(orderCol)} DESC
          LIMIT 10
        `);
        const data = toRows<GuildLeaderboardRow>(rawResult);
        res.status(200).json(data.map((row, i) => ({
          rank: i + 1,
          userId: row.userId,
          username: row.username,
          displayName: row.displayName,
          avatarHash: row.avatarHash,
          score: Number(row.score ?? 0),
          level: metric === 'level' ? Number(row.score ?? 1) : undefined,
          coins: metric === 'coins' ? Number(row.score ?? 0) : undefined,
          memberSince: row.joinedAt ? new Date(row.joinedAt).toISOString() : null,
        })));
        return;
      }

      // Default: messages — use fame transactions
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
        .limit(10);

      const result = rows.map((row, i) => ({
        rank: i + 1,
        userId: row.userId,
        username: row.username,
        displayName: row.displayName,
        avatarHash: row.avatarHash,
        score: row.fameReceived,
        memberSince: row.joinedAt?.toISOString() ?? null,
      }));

      res.status(200).json(result);
    } catch (err) {
      logger.error('[leaderboard] guild error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);
