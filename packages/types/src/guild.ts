import type { Snowflake } from './snowflake';

// ============================================================================
// Guild (Server) types
// ============================================================================

/** Guild / Server */
export interface Guild {
  id: Snowflake;
  name: string; // 2–100 chars
  ownerId: Snowflake;
  iconHash: string | null;
  iconAnimated: boolean;
  bannerHash: string | null;
  bannerAnimated: boolean;
  splashHash: string | null;
  discoverySplashHash: string | null;
  description: string | null; // max 1000 chars
  vanityUrlCode: string | null;
  preferredLocale: string;
  nsfwLevel: NsfwLevel;
  verificationLevel: VerificationLevel;
  explicitContentFilter: ExplicitContentFilter;
  defaultMessageNotifications: DefaultMessageNotifications;
  features: GuildFeature[];
  discoverable: boolean;
  memberCount: number;
  boostCount: number;
  boostTier: BoostTier;
  createdAt: string;
}

/** Guild member (user's membership in a specific guild) */
export interface GuildMember {
  userId: Snowflake;
  guildId: Snowflake;
  nickname: string | null;
  roleIds: Snowflake[];
  joinedAt: string;
  premiumSince: string | null; // when they started boosting
  deaf: boolean;
  mute: boolean;
  communicationDisabledUntil: string | null; // timeout
}

/** Guild role */
export interface GuildRole {
  id: Snowflake;
  guildId: Snowflake;
  name: string; // 1–100 chars
  color: number; // 24-bit RGB int (0 = no color)
  hoist: boolean; // show separately in member list
  iconHash: string | null;
  iconAnimated: boolean;
  unicodeEmoji: string | null; // alternative to icon
  position: number; // sort order
  permissions: string; // bigint as string
  managed: boolean; // managed by integration/bot
  mentionable: boolean;
}

/** Guild brand identity (server customization) */
export interface GuildBrand {
  guildId: Snowflake;
  colorPrimary: string | null; // hex
  colorSecondary: string | null;
  colorAccent: string | null;
  gradientType: GradientType;
  gradientConfig: Record<string, unknown> | null; // JSONB
  backgroundImageHash: string | null;
  backgroundBlur: number; // 0–20
  fontDisplay: string | null; // Google Font name
  fontBody: string | null;
  iconPack: IconPack;
  noiseOpacity: number; // 0.0–0.08
  glassOpacity: number; // 0.5–0.95
  cornerStyle: CornerStyle;
  messageLayout: MessageLayoutDefault;
}

/** Invite */
export interface Invite {
  code: string; // 10-char alphanumeric or vanity
  guildId: Snowflake;
  channelId: Snowflake;
  inviterId: Snowflake;
  maxUses: number | null; // null = unlimited
  uses: number;
  maxAgeSeconds: number | null; // null = never expires
  temporary: boolean;
  createdAt: string;
  expiresAt: string | null;
}

/** Ban record */
export interface Ban {
  guildId: Snowflake;
  userId: Snowflake;
  moderatorId: Snowflake;
  reason: string | null; // max 512 chars
  deleteMessageSeconds: number; // 0–604800
  createdAt: string;
}

/** Welcome screen */
export interface WelcomeScreen {
  guildId: Snowflake;
  description: string | null; // max 140 chars
  enabled: boolean;
  channels: WelcomeScreenChannel[];
}

export interface WelcomeScreenChannel {
  channelId: Snowflake;
  description: string; // max 50 chars
  emojiId: Snowflake | null;
  emojiName: string | null;
}

// ============================================================================
// Enums
// ============================================================================

export type NsfwLevel = 'default' | 'explicit' | 'safe' | 'age_restricted';

export type VerificationLevel = 'none' | 'low' | 'medium' | 'high' | 'very_high';

export type ExplicitContentFilter = 'disabled' | 'members_without_roles' | 'all_members';

export type DefaultMessageNotifications = 'all_messages' | 'only_mentions';

export type BoostTier = 0 | 1 | 2 | 3;

export type GuildFeature =
  | 'ANIMATED_ICON'
  | 'BANNER'
  | 'COMMUNITY'
  | 'DISCOVERABLE'
  | 'INVITE_SPLASH'
  | 'VANITY_URL'
  | 'ROLE_ICONS'
  | 'WELCOME_SCREEN_ENABLED';

export type GradientType = 'linear' | 'radial' | 'mesh' | 'none';
export type IconPack = 'outlined' | 'filled' | 'duotone' | 'playful' | 'custom';
export type CornerStyle = 'rounded' | 'sharp' | 'pill';
export type MessageLayoutDefault = 'cozy' | 'compact' | 'bubbles' | 'cards';
