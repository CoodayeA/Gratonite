import 'dotenv/config';

import { getCoreDataCounts, seedDiscoverStarter } from '../seeds/discoverStarter';

async function main() {
  const summary = await seedDiscoverStarter();
  const counts = await getCoreDataCounts();

  console.log(JSON.stringify({ summary, counts }, null, 2));
}

main().catch((err) => {
  console.error('[seed:discover-starter] failed:', err);
  process.exit(1);
});
