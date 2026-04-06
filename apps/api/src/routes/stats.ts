import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { eq, sql, and } from 'drizzle-orm';
import { db } from '../db/index';
import { guilds, guildMembers } from '../db/schema/guilds';
import { redis } from '../lib/redis';
import { safeJsonParse } from '../lib/safe-json.js';
import { toRows } from '../lib/to-rows.js';
import { requireAuth } from '../middleware/auth';
import { hasPermission } from './roles';
import { Permissions } from '../db/schema/roles';

export const statsRouter = Router();

const CACHE_KEY = 'public_stats';
const CACHE_TTL = 300; // 5 minutes

statsRouter.get('/public', async (_req: Request, res: Response) => {
  try {
    const cached = await redis.get(CACHE_KEY);
    if (cached) {
      const parsed = safeJsonParse(cached, null);
      if (parsed) {
        res.json(parsed);
        return;
      }
    }

    const [guildResult, userResult, messageResult] = await Promise.all([
      db.execute(sql`SELECT count(*)::int AS count FROM guilds`),
      db.execute(sql`SELECT count(*)::int AS count FROM users`),
      db.execute(sql`SELECT count(*)::int AS count FROM messages`),
    ]);

    const data = {
      guilds: toRows(guildResult)[0]?.count ?? 0,
      users: toRows(userResult)[0]?.count ?? 0,
      messages: toRows(messageResult)[0]?.count ?? 0,
    };

    await redis.setex(CACHE_KEY, CACHE_TTL, JSON.stringify(data));
    res.json(data);
  } catch (err) {
    logger.error('[stats] failed to fetch public stats:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to fetch stats'  });
  }
});

// ---------------------------------------------------------------------------
// GET /stats/guilds/:guildId — Public guild stats (no auth if public_stats_enabled)
// ---------------------------------------------------------------------------

const GUILD_STATS_TTL = 120; // 2 minutes

statsRouter.get('/guilds/:guildId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params as Record<string, string>;

    const cacheKey = `guild_stats:${guildId}`;
    const cached = await redis.get(cacheKey).catch((err: unknown) => { logger.debug({ msg: 'redis cache get failed', err }); return null; });
    if (cached) {
      const parsed = safeJsonParse(cached, null);
      if (parsed) {
        res.json(parsed);
        return;
      }
    }

    // Verify guild exists and has public stats enabled
    const [guild] = await db
      .select({
        id: guilds.id,
        name: guilds.name,
        iconHash: guilds.iconHash,
        bannerHash: guilds.bannerHash,
        memberCount: guilds.memberCount,
        boostCount: guilds.boostCount,
        boostTier: guilds.boostTier,
        createdAt: guilds.createdAt,
        publicStatsEnabled: guilds.publicStatsEnabled,
        description: guilds.description,
      })
      .from(guilds)
      .where(eq(guilds.id, guildId))
      .limit(1);

    if (!guild) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Guild not found' });
      return;
    }

    if (!guild.publicStatsEnabled) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Public stats are not enabled for this guild' });
      return;
    }

    // Gather stats
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart.getTime() - 7 * 86400000);
    const thirtyDaysAgo = new Date(todayStart.getTime() - 30 * 86400000);

    const [msgToday, msgWeek, channelsCount, onlineCount, dailyActivity] = await Promise.all([
      // Messages today
      db.execute(sql`
        SELECT count(*)::int AS count FROM messages m
        JOIN channels c ON c.id = m.channel_id
        WHERE c.guild_id = ${guildId} AND m.created_at >= ${todayStart}
      `),
      // Messages this week
      db.execute(sql`
        SELECT count(*)::int AS count FROM messages m
        JOIN channels c ON c.id = m.channel_id
        WHERE c.guild_id = ${guildId} AND m.created_at >= ${weekStart}
      `),
      // Channels count
      db.execute(sql`
        SELECT count(*)::int AS count FROM channels
        WHERE guild_id = ${guildId} AND type != 'GUILD_CATEGORY'
      `),
      // Online members (from Redis presence via SCAN + mget)
      (async () => {
        try {
          const memberIds = await db.execute(sql`
            SELECT user_id FROM guild_members WHERE guild_id = ${guildId}
          `);
          const memberSet = new Set(toRows(memberIds).map((r: any) => r.user_id));
          if (memberSet.size === 0) return 0;

          // Collect matching presence keys via SCAN (non-blocking)
          const matchingKeys: string[] = [];
          let cursor = '0';
          do {
            const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'presence:*', 'COUNT', 100);
            cursor = nextCursor;
            for (const key of keys) {
              const userId = key.replace('presence:', '');
              if (memberSet.has(userId)) matchingKeys.push(key);
            }
          } while (cursor !== '0');

          if (matchingKeys.length === 0) return 0;

          // Batch fetch all statuses in one round trip
          const statuses = await redis.mget(...matchingKeys);
          let online = 0;
          for (const status of statuses) {
            if (status && status !== 'offline') online++;
          }
          return online;
        } catch (err) {
          logger.debug({ msg: 'failed to count online members', err });
          return 0;
        }
      })(),
      // Daily message activity for last 30 days
      db.execute(sql`
        SELECT
          date_trunc('day', m.created_at)::date AS day,
          count(*)::int AS count
        FROM messages m
        JOIN channels c ON c.id = m.channel_id
        WHERE c.guild_id = ${guildId} AND m.created_at >= ${thirtyDaysAgo}
        GROUP BY date_trunc('day', m.created_at)
        ORDER BY day ASC
      `),
    ]);

    // Build the 30-day activity array
    const activityMap = new Map<string, number>();
    for (const row of toRows(dailyActivity)) {
      const d = new Date(row.day as string);
      activityMap.set(d.toISOString().slice(0, 10), row.count as number);
    }
    const activity: { date: string; messages: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(todayStart.getTime() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      activity.push({ date: key, messages: activityMap.get(key) || 0 });
    }

    const data = {
      guild: {
        id: guild.id,
        name: guild.name,
        iconHash: guild.iconHash,
        bannerHash: guild.bannerHash,
        description: guild.description,
        createdAt: guild.createdAt,
      },
      memberCount: guild.memberCount,
      onlineCount: onlineCount as number,
      messagesToday: toRows(msgToday)[0]?.count ?? 0,
      messagesThisWeek: toRows(msgWeek)[0]?.count ?? 0,
      channelsCount: toRows(channelsCount)[0]?.count ?? 0,
      boostCount: guild.boostCount,
      boostTier: guild.boostTier,
      activity,
    };

    await redis.setex(cacheKey, GUILD_STATS_TTL, JSON.stringify(data)).catch((err: unknown) => { logger.debug({ msg: 'redis cache set failed', err }); });
    res.json(data);
  } catch (err) {
    logger.error('[stats] failed to fetch guild stats:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to fetch guild stats'  });
  }
});

