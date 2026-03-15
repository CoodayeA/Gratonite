import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index';
import { guilds } from '../db/schema/guilds';
import { redis } from '../lib/redis';
import { safeJsonParse } from '../lib/safe-json.js';
import { toRows } from '../lib/to-rows.js';

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
    res.status(500).json({ error: 'Failed to fetch stats' });
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
      // Online members (from Redis presence)
      (async () => {
        try {
          // TODO: Replace KEYS with SCAN or a dedicated online-users SET per guild for O(1) lookup
          const keys = await redis.keys(`presence:*`);
          if (keys.length === 0) return 0;
          // Check which are guild members who are online
          const memberIds = await db.execute(sql`
            SELECT user_id FROM guild_members WHERE guild_id = ${guildId}
          `);
          const memberSet = new Set(toRows(memberIds).map((r: any) => r.user_id));
          let online = 0;
          for (const key of keys) {
            const userId = key.replace('presence:', '');
            if (memberSet.has(userId)) {
              const status = await redis.get(key);
              if (status && status !== 'offline') online++;
            }
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
    res.status(500).json({ error: 'Failed to fetch guild stats' });
  }
});
