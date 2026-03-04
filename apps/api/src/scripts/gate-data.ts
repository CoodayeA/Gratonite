import 'dotenv/config';

import { getCoreDataCounts } from '../seeds/discoverStarter';

const REQUIRED_SHOP_CATEGORY_COUNT = 20;

async function main() {
  const counts = await getCoreDataCounts();
  const failures: string[] = [];

  if (counts.guildsDiscoverable <= 0) {
    failures.push('discoverable guild count must be > 0');
  }
  if (counts.botListingsListed <= 0) {
    failures.push('listed bot count must be > 0');
  }
  if (counts.themesPublished <= 0) {
    failures.push('published theme count must be > 0');
  }
  if (counts.shopItemsAvailable <= 0) {
    failures.push('available shop item count must be > 0');
  }

  const requiredTypes = ['avatar_frame', 'decoration', 'profile_effect', 'nameplate', 'soundboard'] as const;
  for (const type of requiredTypes) {
    const value = counts.availableByCategory[type] ?? 0;
    if (value !== REQUIRED_SHOP_CATEGORY_COUNT) {
      failures.push(`shop category ${type} must have exactly ${REQUIRED_SHOP_CATEGORY_COUNT} available items (found ${value})`);
    }
  }

  if (failures.length > 0) {
    console.error('[gate:data] FAILED');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    console.error(JSON.stringify({ counts }, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify({
    ok: true,
    counts,
    requiredShopCategoryCount: REQUIRED_SHOP_CATEGORY_COUNT,
  }, null, 2));
}

main().catch((err) => {
  console.error('[gate:data] failed:', err);
  process.exit(1);
});