// ---------------------------------------------------------------------------
// Helper: verify guild membership + MANAGE_GUILD permission
// ---------------------------------------------------------------------------
async function requireGuildManage(req: Request, res: Response): Promise<boolean> {
  const guildId = req.params.guildId as string;
  const userId = req.userId!;

  const [membership] = await db
    .select({ id: guildMembers.id })
    .from(guildMembers)
    .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, userId)))
    .limit(1);

  if (!membership) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Not a member of this guild' });
    return false;
  }

  if (!(await hasPermission(userId, guildId, Permissions.MANAGE_GUILD))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission' });
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// GET /stats/guilds/:guildId/growth — Member growth over last 90 days
// ---------------------------------------------------------------------------
statsRouter.get('/guilds/:guildId/growth', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!(await requireGuildManage(req, res))) return;
    const guildId = req.params.guildId as string;
    const range = Math.min(Math.max(parseInt(req.query.range as string) || 90, 7), 90);

    const result = await db.execute(sql`
      SELECT
        date_trunc('day', joined_at)::date AS day,
        count(*)::int AS count
      FROM guild_members
      WHERE guild_id = ${guildId}
        AND joined_at >= now() - ${range}::int * interval '1 day'
      GROUP BY date_trunc('day', joined_at)
      ORDER BY day ASC
    `);

    const rows = toRows<{ day: string | Date; count: number }>(result);
    const dayMap = new Map<string, number>();
    for (const row of rows) {
      const key = typeof row.day === 'string' ? row.day.slice(0, 10) : new Date(row.day).toISOString().slice(0, 10);
      dayMap.set(key, row.count);
    }

    const labels: string[] = [];
    const data: number[] = [];
    const cumulative: number[] = [];
    let total = 0;

    // Get total members before the range for cumulative baseline
    const baseResult = await db.execute(sql`
      SELECT count(*)::int AS count FROM guild_members
      WHERE guild_id = ${guildId}
        AND joined_at < now() - ${range}::int * interval '1 day'
    `);
    total = (toRows<{ count: number }>(baseResult)[0]?.count ?? 0);

    for (let i = range - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const count = dayMap.get(key) ?? 0;
      total += count;
      labels.push(key);
      data.push(count);
      cumulative.push(total);
    }

    res.json({ labels, data, cumulative });
  } catch (err) {
    logger.error('[stats] growth query failed:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to fetch growth stats'  });
  }
});

