import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { logger } from '../lib/logger';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool);
export { pool };

// Periodic pool stats logging
setInterval(() => {
  logger.debug({
    msg: 'DB pool stats',
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  });
}, 60_000).unref();
