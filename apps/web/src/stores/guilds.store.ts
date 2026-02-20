import { create } from 'zustand';
import type { Guild } from '@gratonite/types';

interface GuildsState {
  guilds: Map<string, Guild>;
  guildOrder: string[];
  currentGuildId: string | null;

  setGuilds: (guilds: Guild[]) => void;
  addGuild: (guild: Guild) => void;
  removeGuild: (guildId: string) => void;
  updateGuild: (guildId: string, partial: Partial<Guild>) => void;
  setCurrentGuild: (guildId: string | null) => void;
  clear: () => void;
}

export const useGuildsStore = create<GuildsState>((set) => ({
  guilds: new Map(),
  guildOrder: [],
  currentGuildId: null,

  setGuilds: (guilds) => {
    const map = new Map<string, Guild>();
    const order: string[] = [];
    for (const g of guilds) {
      map.set(g.id, g);
      order.push(g.id);
    }
    set({ guilds: map, guildOrder: order });
  },

  addGuild: (guild) =>
    set((state) => {
      const guilds = new Map(state.guilds);
      const isNew = !state.guilds.has(guild.id);
      guilds.set(guild.id, guild);
      const guildOrder = isNew ? [...state.guildOrder, guild.id] : state.guildOrder;
      return { guilds, guildOrder };
    }),

  removeGuild: (guildId) =>
    set((state) => {
      const guilds = new Map(state.guilds);
      guilds.delete(guildId);
      return {
        guilds,
        guildOrder: state.guildOrder.filter((id) => id !== guildId),
        currentGuildId: state.currentGuildId === guildId ? null : state.currentGuildId,
      };
    }),

  updateGuild: (guildId, partial) =>
    set((state) => {
      const existing = state.guilds.get(guildId);
      if (!existing) return state;
      const guilds = new Map(state.guilds);
      guilds.set(guildId, { ...existing, ...partial });
      return { guilds };
    }),

  setCurrentGuild: (guildId) =>
    set({ currentGuildId: guildId }),

  clear: () =>
    set({ guilds: new Map(), guildOrder: [], currentGuildId: null }),
}));
