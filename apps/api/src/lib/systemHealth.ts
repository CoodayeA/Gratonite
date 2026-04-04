export type QueueDepth = { name: string; waiting: number; active: number; failed: number };

export type SystemHealthSnapshot = {
  disk: { freeMb: number; totalMb: number; path: string } | null;
  livekit: { configured: boolean; reachable: boolean | null; url: string | null };
  db: { ok: boolean };
  redis: { ok: boolean };
  memory: { rssMb: number; heapUsedMb: number; heapTotalMb: number };
  cpu: { loadAvg1m: number; loadAvg5m: number; loadAvg15m: number };
  queues: QueueDepth[];
  snapshotAt: string;
};

export async function getSystemHealthSnapshot(): Promise<SystemHealthSnapshot> {
  const cwd = process.cwd();
  let disk: SystemHealthSnapshot['disk'] = null;
  try {
    const nfs = await import('node:fs/promises');
    const statfsFn = (nfs as { statfs?: (p: string) => Promise<{ bsize: bigint; blocks: bigint; bfree: bigint }> })
      .statfs;
    if (!statfsFn) throw new Error('statfs unavailable');
    const s = await statfsFn(cwd);
    const bsize = Number(s.bsize);
    const blocks = Number(s.blocks);
    const bfree = Number(s.bfree);
    const totalMb = Math.round((blocks * bsize) / 1024 / 1024);
    const freeMb = Math.round((bfree * bsize) / 1024 / 1024);
    disk = { freeMb, totalMb, path: cwd };
  } catch {
    disk = null;
  }

  const livekitUrl = (process.env.LIVEKIT_URL || '').trim();
  const configured = !!(process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET && livekitUrl);
  let reachable: boolean | null = null;
  if (configured && livekitUrl) {
    try {
      const httpProbe = livekitUrl.replace(/^wss?:\/\//, (m) => (m.startsWith('wss') ? 'https://' : 'http://'));
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2500);
      const r = await fetch(httpProbe, { method: 'HEAD', signal: ctrl.signal }).catch(() => null);
      clearTimeout(t);
      reachable = !!(r && (r.ok || r.status === 404 || r.status === 405));
    } catch {
      reachable = false;
    }
  }

  const { db } = await import('../db/index');
  const { sql } = await import('drizzle-orm');
  let dbOk = false;
  try {
    await db.execute(sql`SELECT 1`);
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const { redis } = await import('./redis');
  let redisOk = false;
  try {
    await redis.ping();
    redisOk = true;
  } catch {
    redisOk = false;
  }

  // Memory
  const mem = process.memoryUsage();
  const memory = {
    rssMb: Math.round(mem.rss / 1024 / 1024),
    heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
  };

  // CPU load average (1m, 5m, 15m)
  const { loadavg } = await import('node:os');
  const [loadAvg1m, loadAvg5m, loadAvg15m] = loadavg().map(v => Math.round(v * 100) / 100);
  const cpu = { loadAvg1m, loadAvg5m, loadAvg15m };

  // BullMQ queue depths
  const { allQueues } = await import('./queue');
  const queues: QueueDepth[] = await Promise.all(
    allQueues.map(async (q) => {
      try {
        const counts = await q.getJobCounts('waiting', 'active', 'failed');
        return { name: q.name, waiting: counts.waiting ?? 0, active: counts.active ?? 0, failed: counts.failed ?? 0 };
      } catch {
        return { name: q.name, waiting: -1, active: -1, failed: -1 };
      }
    }),
  );

  const snapshot: SystemHealthSnapshot = {
    disk,
    livekit: { configured, reachable, url: livekitUrl || null },
    db: { ok: dbOk },
    redis: { ok: redisOk },
    memory,
    cpu,
    queues,
    snapshotAt: new Date().toISOString(),
  };

  // Persist to Redis sliding window (last 288 snapshots = 24h at 5-min intervals)
  try {
    const HISTORY_KEY = 'admin:health:history';
    const serialised = JSON.stringify(snapshot);
    await redis.lpush(HISTORY_KEY, serialised);
    await redis.ltrim(HISTORY_KEY, 0, 287);
  } catch {
    // Non-fatal — don't block the response
  }

  return snapshot;
}