import 'dotenv/config';

import { seedCosmeticsCatalog } from '../seeds/cosmeticsCatalog';
import { db } from '../db/index';
import { shopItems } from '../db/schema/shop';
import { sql } from 'drizzle-orm';

async function main() {
  const results = await seedCosmeticsCatalog();
  const inserted = results.filter((r) => r.action === 'inserted').length;
  const updated = results.filter((r) => r.action === 'updated').length;

  const categories = ['avatar_frame', 'decoration', 'profile_effect', 'nameplate', 'soundboard'] as const;
  const counts: Record<string, number> = {};
  for (const type of categories) {
    const whereClause = type === 'nameplate'
      ? sql`${shopItems.available} = true and ${shopItems.type} in ('nameplate','name_plate')`
      : sql`${shopItems.available} = true and ${shopItems.type} = ${type}`;
    const rows = await db
      .select({ count: sql<number>`count(*)` })
      .from(shopItems)
      .where(whereClause);
    counts[type] = Number(rows[0]?.count ?? 0);
  }

  console.log(JSON.stringify({ inserted, updated, counts }, null, 2));
}

main().catch((err) => {
  console.error('[seed-catalog] failed:', err);
  process.exit(1);
});
