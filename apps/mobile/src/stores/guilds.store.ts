import { create } from 'zustand';

// ── Types ────────────────────────────────────────────

export interface Guild {
  id: string;
  name: string;
  ownerId: string;
  iconHash?: string;
  iconAnimated?: boolean;
  bannerHash?: string;
  description?: string;
  vanityUrlCode?: string;
  nsfwLevel?: number;
  verificationLevel?: number;
  features?: string[];
  tags?: string[];
  categories?: string[];
  discoverable?: boolean;
  memberCount?: number;
  boostCount?: number;
  boostTier?: number;
  createdAt?: string;
}

// ── State ────────────────────────────────────────────

interface GuildsState {
  /** All guilds keyed by ID */
  guilds: Map<string, Guild>;
  /** Ordered guild IDs (sidebar order) */
  guildOrder: string[];
  /** Currently active guild ID */
  currentGuildId: string | null;

  // Actions
  setGuilds: (guilds: Guild[]) => void;
  addGuild: (guild: Guild) => void;
  updateGuild: (guildId: string, partial: Partial<Guild>) => void;
  removeGuild: (guildId: string) => void;
  setCurrentGuild: (guildId: string | null) => void;
  getGuild: (guildId: string) => Guild | undefined;
}

export const useGuildsStore = create<GuildsState>((set, get) => ({
  guilds: new Map(),
  guildOrder: [],
  currentGuildId: null,

  setGuilds: (guilds) => {
    const nextGuilds = new Map<string, Guild>();
    const order: string[] = [];

    for (const guild of guilds) {
      nextGuilds.set(guild.id, guild);
      order.push(guild.id);
    }

    set({ guilds: nextGuilds, guildOrder: order });
  },

  addGuild: (guild) => {
    const { guilds, guildOrder } = get();
    const nextGuilds = new Map(guilds);
    nextGuilds.set(guild.id, guild);

    const nextOrder = guildOrder.includes(guild.id)
      ? guildOrder
      : [...guildOrder, guild.id];

    set({ guilds: nextGuilds, guildOrder: nextOrder });
  },

  updateGuild: (guildId, partial) => {
    const { guilds } = get();
    const existing = guilds.get(guildId);
    if (!existing) return;

    const nextGuilds = new Map(guilds);
    nextGuilds.set(guildId, { ...existing, ...partial });
    set({ guilds: nextGuilds });
  },

  removeGuild: (guildId) => {
    const { guilds, guildOrder, currentGuildId } = get();
    if (!guilds.has(guildId)) return;

    const nextGuilds = new Map(guilds);
    nextGuilds.delete(guildId);

    const nextOrder = guildOrder.filter((id) => id !== guildId);

    set({
      guilds: nextGuilds,
      guildOrder: nextOrder,
      currentGuildId: currentGuildId === guildId ? null : currentGuildId,
    });
  },

  setCurrentGuild: (guildId) => {
    set({ currentGuildId: guildId });
  },

  getGuild: (guildId) => {
    return get().guilds.get(guildId);
  },
}));
