import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { logger } from '../lib/logger';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Required by node-postgres: without this, an idle client error event becomes
// an unhandled EventEmitter error and crashes the process.
pool.on('error', (err) => {
  logger.error('[db] Unexpected error on idle client', err);
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
