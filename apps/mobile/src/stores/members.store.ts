import { create } from 'zustand';

// ── Types ────────────────────────────────────────────

export interface GuildMember {
  userId: string;
  guildId: string;
  nickname?: string;
  roleIds?: string[];
  joinedAt?: string;
  premiumSince?: string;
  deaf?: boolean;
  mute?: boolean;
}

export interface UserSummary {
  id: string;
  username: string;
  displayName?: string;
  avatarHash?: string;
  avatarAnimated?: boolean;
}

// ── State ────────────────────────────────────────────

interface MembersState {
  /** Guild members: guildId → Map<userId, GuildMember> */
  membersByGuild: Map<string, Map<string, GuildMember>>;
  /** Cached user profiles keyed by user ID */
  userCache: Map<string, UserSummary>;

  // Actions
  setMembers: (guildId: string, members: GuildMember[]) => void;
  addMember: (guildId: string, member: GuildMember) => void;
  updateMember: (guildId: string, userId: string, partial: Partial<GuildMember>) => void;
  removeMember: (guildId: string, userId: string) => void;
  getMembers: (guildId: string) => GuildMember[];
  getMember: (guildId: string, userId: string) => GuildMember | undefined;
  cacheUsers: (users: UserSummary[]) => void;
  getUser: (userId: string) => UserSummary | undefined;
}

export const useMembersStore = create<MembersState>((set, get) => ({
  membersByGuild: new Map(),
  userCache: new Map(),

  setMembers: (guildId, members) => {
    const { membersByGuild } = get();
    const next = new Map(membersByGuild);
    const membersMap = new Map<string, GuildMember>();

    for (const member of members) {
      membersMap.set(member.userId, member);
    }

    next.set(guildId, membersMap);
    set({ membersByGuild: next });
  },

  addMember: (guildId, member) => {
    const { membersByGuild } = get();
    const next = new Map(membersByGuild);
    const guildMembers = new Map(next.get(guildId) ?? []);
    guildMembers.set(member.userId, member);
    next.set(guildId, guildMembers);
    set({ membersByGuild: next });
  },

  updateMember: (guildId, userId, partial) => {
    const { membersByGuild } = get();
    const guildMembers = membersByGuild.get(guildId);
    const existing = guildMembers?.get(userId);
    if (!existing) return;

    const next = new Map(membersByGuild);
    const updatedGuildMembers = new Map(guildMembers!);
    updatedGuildMembers.set(userId, { ...existing, ...partial });
    next.set(guildId, updatedGuildMembers);
    set({ membersByGuild: next });
  },

  removeMember: (guildId, userId) => {
    const { membersByGuild } = get();
    const guildMembers = membersByGuild.get(guildId);
    if (!guildMembers?.has(userId)) return;

    const next = new Map(membersByGuild);
    const updatedGuildMembers = new Map(guildMembers);
    updatedGuildMembers.delete(userId);

    if (updatedGuildMembers.size === 0) {
      next.delete(guildId);
    } else {
      next.set(guildId, updatedGuildMembers);
    }

    set({ membersByGuild: next });
  },

  getMembers: (guildId) => {
    const guildMembers = get().membersByGuild.get(guildId);
    return guildMembers ? Array.from(guildMembers.values()) : [];
  },

  getMember: (guildId, userId) => {
    return get().membersByGuild.get(guildId)?.get(userId);
  },

  cacheUsers: (users) => {
    const { userCache } = get();
    const next = new Map(userCache);

    for (const user of users) {
      next.set(user.id, user);
    }

    set({ userCache: next });
  },

  getUser: (userId) => {
    return get().userCache.get(userId);
  },
}));
