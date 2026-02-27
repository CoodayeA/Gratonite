import { create } from 'zustand';
import { api } from '@/lib/api';

export interface EquippedCosmetic {
  id: string;
  name: string;
  type: 'avatar_decoration' | 'effect' | 'nameplate' | 'soundboard';
  previewImageUrl: string | null;
  assetUrl: string | null;
}

interface CosmeticsState {
  equipped: Partial<Record<EquippedCosmetic['type'], EquippedCosmetic>>;
  loaded: boolean;

  loadEquipped: () => Promise<void>;
  setEquipped: (cosmetic: EquippedCosmetic) => void;
  unsetEquipped: (type: EquippedCosmetic['type']) => void;
  reset: () => void;
}

export const useCosmeticsStore = create<CosmeticsState>((set) => ({
  equipped: {},
  loaded: false,

  loadEquipped: async () => {
    try {
      const list = await api.cosmetics.getEquipped();
      const equipped: Partial<Record<EquippedCosmetic['type'], EquippedCosmetic>> = {};
      for (const c of list as unknown as EquippedCosmetic[]) {
        equipped[c.type] = c;
      }
      set({ equipped, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  setEquipped: (cosmetic) =>
    set((s) => ({ equipped: { ...s.equipped, [cosmetic.type]: cosmetic } })),

  unsetEquipped: (type) =>
    set((s) => {
      const next = { ...s.equipped };
      delete next[type];
      return { equipped: next };
    }),

  reset: () => set({ equipped: {}, loaded: false }),
}));