// ---------------------------------------------------------------------------
// GET /stats/guilds/:guildId/activity-heatmap — Messages per hour x day-of-week
// ---------------------------------------------------------------------------
statsRouter.get('/guilds/:guildId/activity-heatmap', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!(await requireGuildManage(req, res))) return;
    const guildId = req.params.guildId as string;
    const range = Math.min(Math.max(parseInt(req.query.range as string) || 30, 7), 90);

    const result = await db.execute(sql`
      SELECT
        EXTRACT(dow FROM m.created_at)::int AS dow,
        EXTRACT(hour FROM m.created_at)::int AS hour,
        count(*)::int AS count
      FROM messages m
      JOIN channels c ON c.id = m.channel_id
      WHERE c.guild_id = ${guildId}
        AND m.created_at >= now() - ${range}::int * interval '1 day'
      GROUP BY EXTRACT(dow FROM m.created_at), EXTRACT(hour FROM m.created_at)
      ORDER BY dow, hour
    `);

    // Build 7x24 grid (dow 0=Sunday .. 6=Saturday)
    const grid: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
    const rows = toRows<{ dow: number; hour: number; count: number }>(result);
    for (const row of rows) {
      grid[row.dow][row.hour] = row.count;
    }

    // Find peak hour
    let peakDow = 0;
    let peakHour = 0;
    let peakCount = 0;
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        if (grid[d][h] > peakCount) {
          peakDow = d;
          peakHour = h;
          peakCount = grid[d][h];
        }
      }
    }

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    res.json({
      grid,
      peak: { day: dayNames[peakDow], hour: peakHour, count: peakCount },
    });
  } catch (err) {
    logger.error('[stats] activity-heatmap query failed:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to fetch activity heatmap'  });
  }
});

// ---------------------------------------------------------------------------
// GET /stats/guilds/:guildId/channel-comparison — Top 10 channels by messages
// ---------------------------------------------------------------------------
statsRouter.get('/guilds/:guildId/channel-comparison', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!(await requireGuildManage(req, res))) return;
    const guildId = req.params.guildId as string;
    const range = Math.min(Math.max(parseInt(req.query.range as string) || 30, 7), 90);

    const result = await db.execute(sql`
      SELECT c.name, count(*)::int AS count
      FROM messages m
      JOIN channels c ON c.id = m.channel_id
      WHERE c.guild_id = ${guildId}
        AND m.created_at >= now() - ${range}::int * interval '1 day'
      GROUP BY c.id, c.name
      ORDER BY count DESC
      LIMIT 10
    `);

    const channels = toRows<{ name: string; count: number }>(result);
    res.json({ channels });
  } catch (err) {
    logger.error('[stats] channel-comparison query failed:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to fetch channel comparison'  });
  }
});

