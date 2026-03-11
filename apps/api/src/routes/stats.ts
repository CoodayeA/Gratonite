import { Router, Request, Response } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db/index';
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
    console.error('[stats] failed to fetch public stats:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});
