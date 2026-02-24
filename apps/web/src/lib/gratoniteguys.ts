import manifest from '@/assets/gratoniteguys/element-run-03-manifest.json';

export type GratoniteGuysRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface GratoniteGuyCatalogEntry {
  rarity: GratoniteGuysRarity;
  elementNumber: number;
  symbol: string;
  nicknameSlug: string;
  elementSlug: string;
  filename: string;
  relativePath: string;
}

export interface GratoniteGuysRollResult {
  entry: GratoniteGuyCatalogEntry;
  rarityIndex: number;
  isDuplicate: boolean;
  duplicateCountAfter: number;
  dustAwarded: number;
}

export const GRATONITE_GUYS_RARITIES: Array<{
  id: GratoniteGuysRarity;
  label: string;
  weight: number;
  color: string;
  glow: string;
  dupeDust: number;
}> = [
  { id: 'common', label: 'Common', weight: 45, color: '#8B90B0', glow: 'rgba(139,144,176,0.25)', dupeDust: 1 },
  { id: 'uncommon', label: 'Uncommon', weight: 25, color: '#4ADE80', glow: 'rgba(74,222,128,0.35)', dupeDust: 2 },
  { id: 'rare', label: 'Rare', weight: 16, color: '#3B82F6', glow: 'rgba(59,130,246,0.4)', dupeDust: 4 },
  { id: 'epic', label: 'Epic', weight: 8, color: '#9A4DFF', glow: 'rgba(154,77,255,0.45)', dupeDust: 8 },
  { id: 'legendary', label: 'Legendary', weight: 6, color: '#F59E0B', glow: 'rgba(245,158,11,0.5)', dupeDust: 15 },
];

export const GRATONITE_GUYS_OPEN_COST = 200;

const rarityIndexById = new Map(GRATONITE_GUYS_RARITIES.map((r, i) => [r.id, i]));

export function getGratoniteGuysCatalog(): GratoniteGuyCatalogEntry[] {
  return (manifest.rarityPngs as unknown as GratoniteGuyCatalogEntry[]).filter(
    (e) => e && typeof e.elementNumber === 'number' && rarityIndexById.has(e.rarity),
  );
}

export function getGratoniteGuysCatalogByRarity() {
  const byRarity = new Map<GratoniteGuysRarity, GratoniteGuyCatalogEntry[]>();
  for (const rarity of GRATONITE_GUYS_RARITIES) byRarity.set(rarity.id, []);
  for (const entry of getGratoniteGuysCatalog()) {
    byRarity.get(entry.rarity)?.push(entry);
  }
  return byRarity;
}

export function formatGuyDisplayName(entry: GratoniteGuyCatalogEntry) {
  const nickname = entry.nicknameSlug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  const elementName = entry.elementSlug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  return `${nickname} ${elementName}`.trim();
}

export function formatGuyKey(entry: Pick<GratoniteGuyCatalogEntry, 'elementNumber' | 'rarity'>) {
  return `${entry.elementNumber}-${entry.rarity}`;
}

export function rollWeightedRarity(random = Math.random): GratoniteGuysRarity {
  const total = GRATONITE_GUYS_RARITIES.reduce((sum, r) => sum + r.weight, 0);
  let roll = random() * total;
  for (const rarity of GRATONITE_GUYS_RARITIES) {
    roll -= rarity.weight;
    if (roll <= 0) return rarity.id;
  }
  const last = GRATONITE_GUYS_RARITIES[GRATONITE_GUYS_RARITIES.length - 1];
  return (last?.id ?? 'common') as GratoniteGuysRarity;
}

export function getRarityMeta(rarity: GratoniteGuysRarity) {
  return (
    GRATONITE_GUYS_RARITIES.find((r) => r.id === rarity) ??
    GRATONITE_GUYS_RARITIES[0] ??
    GRATONITE_GUYS_RARITIES[GRATONITE_GUYS_RARITIES.length - 1]
  );
}

export function getRarityIndex(rarity: GratoniteGuysRarity) {
  return rarityIndexById.get(rarity) ?? 0;
}
