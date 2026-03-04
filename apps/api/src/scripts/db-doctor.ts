import 'dotenv/config';

import { getCoreDataCounts } from '../seeds/discoverStarter';

function redactDatabaseUrl(input: string | undefined): string {
  if (!input) return '(unset)';
  try {
    const u = new URL(input);
    if (u.password) u.password = '***';
    if (u.username) u.username = '***';
    return u.toString();
  } catch {
    return '(invalid DATABASE_URL)';
  }
}

async function main() {
  const counts = await getCoreDataCounts();

  console.log(JSON.stringify({
    databaseUrl: redactDatabaseUrl(process.env.DATABASE_URL),
    counts,
  }, null, 2));
}

main().catch((err) => {
  console.error('[db:doctor] failed:', err);
  process.exit(1);
});