// ---------------------------------------------------------------------------
// GET /stats/guilds/:guildId/engagement — DAU, messages/day, avg response time
// ---------------------------------------------------------------------------
statsRouter.get('/guilds/:guildId/engagement', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!(await requireGuildManage(req, res))) return;
    const guildId = req.params.guildId as string;
    const range = Math.min(Math.max(parseInt(req.query.range as string) || 30, 7), 90);

    // Daily active users + messages per day
    const dauResult = await db.execute(sql`
      SELECT
        date_trunc('day', m.created_at)::date AS day,
        count(DISTINCT m.author_id)::int AS active_users,
        count(*)::int AS message_count
      FROM messages m
      JOIN channels c ON c.id = m.channel_id
      WHERE c.guild_id = ${guildId}
        AND m.created_at >= now() - ${range}::int * interval '1 day'
      GROUP BY date_trunc('day', m.created_at)
      ORDER BY day ASC
    `);

    const dauRows = toRows<{ day: string | Date; active_users: number; message_count: number }>(dauResult);
    const dauMap = new Map<string, { activeUsers: number; messages: number }>();
    for (const row of dauRows) {
      const key = typeof row.day === 'string' ? row.day.slice(0, 10) : new Date(row.day).toISOString().slice(0, 10);
      dauMap.set(key, { activeUsers: row.active_users, messages: row.message_count });
    }

    const labels: string[] = [];
    const activeUsers: number[] = [];
    const messagesPerDay: number[] = [];

    for (let i = range - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      labels.push(key);
      const entry = dauMap.get(key);
      activeUsers.push(entry?.activeUsers ?? 0);
      messagesPerDay.push(entry?.messages ?? 0);
    }

    // Average response time: avg time between consecutive messages in same channel
    const avgResponseResult = await db.execute(sql`
      WITH ordered_msgs AS (
        SELECT m.channel_id, m.created_at,
          LAG(m.created_at) OVER (PARTITION BY m.channel_id ORDER BY m.created_at) AS prev_at
        FROM messages m
        JOIN channels c ON c.id = m.channel_id
        WHERE c.guild_id = ${guildId}
          AND m.created_at >= now() - ${range}::int * interval '1 day'
      )
      SELECT COALESCE(
        EXTRACT(EPOCH FROM AVG(created_at - prev_at) FILTER (WHERE prev_at IS NOT NULL AND created_at - prev_at < interval '1 hour'))::int,
        0
      ) AS avg_response_seconds
      FROM ordered_msgs
    `);

    const avgResponseSeconds = toRows<{ avg_response_seconds: number }>(avgResponseResult)[0]?.avg_response_seconds ?? 0;

    res.json({
      labels,
      activeUsers,
      messagesPerDay,
      avgResponseSeconds,
    });
  } catch (err) {
    logger.error('[stats] engagement query failed:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to fetch engagement stats'  });
  }
});

