export interface GlobalProfile {
  displayName?: string | null;
  username?: string | null;
  avatarHash?: string | null;
  bannerHash?: string | null;
  bio?: string | null;
}

export interface MemberProfileOverride {
  nickname?: string | null;
  avatarHash?: string | null;
  bannerHash?: string | null;
  bio?: string | null;
}

export interface ResolvedProfile {
  displayName: string;
  avatarHash: string | null;
  bannerHash: string | null;
  bio: string | null;
}

export function resolveProfile(global: GlobalProfile, member?: MemberProfileOverride | null): ResolvedProfile {
  return {
    displayName: member?.nickname || global.displayName || global.username || 'Unknown',
    avatarHash: member?.avatarHash ?? global.avatarHash ?? null,
    bannerHash: member?.bannerHash ?? global.bannerHash ?? null,
    bio: member?.bio ?? global.bio ?? null,
  };
}

export function resolveDisplayName(global: GlobalProfile, member?: MemberProfileOverride | null): string {
  return resolveProfile(global, member).displayName;
}
