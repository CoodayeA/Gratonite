export type SystemHealthSnapshot = {
  disk: { freeMb: number; totalMb: number; path: string } | null;
  livekit: { configured: boolean; reachable: boolean | null; url: string | null };
  db: { ok: boolean };
  redis: { ok: boolean };
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

  return {
    disk,
    livekit: { configured, reachable, url: livekitUrl || null },
    db: { ok: dbOk },
    redis: { ok: redisOk },
  };
}
