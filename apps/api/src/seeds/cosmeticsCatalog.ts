import { eq, sql } from 'drizzle-orm';

import { db } from '../db/index';
import { shopItems } from '../db/schema/shop';

type ShopInsert = typeof shopItems.$inferInsert;

const rarityCycle: Array<ShopInsert['rarity']> = ['uncommon', 'rare', 'epic', 'legendary', 'rare'];

const frameGlowColors = ['#38bdf8', '#f9a8d4', '#7c3aed', '#34d399', '#fbbf24', '#f87171'];
const frameStyles = ['neon', 'gold', 'glass', 'rainbow', 'pulse'] as const;
const nameplateStyles = ['rainbow', 'fire', 'ice', 'gold', 'glitch'] as const;
const effectTypes = ['gradient-pulse', 'stars', 'particles', 'matrix-rain', 'aurora'] as const;

const names = {
  avatar_frame: [
    'Aurora Halo', 'Neon Rift', 'Solar Flare', 'Obsidian Loop', 'Crystal Arc',
    'Verdant Pulse', 'Midnight Orbit', 'Prismatic Gate', 'Rose Quartz', 'Ember Ring',
    'Starlight Core', 'Iridescent Veil', 'Polar Crown', 'Violet Current', 'Lunar Edge',
    'Thunder Trace', 'Sakura Bloom', 'Ocean Crest', 'Frostline', 'Golden Aperture',
  ],
  decoration: [
    'Winged Laurel', 'Pixel Crown', 'Arc Reactor', 'Comet Trail', 'Lotus Sigil',
    'Astral Badge', 'Circuit Star', 'Glacier Emblem', 'Inferno Crest', 'Helix Orb',
    'Echo Pulse', 'Verdict Shield', 'Solar Crest', 'Nova Petal', 'Rune Fragment',
    'Moon Sigil', 'Prism Wings', 'Storm Totem', 'Lantern Charm', 'Obelisk Gem',
  ],
  profile_effect: [
    'Nebula Mist', 'Time Warp', 'Rainfall Echo', 'Photon Drift', 'Shadow Bloom',
    'Solar Wind', 'Mirage Veil', 'Cosmic Static', 'Bloom Burst', 'Prism Noise',
    'Aurora Sweep', 'Ember Fog', 'Glitch Bloom', 'Arc Lightning', 'Golden Dust',
    'Moonlit Grain', 'Sakura Breeze', 'Ocean Ripple', 'Thunder Fade', 'Stellar Rain',
  ],
  nameplate: [
    'Monarch Serif', 'Arcade Glow', 'Royal Slate', 'Neon Script', 'Crystal Mono',
    'Aurora Sans', 'Vortex Plate', 'Midnight Gold', 'Garden Bloom', 'Steelline',
    'Sunrise Gradient', 'Holograph Tag', 'Pixel Matte', 'Regal Bronze', 'Obsidian Label',
    'Nordic Strip', 'Sakura Ribbon', 'Orbit Trim', 'Prism Slab', 'Titanium Line',
  ],
  soundboard: [
    'Mic Drop', 'Bass Boom', 'Party Horn', 'Crowd Wow', 'Cash Register',
    'Laser Zap', 'Glitch Pop', 'Galaxy Ping', 'Drum Fill', 'Power Up',
    'Retro Confirm', 'Fail Buzzer', 'Victory Chime', 'Suspense Hit', 'Crowd Laugh',
    'Heavy Clap', 'Whoosh Rise', 'Sparkle Ping', 'Deep Impact', 'Epic Outro',
  ],
} as const;

function toSlug(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function createCatalogItems(): ShopInsert[] {
  const rows: ShopInsert[] = [];
  const categories: Array<{ type: keyof typeof names; label: string }> = [
    { type: 'avatar_frame', label: 'Avatar Frames' },
    { type: 'decoration', label: 'Decorations' },
    { type: 'profile_effect', label: 'Profile Effects' },
    { type: 'nameplate', label: 'Name Plates' },
    { type: 'soundboard', label: 'Soundboard' },
  ];

  for (const category of categories) {
    const nameList = names[category.type];
    for (let i = 0; i < nameList.length; i += 1) {
      const sku = `cat-${category.type}-${String(i + 1).padStart(2, '0')}`;
      const slug = toSlug(`${category.type}-${nameList[i]}`);
      const price = 250 + (i * 75);
      const rarity = rarityCycle[i % rarityCycle.length] ?? 'uncommon';
      const base: ShopInsert = {
        name: nameList[i],
        description: `${nameList[i]} ${category.label.slice(0, -1).toLowerCase()} cosmetic.`,
        price,
        category: category.label,
        rarity,
        available: true,
        type: category.type as NonNullable<ShopInsert['type']>,
        imageUrl: `linear-gradient(135deg, hsl(${(i * 23) % 360} 78% 58%), hsl(${(i * 23 + 70) % 360} 82% 52%))`,
        assetUrl: null,
        assetConfig: category.type === 'soundboard'
          ? null
          : category.type === 'avatar_frame'
            ? {
                frameStyle: frameStyles[i % frameStyles.length],
                glowColor: frameGlowColors[i % frameGlowColors.length],
                preset: category.type,
                index: i + 1,
              }
            : category.type === 'nameplate'
              ? {
                  nameplateStyle: nameplateStyles[i % nameplateStyles.length],
                  preset: category.type,
                  index: i + 1,
                }
              : category.type === 'profile_effect'
                ? {
                    effectType: effectTypes[i % effectTypes.length],
                    preset: category.type,
                    index: i + 1,
                  }
                : { preset: category.type, index: i + 1 },
        duration: category.type === 'soundboard' ? 1 + (i % 10) : null,
        metadata: {
          sku,
          slug,
          collection: 'launch-2026',
          index: i + 1,
          category: category.type,
        },
      };
      rows.push(base);
    }
  }
  return rows;
}

export async function seedCosmeticsCatalog() {
  const catalog = createCatalogItems();
  const results: Array<{ sku: string; name: string; action: 'inserted' | 'updated' }> = [];

  for (const row of catalog) {
    const sku = String((row.metadata as any)?.sku ?? '').trim();
    if (!sku) continue;

    const [existing] = await db
      .select({ id: shopItems.id })
      .from(shopItems)
      .where(sql`${shopItems.metadata}->>'sku' = ${sku}`)
      .limit(1);

    if (!existing) {
      await db.insert(shopItems).values(row);
      results.push({ sku, name: row.name ?? sku, action: 'inserted' });
      continue;
    }

    await db
      .update(shopItems)
      .set({
        name: row.name,
        description: row.description ?? null,
        price: row.price ?? 0,
        category: row.category ?? null,
        imageUrl: row.imageUrl ?? null,
        rarity: row.rarity ?? 'common',
        available: row.available ?? true,
        type: row.type ?? null,
        assetUrl: row.assetUrl ?? null,
        assetConfig: row.assetConfig ?? null,
        duration: row.duration ?? null,
        metadata: row.metadata ?? null,
      })
      .where(eq(shopItems.id, existing.id));
    results.push({ sku, name: row.name ?? sku, action: 'updated' });
  }

  return results;
}
