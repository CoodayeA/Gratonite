import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index';

export * from './schema/index';

/**
 * Create a database connection and return the Drizzle ORM client.
 * Uses postgres.js driver (fastest Node.js PostgreSQL driver).
 */
export function createDb(connectionString?: string) {
  const url =
    connectionString ??
    process.env['DATABASE_URL'] ??
    'postgres://gratonite:gratonite@localhost:5433/gratonite';

  const client = postgres(url, {
    max: 20, // connection pool size
    idle_timeout: 20,
    connect_timeout: 10,
  });

  const db = drizzle(client, { schema });

  return { db, client };
}

export type Database = ReturnType<typeof createDb>['db'];
