import { create } from 'zustand';

export interface GuildMemberEntry {
  userId: string;
  guildId: string;
  nickname?: string | null;
  user?: {
    id: string;
    username: string;
    displayName: string;
    avatarHash: string | null;
  };
  profile?: {
    nickname?: string | null;
    avatarHash?: string | null;
    bannerHash?: string | null;
    bio?: string | null;
  } | null;
}

interface MembersState {
  membersByGuild: Map<string, Map<string, GuildMemberEntry>>;
  setGuildMembers: (guildId: string, members: GuildMemberEntry[]) => void;
  updateMember: (guildId: string, member: GuildMemberEntry) => void;
  clear: () => void;
}

export const useMembersStore = create<MembersState>((set) => ({
  membersByGuild: new Map(),

  setGuildMembers: (guildId, members) =>
    set((state) => {
      const membersByGuild = new Map(state.membersByGuild);
      const existing = new Map(membersByGuild.get(guildId) ?? []);
      for (const member of members) {
        if (!member.userId) continue;
        existing.set(member.userId, member);
      }
      membersByGuild.set(guildId, existing);
      return { membersByGuild };
    }),

  updateMember: (guildId, member) =>
    set((state) => {
      const membersByGuild = new Map(state.membersByGuild);
      const guildMap = new Map(membersByGuild.get(guildId) ?? []);
      guildMap.set(member.userId, member);
      membersByGuild.set(guildId, guildMap);
      return { membersByGuild };
    }),

  clear: () => set({ membersByGuild: new Map() }),
}));
