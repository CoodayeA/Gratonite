import { eq, sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

import { db } from '../db/index';
import { shopItems } from '../db/schema/shop';

type ShopInsert = typeof shopItems.$inferInsert;

const rarityCycle: Array<ShopInsert['rarity']> = ['uncommon', 'rare', 'epic', 'legendary', 'rare'];

const frameGlowColors = ['#38bdf8', '#f9a8d4', '#7c3aed', '#34d399', '#fbbf24', '#f87171'];
const frameStyles = ['neon', 'gold', 'glass', 'rainbow', 'pulse'] as const;
const nameplateStyles = ['rainbow', 'fire', 'ice', 'gold', 'glitch'] as const;
const effectTypes = ['gradient-pulse', 'stars', 'particles', 'matrix-rain', 'aurora'] as const;
const decorationEmojis = ['👑', '⭐', '⚡', '☄️', '🪷', '🔮', '⚙️', '❄️', '🔥', '🌀', '💫', '🛡️', '☀️', '🌸', '🔷', '🌙', '✨', '⛈️', '🏮', '💎'];
const soundEmojis = ['🎤', '🔊', '🎉', '😮', '💰', '⚡', '🤖', '🌌', '🥁', '⚡', '🕹️', '❌', '🏆', '😱', '😂', '👏', '💨', '✨', '💥', '🎬'];
const soundCategories = ['voice', 'bass', 'party', 'reaction', 'effect', 'sci-fi', 'glitch', 'ambient', 'music', 'game', 'retro', 'reaction', 'celebration', 'cinematic', 'reaction', 'reaction', 'transition', 'magical', 'cinematic', 'cinematic'];

function generateThumbnailSVG(type: string, name: string, assetConfig: Record<string, unknown> | null, index: number): string {
  const hue1 = (index * 23) % 360;
  const hue2 = (index * 23 + 70) % 360;
  const color1 = `hsl(${hue1}, 78%, 58%)`;
  const color2 = `hsl(${hue2}, 82%, 52%)`;
  const glowColor = (assetConfig?.glowColor as string) ?? color1;

  if (type === 'avatar_frame') {
    const frameStyle = (assetConfig?.frameStyle as string) ?? 'neon';
    let strokeAttr = `stroke="${glowColor}" stroke-width="4"`;
    let extra = '';
    if (frameStyle === 'gold') strokeAttr = 'stroke="#ffd700" stroke-width="5"';
    else if (frameStyle === 'glass') strokeAttr = 'stroke="rgba(255,255,255,0.4)" stroke-width="3"';
    else if (frameStyle === 'rainbow') {
      strokeAttr = 'stroke="url(#rainbow)" stroke-width="4"';
      extra = '<defs><linearGradient id="rainbow" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ff0000"/><stop offset="20%" stop-color="#ff7700"/><stop offset="40%" stop-color="#ffff00"/><stop offset="60%" stop-color="#00ff00"/><stop offset="80%" stop-color="#0000ff"/><stop offset="100%" stop-color="#8b00ff"/></linearGradient></defs>';
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">${extra}<rect width="200" height="200" rx="16" fill="#1a1a2e"/><circle cx="100" cy="100" r="50" fill="url(#g${index})"/><circle cx="100" cy="100" r="58" fill="none" ${strokeAttr}/><defs><linearGradient id="g${index}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${color1}"/><stop offset="100%" stop-color="${color2}"/></linearGradient></defs></svg>`;
  }

  if (type === 'profile_effect') {
    const effectType = (assetConfig?.effectType as string) ?? 'gradient-pulse';
    let inner = '';
    if (effectType === 'stars') inner = Array.from({ length: 6 }, (_, i) => `<circle cx="${30 + (i * 28) % 140}" cy="${25 + (i * 31) % 140}" r="3" fill="${glowColor}" opacity="0.8"/>`).join('');
    else if (effectType === 'aurora') inner = `<ellipse cx="100" cy="120" rx="80" ry="40" fill="${glowColor}" opacity="0.3"/><ellipse cx="100" cy="100" rx="60" ry="30" fill="#00ffaa" opacity="0.2"/>`;
    else if (effectType === 'matrix-rain') inner = `<text x="30" y="60" fill="#00ff41" font-size="14" opacity="0.6" font-family="monospace">01101</text><text x="80" y="100" fill="#00ff41" font-size="14" opacity="0.4" font-family="monospace">11010</text><text x="120" y="140" fill="#00ff41" font-size="14" opacity="0.5" font-family="monospace">01011</text>`;
    else if (effectType === 'particles') inner = Array.from({ length: 5 }, (_, i) => `<circle cx="${40 + i * 30}" cy="${150 - i * 20}" r="${4 + i}" fill="${glowColor}" opacity="${0.3 + i * 0.1}"/>`).join('');
    else inner = `<rect x="20" y="20" width="160" height="160" rx="12" fill="url(#eg${index})" opacity="0.6"/><defs><linearGradient id="eg${index}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${color1}"/><stop offset="50%" stop-color="transparent"/><stop offset="100%" stop-color="${color2}"/></linearGradient></defs>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" rx="16" fill="#1a1a2e"/>${inner}</svg>`;
  }

  if (type === 'nameplate') {
    const style = (assetConfig?.nameplateStyle as string) ?? 'rainbow';
    const gradMap: Record<string, [string, string, string]> = {
      rainbow: ['#ff0000', '#00ff00', '#0000ff'],
      fire: ['#ff4500', '#ff8c00', '#ffd700'],
      ice: ['#00bfff', '#87ceeb', '#e0ffff'],
      gold: ['#ffd700', '#daa520', '#b8860b'],
      glitch: ['#ff00ff', '#00ffff', '#ff00ff'],
    };
    const [c1, c2, c3] = gradMap[style] ?? [color1, color2, color1];
    return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" rx="16" fill="#1a1a2e"/><defs><linearGradient id="ng${index}" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="${c1}"/><stop offset="50%" stop-color="${c2}"/><stop offset="100%" stop-color="${c3}"/></linearGradient></defs><text x="100" y="108" text-anchor="middle" fill="url(#ng${index})" font-size="20" font-weight="bold" font-family="sans-serif">Username</text></svg>`;
  }

  if (type === 'decoration') {
    const emoji = decorationEmojis[index % decorationEmojis.length];
    return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" rx="16" fill="#1a1a2e"/><circle cx="100" cy="110" r="40" fill="url(#dg${index})"/><text x="100" y="55" text-anchor="middle" font-size="36">${emoji}</text><defs><linearGradient id="dg${index}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${color1}"/><stop offset="100%" stop-color="${color2}"/></linearGradient></defs></svg>`;
  }

  // soundboard
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" rx="16" fill="#1a1a2e"/>${Array.from({ length: 12 }, (_, i) => { const h = 20 + ((i * 13 + index * 7) % 60); return `<rect x="${35 + i * 11}" y="${100 - h / 2}" width="6" height="${h}" rx="3" fill="${color1}" opacity="0.7"/>`; }).join('')}<text x="100" y="160" text-anchor="middle" font-size="28">${soundEmojis[index % soundEmojis.length]}</text></svg>`;
}

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
      const assetConfig: Record<string, unknown> | null = category.type === 'soundboard'
          ? {
              soundEmoji: soundEmojis[i % soundEmojis.length],
              soundCategory: soundCategories[i % soundCategories.length],
              soundDuration: `${1 + (i % 10)}s`,
              preset: category.type,
              index: i + 1,
            }
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
                : {
                    decorationEmoji: decorationEmojis[i % decorationEmojis.length],
                    preset: category.type,
                    index: i + 1,
                  };

      const base: ShopInsert = {
        name: nameList[i],
        description: `${nameList[i]} ${category.label.slice(0, -1).toLowerCase()} cosmetic.`,
        price,
        category: category.label,
        rarity,
        available: true,
        type: category.type as NonNullable<ShopInsert['type']>,
        imageUrl: `/uploads/cosmetics/thumbnails/${sku}.svg`,
        assetUrl: null,
        assetConfig,
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

  // Ensure thumbnails directory exists
  const thumbnailDir = path.join(__dirname, '..', '..', 'uploads', 'cosmetics', 'thumbnails');
  fs.mkdirSync(thumbnailDir, { recursive: true });

  for (const row of catalog) {
    const sku = String((row.metadata as any)?.sku ?? '').trim();
    if (!sku) continue;

    const [existing] = await db
      .select({ id: shopItems.id })
      .from(shopItems)
      .where(sql`${shopItems.metadata}->>'sku' = ${sku}`)
      .limit(1);

    // Generate SVG thumbnail
    const catType = (row.metadata as any)?.category as string ?? '';
    const itemIndex = ((row.metadata as any)?.index as number ?? 1) - 1;
    const svg = generateThumbnailSVG(catType, row.name ?? '', row.assetConfig as Record<string, unknown> | null, itemIndex);
    fs.writeFileSync(path.join(thumbnailDir, `${sku}.svg`), svg, 'utf-8');

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
