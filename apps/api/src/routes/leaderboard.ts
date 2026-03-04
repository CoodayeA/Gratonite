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
import { messages } from '../db/schema/messages';
import { channels } from '../db/schema/channels';
import { users } from '../db/schema/users';
import { guildMembers } from '../db/schema/guilds';
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

      // Build date condition
      const dateCondition = cutoff
        ? gte(messages.createdAt, cutoff)
        : undefined;

      // Aggregate message counts by author, join with users
      const conditions = [
        sql`${messages.authorId} IS NOT NULL`,
        ...(dateCondition ? [dateCondition] : []),
      ];

      const rows = await db
        .select({
          userId: messages.authorId,
          username: users.username,
          displayName: users.displayName,
          avatarHash: users.avatarHash,
          messageCount: sql<number>`count(*)::int`.as('message_count'),
          memberSince: users.createdAt,
        })
        .from(messages)
        .innerJoin(users, eq(users.id, messages.authorId))
        .where(and(...conditions))
        .groupBy(messages.authorId, users.username, users.displayName, users.avatarHash, users.createdAt)
        .orderBy(desc(sql`count(*)`))
        .limit(50);

      const result = rows.map((row, i) => ({
        rank: i + 1,
        userId: row.userId!,
        username: row.username,
        displayName: row.displayName,
        avatarHash: row.avatarHash,
        messageCount: row.messageCount,
        gratonitesEarned: row.messageCount * 10, // 10 gratonites per message
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

      // Build conditions: messages in channels belonging to this guild
      const dateCondition = cutoff
        ? gte(messages.createdAt, cutoff)
        : undefined;

      const conditions = [
        eq(channels.guildId, guildId),
        sql`${messages.authorId} IS NOT NULL`,
        ...(dateCondition ? [dateCondition] : []),
      ];

      const rows = await db
        .select({
          userId: messages.authorId,
          username: users.username,
          displayName: users.displayName,
          avatarHash: users.avatarHash,
          messageCount: sql<number>`count(*)::int`.as('message_count'),
          joinedAt: guildMembers.joinedAt,
        })
        .from(messages)
        .innerJoin(channels, eq(channels.id, messages.channelId))
        .innerJoin(users, eq(users.id, messages.authorId))
        .innerJoin(
          guildMembers,
          and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, messages.authorId)),
        )
        .where(and(...conditions))
        .groupBy(
          messages.authorId,
          users.username,
          users.displayName,
          users.avatarHash,
          guildMembers.joinedAt,
        )
        .orderBy(desc(sql`count(*)`))
        .limit(50);

      const result = rows.map((row, i) => ({
        rank: i + 1,
        userId: row.userId!,
        username: row.username,
        displayName: row.displayName,
        avatarHash: row.avatarHash,
        messageCount: row.messageCount,
        gratonitesEarned: row.messageCount * 10,
        memberSince: row.joinedAt?.toISOString() ?? null,
      }));

      res.status(200).json(result);
    } catch (err) {
      console.error('[leaderboard] guild error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);
