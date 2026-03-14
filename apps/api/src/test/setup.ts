import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';

const TEST_DB_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/gratonite_test';

export const testPool = new Pool({ connectionString: TEST_DB_URL, max: 5 });
export const testDb = drizzle(testPool);

export async function cleanupDatabase() {
  // Truncate user-created data, preserving schema
  await testDb.execute(sql`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END $$;
  `);
}

beforeAll(async () => {
  // Verify database connection
  await testDb.execute(sql`SELECT 1`);
});

afterAll(async () => {
  await testPool.end();
});
