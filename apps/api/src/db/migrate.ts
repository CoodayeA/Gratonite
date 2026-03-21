import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool);
  const migrationsFolder = path.join(__dirname, '../../drizzle');

  console.info('Running migrations...');
  try {
    await migrate(db, { migrationsFolder });
  } catch (err: any) {
    // If the initial migration fails because tables already exist,
    // seed the drizzle journal so subsequent migrations can proceed.
    if (err?.message?.includes('already exists')) {
      console.warn('Tables already exist — seeding migration journal...');
      await pool.query(`
        CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
          id SERIAL PRIMARY KEY,
          hash TEXT NOT NULL,
          created_at BIGINT
        );
      `);

      // Read the journal to find entries and compute the correct content hash
      const journal = JSON.parse(fs.readFileSync(path.join(migrationsFolder, 'meta/_journal.json'), 'utf-8'));
      for (const entry of journal.entries) {
        const sqlContent = fs.readFileSync(path.join(migrationsFolder, `${entry.tag}.sql`), 'utf-8');
        const contentHash = crypto.createHash('sha256').update(sqlContent).digest('hex');

        const { rows } = await pool.query(
          `SELECT 1 FROM "__drizzle_migrations" WHERE hash = $1 LIMIT 1`,
          [contentHash],
        );
        if (rows.length === 0) {
          await pool.query(
            `INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES ($1, $2)`,
            [contentHash, entry.when],
          );
          console.info(`Marked ${entry.tag} as applied (hash: ${contentHash.slice(0, 12)}...)`);
        }
      }

      console.info('Journal seeded. Retrying migrations...');
      await migrate(db, { migrationsFolder });
    } else {
      throw err;
    }
  }
  console.info('Migrations complete.');

  await pool.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
