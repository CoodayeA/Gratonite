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

/** Guild custom emoji */
export interface GuildEmoji {
  id: Snowflake;
  guildId: Snowflake;
  name: string; // 2–32 chars
  hash: string;
  animated: boolean;
  creatorId: Snowflake;
  available: boolean;
  url: string; // CDN URL
  createdAt: string;
}

/** Guild sticker */
export interface GuildSticker {
  id: Snowflake;
  guildId: Snowflake;
  name: string; // 2–30 chars
  description: string | null; // max 100 chars
  hash: string;
  formatType: StickerFormatType;
  tags: string | null; // comma-separated
  available: boolean;
  creatorId: Snowflake;
  url: string; // CDN URL
  createdAt: string;
}

export type StickerFormatType = 'png' | 'apng' | 'lottie' | 'webp';

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

// ============================================================================
// Scheduled Events
// ============================================================================

export interface GuildScheduledEvent {
  id: Snowflake;
  guildId: Snowflake;
  channelId: Snowflake | null;
  creatorId: Snowflake;
  name: string;
  description: string | null;
  scheduledStartTime: string;
  scheduledEndTime: string | null;
  entityType: 'stage_instance' | 'voice' | 'external';
  entityMetadata: { location?: string } | null;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  imageHash: string | null;
  interestedCount: number;
  createdAt: string;
}

// ============================================================================
// Auto-Moderation
// ============================================================================

export type AutoModEventType = 'message_send' | 'member_update';
export type AutoModTriggerType = 'keyword' | 'spam' | 'keyword_preset' | 'mention_spam';
export type AutoModActionType = 'block_message' | 'send_alert_message' | 'timeout';

export interface AutoModTriggerMetadata {
  keywordFilter?: string[];
  regexPatterns?: string[];
  allowList?: string[];
  mentionTotalLimit?: number;
  presets?: string[];
}

export interface AutoModAction {
  type: AutoModActionType;
  metadata?: {
    channelId?: Snowflake;
    customMessage?: string;
    durationSeconds?: number;
  };
}

export interface AutoModRule {
  id: Snowflake;
  guildId: Snowflake;
  name: string;
  creatorId: Snowflake;
  eventType: AutoModEventType;
  triggerType: AutoModTriggerType;
  triggerMetadata: AutoModTriggerMetadata;
  actions: AutoModAction[];
  enabled: boolean;
  exemptRoles: Snowflake[];
  exemptChannels: Snowflake[];
  createdAt: string;
}

// ============================================================================
// Raid Protection
// ============================================================================

export type RaidAction = 'kick' | 'ban' | 'enable_verification' | 'lock_channels' | 'alert_only';

export interface RaidConfig {
  guildId: Snowflake;
  enabled: boolean;
  joinThreshold: number;
  joinWindowSeconds: number;
  action: RaidAction;
  autoResolveMinutes: number;
  updatedAt: string;
}

// ============================================================================
// Reports
// ============================================================================

export type ReportReason = 'spam' | 'harassment' | 'hate_speech' | 'nsfw' | 'self_harm' | 'other';
export type ReportStatus = 'pending' | 'reviewing' | 'resolved' | 'dismissed';

export interface Report {
  id: Snowflake;
  reporterId: Snowflake;
  reportedUserId: Snowflake;
  guildId: Snowflake;
  messageId: Snowflake | null;
  reason: ReportReason;
  description: string | null;
  status: ReportStatus;
  reviewerId: Snowflake | null;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

// ============================================================================
// Server Analytics
// ============================================================================

export interface ServerAnalyticsDaily {
  guildId: Snowflake;
  date: string;
  totalMembers: number;
  newMembers: number;
  leftMembers: number;
  messagesSent: number;
  activeMembers: number;
  voiceMinutes: number;
  reactionsAdded: number;
  topChannels: Array<{ channelId: Snowflake; messageCount: number }>;
}
