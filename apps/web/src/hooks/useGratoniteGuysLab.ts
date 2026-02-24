import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  GRATONITE_GUYS_OPEN_COST,
  type GratoniteGuysRollResult,
  formatGuyKey,
  getGratoniteGuysCatalogByRarity,
  getRarityIndex,
  getRarityMeta,
  rollWeightedRarity,
} from '@/lib/gratoniteguys';

const STORAGE_KEYS = {
  collection: 'gratonite_guys_native_collection',
  dust: 'gratonite_guys_native_dust',
  coins: 'gratonite_guys_native_coins',
  recent: 'gratonite_guys_native_recent',
};

type CollectionMap = Record<string, number>;

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function useGratoniteGuysLab() {
  const catalogByRarity = useMemo(() => getGratoniteGuysCatalogByRarity(), []);
  const [collection, setCollection] = useState<CollectionMap>({});
  const [dust, setDust] = useState(0);
  const [coins, setCoins] = useState(5000);
  const [recent, setRecent] = useState<GratoniteGuysRollResult[]>([]);
  const [lastResult, setLastResult] = useState<GratoniteGuysRollResult | null>(null);

  useEffect(() => {
    setCollection(safeParse(localStorage.getItem(STORAGE_KEYS.collection), {}));
    setDust(safeParse(localStorage.getItem(STORAGE_KEYS.dust), 0));
    setCoins(safeParse(localStorage.getItem(STORAGE_KEYS.coins), 5000));
    setRecent(safeParse(localStorage.getItem(STORAGE_KEYS.recent), []));
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.collection, JSON.stringify(collection));
  }, [collection]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.dust, JSON.stringify(dust));
  }, [dust]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.coins, JSON.stringify(coins));
  }, [coins]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.recent, JSON.stringify(recent.slice(0, 8)));
  }, [recent]);

  const uniqueCount = useMemo(() => Object.keys(collection).length, [collection]);
  const totalOwned = useMemo(() => Object.values(collection).reduce((sum, n) => sum + n, 0), [collection]);
  const duplicateCount = Math.max(0, totalOwned - uniqueCount);

  const openOne = useCallback(() => {
    if (coins < GRATONITE_GUYS_OPEN_COST) return null;
    const rarity = rollWeightedRarity();
    const pool = catalogByRarity.get(rarity) ?? [];
    if (pool.length === 0) return null;
    const entry = pool[Math.floor(Math.random() * pool.length)];
    if (!entry) return null;
    const key = formatGuyKey(entry);
    const prevCount = collection[key] ?? 0;
    const isDuplicate = prevCount > 0;
    const rarityMeta = getRarityMeta(rarity);
    const dustAwarded = isDuplicate ? (rarityMeta?.dupeDust ?? 0) : 0;
    const result: GratoniteGuysRollResult = {
      entry,
      rarityIndex: getRarityIndex(rarity),
      isDuplicate,
      duplicateCountAfter: prevCount + 1,
      dustAwarded,
    };

    setCoins((v) => v - GRATONITE_GUYS_OPEN_COST);
    setCollection((curr) => ({ ...curr, [key]: (curr[key] ?? 0) + 1 }));
    if (dustAwarded) setDust((v) => v + dustAwarded);
    setLastResult(result);
    setRecent((curr) => [result, ...curr].slice(0, 8));
    return result;
  }, [catalogByRarity, coins, collection]);

  const resetProgress = useCallback(() => {
    setCollection({});
    setDust(0);
    setCoins(5000);
    setRecent([]);
    setLastResult(null);
  }, []);

  const grantCoins = useCallback((amount: number) => {
    setCoins((v) => Math.max(0, v + amount));
  }, []);

  return {
    collection,
    dust,
    coins,
    recent,
    lastResult,
    uniqueCount,
    totalOwned,
    duplicateCount,
    openOne,
    resetProgress,
    grantCoins,
    canOpen: coins >= GRATONITE_GUYS_OPEN_COST,
    openCost: GRATONITE_GUYS_OPEN_COST,
  };
}