// ---------------------------------------------------------------------------
// GET /stats/guilds/:guildId/export — CSV export of all stats
// ---------------------------------------------------------------------------
statsRouter.get('/guilds/:guildId/export', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!(await requireGuildManage(req, res))) return;
    const guildId = req.params.guildId as string;
    const range = Math.min(Math.max(parseInt(req.query.range as string) || 30, 7), 90);

    // Gather daily data: date, new_members, messages, active_users
    const [memberResult, msgResult] = await Promise.all([
      db.execute(sql`
        SELECT date_trunc('day', joined_at)::date AS day, count(*)::int AS count
        FROM guild_members
        WHERE guild_id = ${guildId} AND joined_at >= now() - ${range}::int * interval '1 day'
        GROUP BY date_trunc('day', joined_at) ORDER BY day ASC
      `),
      db.execute(sql`
        SELECT
          date_trunc('day', m.created_at)::date AS day,
          count(*)::int AS messages,
          count(DISTINCT m.author_id)::int AS active_users
        FROM messages m
        JOIN channels c ON c.id = m.channel_id
        WHERE c.guild_id = ${guildId} AND m.created_at >= now() - ${range}::int * interval '1 day'
        GROUP BY date_trunc('day', m.created_at) ORDER BY day ASC
      `),
    ]);

    const memberMap = new Map<string, number>();
    for (const row of toRows<{ day: string | Date; count: number }>(memberResult)) {
      const key = typeof row.day === 'string' ? row.day.slice(0, 10) : new Date(row.day).toISOString().slice(0, 10);
      memberMap.set(key, row.count);
    }
    const msgMap = new Map<string, { messages: number; activeUsers: number }>();
    for (const row of toRows<{ day: string | Date; messages: number; active_users: number }>(msgResult)) {
      const key = typeof row.day === 'string' ? row.day.slice(0, 10) : new Date(row.day).toISOString().slice(0, 10);
      msgMap.set(key, { messages: row.messages, activeUsers: row.active_users });
    }

    const lines: string[] = ['Date,New Members,Messages,Active Users'];
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const members = memberMap.get(key) ?? 0;
      const msg = msgMap.get(key);
      lines.push(`${key},${members},${msg?.messages ?? 0},${msg?.activeUsers ?? 0}`);
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="guild-stats-${guildId}.csv"`);
    res.send(lines.join('\n'));
  } catch (err) {
    logger.error('[stats] export failed:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to export stats'  });
  }
});

// ---------------------------------------------------------------------------
// GET /stats/guilds/:guildId/moderation — Moderation analytics
// ---------------------------------------------------------------------------
statsRouter.get('/guilds/:guildId/moderation', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!(await requireGuildManage(req, res))) return;
    const guildId = req.params.guildId as string;
    const range = Math.min(Math.max(parseInt(req.query.range as string) || 30, 7), 90);

    // Mod action volume over time (from audit_log)
    const volumeResult = await db.execute(sql`
      SELECT
        date_trunc('day', created_at)::date AS day,
        count(*)::int AS count
      FROM audit_log
      WHERE guild_id = ${guildId}
        AND created_at >= now() - ${range}::int * interval '1 day'
      GROUP BY date_trunc('day', created_at)
      ORDER BY day ASC
    `);
    const volumeRows = toRows<{ day: string | Date; count: number }>(volumeResult);
    const volumeMap = new Map<string, number>();
    for (const row of volumeRows) {
      const key = typeof row.day === 'string' ? row.day.slice(0, 10) : new Date(row.day).toISOString().slice(0, 10);
      volumeMap.set(key, row.count);
    }
    const volumeLabels: string[] = [];
    const volumeData: number[] = [];
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      volumeLabels.push(key);
      volumeData.push(volumeMap.get(key) ?? 0);
    }

    // Most warned users
    const warnedResult = await db.execute(sql`
      SELECT
        mw.user_id,
        u.username,
        u.display_name,
        count(*)::int AS warning_count
      FROM member_warnings mw
      LEFT JOIN users u ON u.id = mw.user_id
      WHERE mw.guild_id = ${guildId}
        AND mw.created_at >= now() - ${range}::int * interval '1 day'
      GROUP BY mw.user_id, u.username, u.display_name
      ORDER BY warning_count DESC
      LIMIT 10
    `);
    const topWarned = toRows<{ user_id: string; username: string; display_name: string | null; warning_count: number }>(warnedResult);

    // Moderator workload distribution
    const modWorkloadResult = await db.execute(sql`
      SELECT
        al.user_id AS moderator_id,
        u.username,
        u.display_name,
        count(*)::int AS action_count
      FROM audit_log al
      LEFT JOIN users u ON u.id = al.user_id
      WHERE al.guild_id = ${guildId}
        AND al.created_at >= now() - ${range}::int * interval '1 day'
      GROUP BY al.user_id, u.username, u.display_name
      ORDER BY action_count DESC
      LIMIT 10
    `);
    const moderatorWorkload = toRows<{ moderator_id: string; username: string; display_name: string | null; action_count: number }>(modWorkloadResult);

    // Warning-to-ban funnel: count warnings, timeouts, bans in period
    const [warningCountResult, banCountResult] = await Promise.all([
      db.execute(sql`
        SELECT count(*)::int AS count FROM member_warnings
        WHERE guild_id = ${guildId} AND created_at >= now() - ${range}::int * interval '1 day'
      `),
      db.execute(sql`
        SELECT count(*)::int AS count FROM guild_bans
        WHERE guild_id = ${guildId} AND created_at >= now() - ${range}::int * interval '1 day'
      `),
    ]);

    const warningCount = toRows<{ count: number }>(warningCountResult)[0]?.count ?? 0;
    const banCount = toRows<{ count: number }>(banCountResult)[0]?.count ?? 0;

    // Count timeout actions from audit log
    const timeoutResult = await db.execute(sql`
      SELECT count(*)::int AS count FROM audit_log
      WHERE guild_id = ${guildId}
        AND action IN ('MEMBER_TIMEOUT', 'timeout')
        AND created_at >= now() - ${range}::int * interval '1 day'
    `);
    const timeoutCount = toRows<{ count: number }>(timeoutResult)[0]?.count ?? 0;

    // Action breakdown by type
    const actionBreakdownResult = await db.execute(sql`
      SELECT action, count(*)::int AS count
      FROM audit_log
      WHERE guild_id = ${guildId}
        AND created_at >= now() - ${range}::int * interval '1 day'
      GROUP BY action
      ORDER BY count DESC
      LIMIT 15
    `);
    const actionBreakdown = toRows<{ action: string; count: number }>(actionBreakdownResult);

    res.json({
      volume: { labels: volumeLabels, data: volumeData },
      topWarned: topWarned.map(r => ({
        userId: r.user_id,
        username: r.username,
        displayName: r.display_name,
        warningCount: r.warning_count,
      })),
      moderatorWorkload: moderatorWorkload.map(r => ({
        moderatorId: r.moderator_id,
        username: r.username,
        displayName: r.display_name,
        actionCount: r.action_count,
      })),
      funnel: {
        warnings: warningCount,
        timeouts: timeoutCount,
        bans: banCount,
      },
      actionBreakdown: actionBreakdown.map(r => ({
        action: r.action,
        count: r.count,
      })),
    });
  } catch (err) {
    logger.error('[stats] moderation query failed:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to fetch moderation stats'  });
  }
});
