import { eq, sql } from 'drizzle-orm';

import { db } from '../db/index';
import { shopItems } from '../db/schema/shop';

type ShopInsert = typeof shopItems.$inferInsert;

/* ──────────────────────────────────────────────────────────────
   V2 CURATED CATALOG — 34 items (8 frames, 10 decorations,
   8 effects, 8 nameplates). Soundboard dropped.
   ────────────────────────────────────────────────────────────── */

const V2_SKUS: string[] = [];

function sku(idx: number, prefix: string): string {
  const s = `v2-${prefix}-${String(idx).padStart(2, '0')}`;
  V2_SKUS.push(s);
  return s;
}

function slug(type: string, name: string): string {
  return `${type}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/* ── Avatar Frames (8) ────────────────────────────────────── */
const frames: ShopInsert[] = [
  {
    name: 'Neon Pulse', description: 'A soft cyan ring that breathes light around your avatar.',
    price: 150, category: 'Avatar Frames', rarity: 'uncommon', available: true,
    type: 'avatar_frame', imageUrl: null, assetUrl: null, duration: null,
    assetConfig: { frameStyle: 'neon', glowColor: '#38bdf8' },
    metadata: { sku: sku(1, 'frame'), slug: slug('frame', 'Neon Pulse'), collection: 'v2-curated', index: 1, category: 'avatar_frame' },
  },
  {
    name: 'Ember Ring', description: 'Flickering flames lap at the edge of your portrait. Warm, dangerous, unforgettable.',
    price: 400, category: 'Avatar Frames', rarity: 'rare', available: true,
    type: 'avatar_frame', imageUrl: null, assetUrl: null, duration: null,
    assetConfig: { frameStyle: 'fire', glowColor: '#ff6b35' },
    metadata: { sku: sku(2, 'frame'), slug: slug('frame', 'Ember Ring'), collection: 'v2-curated', index: 2, category: 'avatar_frame' },
  },
  {
    name: 'Gilded Crown', description: 'A regal band of hammered gold that catches every photon in the room.',
    price: 800, category: 'Avatar Frames', rarity: 'epic', available: true,
    type: 'avatar_frame', imageUrl: null, assetUrl: null, duration: null,
    assetConfig: { frameStyle: 'gold', glowColor: '#ffd700' },
    metadata: { sku: sku(3, 'frame'), slug: slug('frame', 'Gilded Crown'), collection: 'v2-curated', index: 3, category: 'avatar_frame' },
  },
  {
    name: 'Frost Shell', description: 'Translucent ice encasing your avatar — delicate, pristine, impossibly cool.',
    price: 200, category: 'Avatar Frames', rarity: 'uncommon', available: true,
    type: 'avatar_frame', imageUrl: null, assetUrl: null, duration: null,
    assetConfig: { frameStyle: 'glass', glowColor: 'rgba(180,220,255,0.5)' },
    metadata: { sku: sku(4, 'frame'), slug: slug('frame', 'Frost Shell'), collection: 'v2-curated', index: 4, category: 'avatar_frame' },
  },
  {
    name: 'Prismatic Arc', description: 'Every color of the spectrum in constant motion, an ever-shifting halo.',
    price: 900, category: 'Avatar Frames', rarity: 'epic', available: true,
    type: 'avatar_frame', imageUrl: null, assetUrl: null, duration: null,
    assetConfig: { frameStyle: 'rainbow', glowColor: '#ffffff' },
    metadata: { sku: sku(5, 'frame'), slug: slug('frame', 'Prismatic Arc'), collection: 'v2-curated', index: 5, category: 'avatar_frame' },
  },
  {
    name: 'Heartbeat', description: 'A gentle pink aura that swells and fades in sync with an invisible heartbeat.',
    price: 350, category: 'Avatar Frames', rarity: 'rare', available: true,
    type: 'avatar_frame', imageUrl: null, assetUrl: null, duration: null,
    assetConfig: { frameStyle: 'pulse', glowColor: '#f9a8d4' },
    metadata: { sku: sku(6, 'frame'), slug: slug('frame', 'Heartbeat'), collection: 'v2-curated', index: 6, category: 'avatar_frame' },
  },
  {
    name: 'Glitch Ring', description: 'Reality fractures around your avatar. Magenta and cyan fight for dominance.',
    price: 1500, category: 'Avatar Frames', rarity: 'legendary', available: true,
    type: 'avatar_frame', imageUrl: null, assetUrl: null, duration: null,
    assetConfig: { frameStyle: 'glitch', glowColor: '#00ffff' },
    metadata: { sku: sku(7, 'frame'), slug: slug('frame', 'Glitch Ring'), collection: 'v2-curated', index: 7, category: 'avatar_frame' },
  },
  {
    name: 'Void Edge', description: 'Deep violet energy bleeds from the border, as if you sit at the event horizon.',
    price: 450, category: 'Avatar Frames', rarity: 'rare', available: true,
    type: 'avatar_frame', imageUrl: null, assetUrl: null, duration: null,
    assetConfig: { frameStyle: 'neon', glowColor: '#7c3aed' },
    metadata: { sku: sku(8, 'frame'), slug: slug('frame', 'Void Edge'), collection: 'v2-curated', index: 8, category: 'avatar_frame' },
  },
];

/* ── Decorations (10) ─────────────────────────────────────── */
const decorations: ShopInsert[] = [
  {
    name: 'Royal Crown', description: 'A tiny golden crown. Long live the ruler of this chat.',
    price: 300, category: 'Decorations', rarity: 'rare', available: true,
    type: 'decoration', imageUrl: null, assetUrl: null, duration: null,
    assetConfig: { shape: 'crown', position: 'top-right' },
    metadata: { sku: sku(1, 'deco'), slug: slug('decoration', 'Royal Crown'), collection: 'v2-curated', index: 1, category: 'decoration' },
  },
  {
    name: 'Lucky Star', description: 'A bright star pins itself to your corner. Simple, iconic, always noticed.',
    price: 150, category: 'Decorations', rarity: 'uncommon', available: true,
    type: 'decoration', imageUrl: null, assetUrl: null, duration: null,
    assetConfig: { shape: 'star', position: 'top-right' },
    metadata: { sku: sku(2, 'deco'), slug: slug('decoration', 'Lucky Star'), collection: 'v2-curated', index: 2, category: 'decoration' },
  },
  {
    name: 'Inferno Crest', description: 'A lick of flame that never goes out.',
    price: 350, category: 'Decorations', rarity: 'rare', available: true,
    type: 'decoration', imageUrl: null, assetUrl: null, duration: null,
    assetConfig: { shape: 'flame', position: 'bottom-right' },
    metadata: { sku: sku(3, 'deco'), slug: slug('decoration', 'Inferno Crest'), collection: 'v2-curated', index: 3, category: 'decoration' },
  },
  {
    name: 'Lightning Badge', description: "A crackling bolt that says you're here and you're fast.",
    price: 175, category: 'Decorations', rarity: 'uncommon', available: true,
    type: 'decoration', imageUrl: null, assetUrl: null, duration: null,
    assetConfig: { shape: 'bolt', position: 'top-left' },
    metadata: { sku: sku(4, 'deco'), slug: slug('decoration', 'Lightning Badge'), collection: 'v2-curated', index: 4, category: 'decoration' },
  },
  {
    name: 'Crystal Orb', description: 'A mysterious glowing orb swirling with foresight.',
    price: 600, category: 'Decorations', rarity: 'epic', available: true,
    type: 'decoration', imageUrl: null, assetUrl: null, duration: null,
    assetConfig: { shape: 'orb', position: 'bottom-left' },
    metadata: { sku: sku(5, 'deco'), slug: slug('decoration', 'Crystal Orb'), collection: 'v2-curated', index: 5, category: 'decoration' },
  },
  {
    name: 'Guardian Shield', description: 'A burnished shield at your flank. You protect your people.',
    price: 650, category: 'Decorations', rarity: 'epic', available: true,
    type: 'decoration', imageUrl: null, assetUrl: null, duration: null,
    assetConfig: { shape: 'shield', position: 'bottom-right' },
    metadata: { sku: sku(6, 'deco'), slug: slug('decoration', 'Guardian Shield'), collection: 'v2-curated', index: 6, category: 'decoration' },
  },
  {
    name: 'Diamond Heart', description: 'A flawless diamond, refracting every color. The rarest badge.',
    price: 1200, category: 'Decorations', rarity: 'legendary', available: true,
    type: 'decoration', imageUrl: null, assetUrl: null, duration: null,
    assetConfig: { shape: 'gem', position: 'top-right' },
    metadata: { sku: sku(7, 'deco'), slug: slug('decoration', 'Diamond Heart'), collection: 'v2-curated', index: 7, category: 'decoration' },
  },
  {
    name: 'Cherry Blossom', description: 'A single pink petal carrying spring wherever you go.',
    price: 400, category: 'Decorations', rarity: 'rare', available: true,
    type: 'decoration', imageUrl: null, assetUrl: null, duration: null,
    assetConfig: { shape: 'lotus', position: 'top-left' },
    metadata: { sku: sku(8, 'deco'), slug: slug('decoration', 'Cherry Blossom'), collection: 'v2-curated', index: 8, category: 'decoration' },
  },
  {
    name: 'Crescent Moon', description: 'A sliver of silver moonlight. Understated, elegant, nocturnal.',
    price: 200, category: 'Decorations', rarity: 'uncommon', available: true,
    type: 'decoration', imageUrl: null, assetUrl: null, duration: null,
    assetConfig: { shape: 'moon', position: 'bottom-left' },
    metadata: { sku: sku(9, 'deco'), slug: slug('decoration', 'Crescent Moon'), collection: 'v2-curated', index: 9, category: 'decoration' },
  },
  {
    name: 'Frost Crystal', description: 'An intricate snowflake that never melts.',
    price: 375, category: 'Decorations', rarity: 'rare', available: true,
    type: 'decoration', imageUrl: null, assetUrl: null, duration: null,
    assetConfig: { shape: 'snowflake', position: 'top-right' },
    metadata: { sku: sku(10, 'deco'), slug: slug('decoration', 'Frost Crystal'), collection: 'v2-curated', index: 10, category: 'decoration' },
  },
];

/* ── Profile Effects (8) ──────────────────────────────────── */
const effects: ShopInsert[] = [
  {
    name: 'Nebula Drift', description: 'Slow-rolling cosmic gradients wash across your profile like a nebula at dusk.',
    price: 200, category: 'Profile Effects', rarity: 'uncommon', available: true,
    type: 'profile_effect', imageUrl: null, assetUrl: null, duration: null,
    assetConfig: { effectType: 'gradient-pulse', glowColor: '#667eea' },
    metadata: { sku: sku(1, 'effect'), slug: slug('effect', 'Nebula Drift'), collection: 'v2-curated', index: 1, category: 'profile_effect' },
  },
  {
    name: 'Starfield', description: 'Tiny golden stars blink in and out across a deep sky.',
    price: 400, category: 'Profile Effects', rarity: 'rare', available: true,
    type: 'profile_effect', imageUrl: null, assetUrl: null, duration: null,
    assetConfig: { effectType: 'stars', glowColor: '#fbbf24' },
    metadata: { sku: sku(2, 'effect'), slug: slug('effect', 'Starfield'), collection: 'v2-curated', index: 2, category: 'profile_effect' },
  },
  {
    name: 'Rising Embers', description: 'Glowing sparks drift upward as if you stand over coals.',
    price: 450, category: 'Profile Effects', rarity: 'rare', available: true,
    type: 'profile_effect', imageUrl: null, assetUrl: null, duration: null,
    assetConfig: { effectType: 'particles', glowColor: '#ff6b35' },
    metadata: { sku: sku(3, 'effect'), slug: slug('effect', 'Rising Embers'), collection: 'v2-curated', index: 3, category: 'profile_effect' },
  },
  {
    name: 'Digital Rain', description: 'Cascading green glyphs pour down your profile. You see the code.',
    price: 750, category: 'Profile Effects', rarity: 'epic', available: true,
    type: 'profile_effect', imageUrl: null, assetUrl: null, duration: null,
    assetConfig: { effectType: 'matrix-rain', glowColor: '#00ff41' },
    metadata: { sku: sku(4, 'effect'), slug: slug('effect', 'Digital Rain'), collection: 'v2-curated', index: 4, category: 'profile_effect' },
  },
  {
    name: 'Aurora Borealis', description: 'Shimmering curtains of green and violet light ripple across your profile.',
    price: 850, category: 'Profile Effects', rarity: 'epic', available: true,
    type: 'profile_effect', imageUrl: null, assetUrl: null, duration: null,
    assetConfig: { effectType: 'aurora', glowColor: '#00ffaa' },
    metadata: { sku: sku(5, 'effect'), slug: slug('effect', 'Aurora Borealis'), collection: 'v2-curated', index: 5, category: 'profile_effect' },
  },
  {
    name: 'Liquid Chrome', description: 'Molten mercury flows across your profile surface. Mesmerizing and otherworldly.',
    price: 1800, category: 'Profile Effects', rarity: 'legendary', available: true,
    type: 'profile_effect', imageUrl: null, assetUrl: null, duration: null,
    assetConfig: { effectType: 'liquid-metal', glowColor: '#c0c0c0' },
    metadata: { sku: sku(6, 'effect'), slug: slug('effect', 'Liquid Chrome'), collection: 'v2-curated', index: 6, category: 'profile_effect' },
  },
  {
    name: 'Sakura Breeze', description: 'Soft pink petals float upward, turning your profile into an eternal spring garden.',
    price: 500, category: 'Profile Effects', rarity: 'rare', available: true,
    type: 'profile_effect', imageUrl: null, assetUrl: null, duration: null,
    assetConfig: { effectType: 'particles', glowColor: '#f9a8d4' },
    metadata: { sku: sku(7, 'effect'), slug: slug('effect', 'Sakura Breeze'), collection: 'v2-curated', index: 7, category: 'profile_effect' },
  },
  {
    name: 'Midnight Pulse', description: 'Deep indigo waves breathe slowly across your profile. Calm, focused, mysterious.',
    price: 250, category: 'Profile Effects', rarity: 'uncommon', available: true,
    type: 'profile_effect', imageUrl: null, assetUrl: null, duration: null,
    assetConfig: { effectType: 'gradient-pulse', glowColor: '#1e1b4b' },
    metadata: { sku: sku(8, 'effect'), slug: slug('effect', 'Midnight Pulse'), collection: 'v2-curated', index: 8, category: 'profile_effect' },
  },
];

/* ── Nameplates (8) ───────────────────────────────────────── */
const nameplates: ShopInsert[] = [
  {
    name: 'Spectrum', description: 'Your name flows through every color of the rainbow.',
    price: 175, category: 'Name Plates', rarity: 'uncommon', available: true,
    type: 'nameplate', imageUrl: null, assetUrl: null, duration: null,
    assetConfig: { nameplateStyle: 'rainbow' },
    metadata: { sku: sku(1, 'nameplate'), slug: slug('nameplate', 'Spectrum'), collection: 'v2-curated', index: 1, category: 'nameplate' },
  },
  {
    name: 'Blaze', description: 'Your name burns in a gradient of orange and gold.',
    price: 350, category: 'Name Plates', rarity: 'rare', available: true,
    type: 'nameplate', imageUrl: null, assetUrl: null, duration: null,
    assetConfig: { nameplateStyle: 'fire' },
    metadata: { sku: sku(2, 'nameplate'), slug: slug('nameplate', 'Blaze'), collection: 'v2-curated', index: 2, category: 'nameplate' },
  },
  {
    name: 'Frost Script', description: 'Cool blue-to-white lettering that gleams like ice.',
    price: 200, category: 'Name Plates', rarity: 'uncommon', available: true,
    type: 'nameplate', imageUrl: null, assetUrl: null, duration: null,
    assetConfig: { nameplateStyle: 'ice' },
    metadata: { sku: sku(3, 'nameplate'), slug: slug('nameplate', 'Frost Script'), collection: 'v2-curated', index: 3, category: 'nameplate' },
  },
  {
    name: 'Midas Touch', description: 'Rich gold gradient text with the weight of real bullion.',
    price: 700, category: 'Name Plates', rarity: 'epic', available: true,
    type: 'nameplate', imageUrl: null, assetUrl: null, duration: null,
    assetConfig: { nameplateStyle: 'gold' },
    metadata: { sku: sku(4, 'nameplate'), slug: slug('nameplate', 'Midas Touch'), collection: 'v2-curated', index: 4, category: 'nameplate' },
  },
  {
    name: 'Corrupted', description: 'Your name glitches and tears, red and cyan fragments fighting.',
    price: 1400, category: 'Name Plates', rarity: 'legendary', available: true,
    type: 'nameplate', imageUrl: null, assetUrl: null, duration: null,
    assetConfig: { nameplateStyle: 'glitch' },
    metadata: { sku: sku(5, 'nameplate'), slug: slug('nameplate', 'Corrupted'), collection: 'v2-curated', index: 5, category: 'nameplate' },
  },
  {
    name: 'Sakura Script', description: 'Soft pink-to-white gradient like falling petals.',
    price: 400, category: 'Name Plates', rarity: 'rare', available: true,
    type: 'nameplate', imageUrl: null, assetUrl: null, duration: null,
    assetConfig: { nameplateStyle: 'sakura' },
    metadata: { sku: sku(6, 'nameplate'), slug: slug('nameplate', 'Sakura Script'), collection: 'v2-curated', index: 6, category: 'nameplate' },
  },
  {
    name: 'Neon Sign', description: 'Bright cyan-to-lime text glowing like neon tubing.',
    price: 750, category: 'Name Plates', rarity: 'epic', available: true,
    type: 'nameplate', imageUrl: null, assetUrl: null, duration: null,
    assetConfig: { nameplateStyle: 'neon' },
    metadata: { sku: sku(7, 'nameplate'), slug: slug('nameplate', 'Neon Sign'), collection: 'v2-curated', index: 7, category: 'nameplate' },
  },
  {
    name: 'Abyss', description: 'Your name pulls light into itself. Deep purple fading to black.',
    price: 1600, category: 'Name Plates', rarity: 'legendary', available: true,
    type: 'nameplate', imageUrl: null, assetUrl: null, duration: null,
    assetConfig: { nameplateStyle: 'void' },
    metadata: { sku: sku(8, 'nameplate'), slug: slug('nameplate', 'Abyss'), collection: 'v2-curated', index: 8, category: 'nameplate' },
  },
];

/* ── Full catalog ─────────────────────────────────────────── */
const V2_CATALOG: ShopInsert[] = [...frames, ...decorations, ...effects, ...nameplates];

export async function seedCosmeticsCatalog() {
  const results: Array<{ sku: string; name: string; action: 'inserted' | 'updated' | 'deprecated' }> = [];

  /* ── Step 1: Deprecate old cat-* items not in v2 ─────────── */
  const oldItems = await db
    .select({ id: shopItems.id, metadata: shopItems.metadata })
    .from(shopItems)
    .where(sql`${shopItems.metadata}->>'sku' LIKE 'cat-%'`);

  for (const old of oldItems) {
    await db.update(shopItems).set({ available: false }).where(eq(shopItems.id, old.id));
    const oldSku = (old.metadata as any)?.sku ?? '?';
    results.push({ sku: oldSku, name: oldSku, action: 'deprecated' });
  }

  /* ── Step 2: Upsert v2 items ─────────────────────────────── */
  for (const row of V2_CATALOG) {
    const itemSku = String((row.metadata as any)?.sku ?? '').trim();
    if (!itemSku) continue;

    const [existing] = await db
      .select({ id: shopItems.id })
      .from(shopItems)
      .where(sql`${shopItems.metadata}->>'sku' = ${itemSku}`)
      .limit(1);

    if (!existing) {
      await db.insert(shopItems).values(row);
      results.push({ sku: itemSku, name: row.name ?? itemSku, action: 'inserted' });
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
    results.push({ sku: itemSku, name: row.name ?? itemSku, action: 'updated' });
  }

  return results;
}
