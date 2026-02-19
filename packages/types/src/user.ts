import type { Snowflake } from './snowflake';

// ============================================================================
// User types — Auth identity + profile + presence
// ============================================================================

/** Core user (auth + identity — kept lean) */
export interface User {
  id: Snowflake;
  username: string; // lowercase, 2–32 chars, alphanumeric + dots + underscores
  email: string;
  emailVerified: boolean;
  dateOfBirth: string; // ISO date string, encrypted at rest, never exposed via API
  googleId: string | null;
  mfaEnabled: boolean;
  createdAt: string; // ISO datetime
  disabled: boolean;
  deletedAt: string | null;
}

/** Public-safe user (what other users see — no email, no DOB, no auth details) */
export interface PublicUser {
  id: Snowflake;
  username: string;
  displayName: string;
  avatarHash: string | null;
  avatarAnimated: boolean;
  bannerHash: string | null;
  bannerAnimated: boolean;
  accentColor: number | null; // 24-bit RGB
  bio: string | null;
  pronouns: string | null;
  badges: UserBadge[];
  tier: UserTier;
  createdAt: string;
}

/** User profile (all display/customization) */
export interface UserProfile {
  userId: Snowflake;
  displayName: string; // 1–32 chars, any characters
  avatarHash: string | null;
  avatarAnimated: boolean;
  bannerHash: string | null;
  bannerAnimated: boolean;
  accentColor: number | null; // 24-bit RGB int
  bio: string | null; // max 190 chars
  pronouns: string | null; // max 40 chars
  avatarDecorationId: Snowflake | null;
  profileEffectId: Snowflake | null;
  themePreference: ThemePreference;
  tier: UserTier;
}

/** Per-server profile overrides */
export interface MemberProfile {
  userId: Snowflake;
  guildId: Snowflake;
  nickname: string | null; // 1–32 chars
  avatarHash: string | null;
  avatarAnimated: boolean;
  bannerHash: string | null;
  bannerAnimated: boolean;
  bio: string | null;
}

/** Custom status (ephemeral, changes frequently) */
export interface CustomStatus {
  text: string | null; // max 128 chars
  emojiId: Snowflake | null; // custom emoji
  emojiName: string | null; // unicode emoji name
  expiresAt: string | null; // ISO datetime
}

/** User presence */
export interface Presence {
  userId: Snowflake;
  status: PresenceStatus;
  activities: Activity[];
  clientStatus: ClientStatus;
}

/** Activity status (rich presence) */
export interface Activity {
  type: ActivityType;
  name: string;
  details: string | null;
  state: string | null;
  url: string | null;
  timestamps: { start?: number; end?: number } | null;
  assets: {
    largeImage?: string;
    largeText?: string;
    smallImage?: string;
    smallText?: string;
  } | null;
  party: { id?: string; size?: [number, number] } | null;
}

/** Connected account (GitHub, Spotify, etc.) */
export interface ConnectedAccount {
  id: Snowflake;
  userId: Snowflake;
  provider: ConnectedAccountProvider;
  providerAccountId: string;
  providerUsername: string;
  visibility: Visibility;
  showActivity: boolean;
}

/** User badge */
export interface UserBadge {
  id: Snowflake;
  name: string;
  description: string;
  iconHash: string;
  iconAnimated: boolean;
  grantedAt: string;
}

/** User settings (preferences) */
export interface UserSettings {
  userId: Snowflake;
  locale: string; // e.g., 'en-US'
  theme: string; // theme ID or name
  themePreference: ThemePreference;
  messageDisplay: MessageLayout;
  reducedMotion: boolean;
  highContrast: boolean;
  fontScale: number; // 0.75–1.5
  saturation: number; // 0.0–1.0
  developerMode: boolean;
  streamerMode: StreamerMode;
  calmMode: boolean;
  allowDmsFrom: PrivacyLevel;
  allowGroupDmInvitesFrom: PrivacyLevel;
  allowFriendRequestsFrom: PrivacyLevel;
}

// ============================================================================
// Enums
// ============================================================================

export type UserTier = 'free' | 'crystalline';

export type ThemePreference = 'dark' | 'light' | 'system' | 'oled_dark';

export type PresenceStatus = 'online' | 'idle' | 'dnd' | 'invisible' | 'offline';

export type ActivityType =
  | 'playing'
  | 'streaming'
  | 'listening'
  | 'watching'
  | 'competing'
  | 'custom';

export type ConnectedAccountProvider =
  | 'github'
  | 'twitter'
  | 'spotify'
  | 'twitch'
  | 'youtube'
  | 'steam'
  | 'reddit'
  | 'playstation'
  | 'xbox'
  | 'epic_games';

export type Visibility = 'everyone' | 'friends' | 'none';

export type PrivacyLevel = 'everyone' | 'friends' | 'server_members' | 'nobody';

export type MessageLayout = 'cozy' | 'compact' | 'bubbles' | 'cards';

export type StreamerMode = 'off' | 'on' | 'auto';

export type ClientStatus = {
  desktop?: PresenceStatus;
  mobile?: PresenceStatus;
  web?: PresenceStatus;
};
