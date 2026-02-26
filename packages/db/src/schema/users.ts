import {
  pgTable,
  varchar,
  text,
  boolean,
  timestamp,
  date,
  integer,
  jsonb,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { bigintString } from './helpers';

// ============================================================================
// Enums
// ============================================================================

export const themePreferenceEnum = pgEnum('theme_preference', [
  'dark',
  'light',
  'system',
  'oled_dark',
]);

export const presenceStatusEnum = pgEnum('presence_status', [
  'online',
  'idle',
  'dnd',
  'invisible',
  'offline',
]);

export const userTierEnum = pgEnum('user_tier', ['free', 'crystalline']);

export const messageLayoutEnum = pgEnum('message_layout', [
  'cozy',
  'compact',
  'bubbles',
  'cards',
]);

export const streamerModeEnum = pgEnum('streamer_mode', ['off', 'on', 'auto']);

export const privacyLevelEnum = pgEnum('privacy_level', [
  'everyone',
  'friends',
  'server_members',
  'nobody',
]);

export const visibilityEnum = pgEnum('visibility', ['everyone', 'friends', 'none']);

export const connectedAccountProviderEnum = pgEnum('connected_account_provider', [
  'github',
  'twitter',
  'spotify',
  'twitch',
  'youtube',
  'steam',
  'reddit',
  'playstation',
  'xbox',
  'epic_games',
]);

export const relationshipTypeEnum = pgEnum('relationship_type', [
  'friend',
  'blocked',
  'pending_incoming',
  'pending_outgoing',
]);

// ============================================================================
// Users table (auth + identity — kept lean)
// ============================================================================

export const users = pgTable('users', {
  id: bigintString('id').primaryKey(),
  username: varchar('username', { length: 32 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  passwordHash: text('password_hash'), // nullable for OAuth-only users
  dateOfBirth: text('date_of_birth'), // encrypted at rest (AES-256-GCM)
  googleId: varchar('google_id', { length: 255 }).unique(),
  appleId: varchar('apple_id', { length: 255 }).unique(),
  facebookId: varchar('facebook_id', { length: 255 }).unique(),
  mfaSecret: text('mfa_secret'), // encrypted
  mfaBackupCodes: text('mfa_backup_codes'), // JSON array, hashed with Argon2
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  bot: boolean('bot').notNull().default(false),
  disabled: boolean('disabled').notNull().default(false),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// ============================================================================
// User profiles (all display/customization)
// ============================================================================

export const userProfiles = pgTable('user_profiles', {
  userId: bigintString('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  displayName: varchar('display_name', { length: 32 }).notNull(),
  avatarHash: varchar('avatar_hash', { length: 64 }),
  avatarAnimated: boolean('avatar_animated').notNull().default(false),
  bannerHash: varchar('banner_hash', { length: 64 }),
  bannerAnimated: boolean('banner_animated').notNull().default(false),
  accentColor: integer('accent_color'), // 24-bit RGB
  bio: varchar('bio', { length: 190 }),
  pronouns: varchar('pronouns', { length: 40 }),
  avatarDecorationId: bigintString('avatar_decoration_id'),
  profileEffectId: bigintString('profile_effect_id'),
  nameplateId: bigintString('nameplate_id'),
  themePreference: themePreferenceEnum('theme_preference').notNull().default('dark'),
  tier: userTierEnum('tier').notNull().default('free'),
  primaryColor: integer('primary_color'),
  previousAvatarHashes: jsonb('previous_avatar_hashes')
    .$type<string[]>()
    .notNull()
    .default([]),
  messageCount: integer('message_count').notNull().default(0),
  widgets: jsonb('widgets').$type<string[]>().default([]),
});

// ============================================================================
// User settings (preferences)
// ============================================================================

export const userSettings = pgTable('user_settings', {
  userId: bigintString('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  locale: varchar('locale', { length: 10 }).notNull().default('en-US'),
  theme: varchar('theme', { length: 64 }).notNull().default('obsidian'),
  messageDisplay: messageLayoutEnum('message_display').notNull().default('cozy'),
  reducedMotion: boolean('reduced_motion').notNull().default(false),
  highContrast: boolean('high_contrast').notNull().default(false),
  fontScale: integer('font_scale').notNull().default(100), // stored as percentage (75-150)
  saturation: integer('saturation').notNull().default(100), // stored as percentage (0-100)
  developerMode: boolean('developer_mode').notNull().default(false),
  streamerMode: streamerModeEnum('streamer_mode').notNull().default('off'),
  calmMode: boolean('calm_mode').notNull().default(false),
  allowDmsFrom: privacyLevelEnum('allow_dms_from').notNull().default('everyone'),
  allowGroupDmInvitesFrom: privacyLevelEnum('allow_group_dm_invites_from')
    .notNull()
    .default('everyone'),
  allowFriendRequestsFrom: privacyLevelEnum('allow_friend_requests_from')
    .notNull()
    .default('everyone'),
  // Call settings
  ringtone: varchar('ringtone', { length: 255 }),
  callRingDuration: integer('call_ring_duration').notNull().default(30),
});

// ============================================================================
// DND schedule (timezone-aware, day-of-week bitmask)
// ============================================================================

export const userDndSchedule = pgTable('user_dnd_schedule', {
  userId: bigintString('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  enabled: boolean('enabled').notNull().default(false),
  startTime: varchar('start_time', { length: 5 }).notNull().default('22:00'),
  endTime: varchar('end_time', { length: 5 }).notNull().default('08:00'),
  timezone: varchar('timezone', { length: 64 }).notNull().default('UTC'),
  daysOfWeek: integer('days_of_week').notNull().default(127),
  allowExceptions: jsonb('allow_exceptions').$type<string[]>().default([]),
});

// ============================================================================
// Custom status (ephemeral)
// ============================================================================

export const userCustomStatus = pgTable('user_custom_status', {
  userId: bigintString('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  text: varchar('text', { length: 128 }),
  emojiId: bigintString('emoji_id'),
  emojiName: varchar('emoji_name', { length: 64 }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
});

// ============================================================================
// Connected accounts
// ============================================================================

export const connectedAccounts = pgTable('connected_accounts', {
  id: bigintString('id').primaryKey(),
  userId: bigintString('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  provider: connectedAccountProviderEnum('provider').notNull(),
  providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(),
  providerUsername: varchar('provider_username', { length: 255 }).notNull(),
  visibility: visibilityEnum('visibility').notNull().default('everyone'),
  showActivity: boolean('show_activity').notNull().default(true),
  accessToken: text('access_token'), // encrypted
  refreshToken: text('refresh_token'), // encrypted
});

// ============================================================================
// Relationships (friends, blocks)
// ============================================================================

export const relationships = pgTable('relationships', {
  userId: bigintString('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  targetId: bigintString('target_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: relationshipTypeEnum('type').notNull(),
  nickname: varchar('nickname', { length: 32 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// Sessions
// ============================================================================

export const sessions = pgTable('sessions', {
  id: bigintString('id').primaryKey(),
  userId: bigintString('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  refreshTokenHash: varchar('refresh_token_hash', { length: 128 }).notNull(),
  ipAddress: varchar('ip_address', { length: 45 }), // IPv4 or IPv6
  userAgent: text('user_agent'),
  deviceType: varchar('device_type', { length: 20 }), // web, desktop, mobile, bot
  approximateLocation: varchar('approximate_location', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revoked: boolean('revoked').notNull().default(false),
});

// ============================================================================
// User notes (private notes one user keeps on another)
// ============================================================================

export const userNotes = pgTable('user_notes', {
  authorId: bigintString('author_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  targetId: bigintString('target_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  content: varchar('content', { length: 256 }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// Badges
// ============================================================================

export const badges = pgTable('badges', {
  id: bigintString('id').primaryKey(),
  name: varchar('name', { length: 64 }).notNull(),
  description: varchar('description', { length: 255 }).notNull(),
  iconHash: varchar('icon_hash', { length: 64 }).notNull(),
  iconAnimated: boolean('icon_animated').notNull().default(false),
  bitPosition: integer('bit_position').notNull().unique(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const userBadges = pgTable('user_badges', {
  userId: bigintString('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  badgeId: bigintString('badge_id')
    .notNull()
    .references(() => badges.id, { onDelete: 'cascade' }),
  grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// Account deletion requests
// ============================================================================

export const accountDeletionRequests = pgTable('account_deletion_requests', {
  userId: bigintString('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
  executeAt: timestamp('execute_at', { withTimezone: true }).notNull(),
  messageHandling: varchar('message_handling', { length: 20 }).notNull().default('anonymize'),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  executedAt: timestamp('executed_at', { withTimezone: true }),
});

// ============================================================================
// Avatar decorations (catalog)
// ============================================================================

export const avatarDecorations = pgTable('avatar_decorations', {
  id: bigintString('id').primaryKey(),
  name: varchar('name', { length: 64 }).notNull(),
  description: varchar('description', { length: 255 }),
  assetHash: varchar('asset_hash', { length: 64 }).notNull(),
  animated: boolean('animated').notNull().default(false),
  category: varchar('category', { length: 32 }),
  sortOrder: integer('sort_order').notNull().default(0),
  available: boolean('available').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// Profile effects (catalog)
// ============================================================================

export const profileEffects = pgTable('profile_effects', {
  id: bigintString('id').primaryKey(),
  name: varchar('name', { length: 64 }).notNull(),
  description: varchar('description', { length: 255 }),
  assetHash: varchar('asset_hash', { length: 64 }).notNull(),
  animated: boolean('animated').notNull().default(false),
  category: varchar('category', { length: 32 }),
  sortOrder: integer('sort_order').notNull().default(0),
  available: boolean('available').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// Nameplates (catalog)
// ============================================================================

export const nameplates = pgTable('nameplates', {
  id: bigintString('id').primaryKey(),
  name: varchar('name', { length: 64 }).notNull(),
  description: varchar('description', { length: 255 }),
  assetHash: varchar('asset_hash', { length: 64 }).notNull(),
  animated: boolean('animated').notNull().default(false),
  category: varchar('category', { length: 32 }),
  sortOrder: integer('sort_order').notNull().default(0),
  available: boolean('available').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// Community shop items
// ============================================================================

export const communityItemTypeEnum = pgEnum('community_item_type', [
  'display_name_style_pack',
  'profile_widget_pack',
  'server_tag_badge',
  'avatar_decoration',
  'profile_effect',
  'nameplate',
]);

export const communityItemStatusEnum = pgEnum('community_item_status', [
  'draft',
  'pending_review',
  'approved',
  'rejected',
  'published',
  'unpublished',
]);

export const communityItemScopeEnum = pgEnum('community_item_scope', [
  'global',
  'guild',
]);

export const communityReportStatusEnum = pgEnum('community_report_status', [
  'open',
  'resolved',
  'dismissed',
]);

export const betaBugReportStatusEnum = pgEnum('beta_bug_report_status', [
  'open',
  'triaged',
  'resolved',
  'dismissed',
]);

export const communityItems = pgTable('community_items', {
  id: bigintString('id').primaryKey(),
  itemType: communityItemTypeEnum('item_type').notNull(),
  name: varchar('name', { length: 64 }).notNull(),
  description: varchar('description', { length: 255 }),
  uploaderId: bigintString('uploader_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  payload: jsonb('payload').notNull().default({}),
  payloadSchemaVersion: integer('payload_schema_version').notNull().default(1),
  assetHash: varchar('asset_hash', { length: 64 }),
  tags: jsonb('tags').notNull().default([]),
  status: communityItemStatusEnum('status').notNull().default('draft'),
  moderationNotes: text('moderation_notes'),
  rejectionCode: varchar('rejection_code', { length: 64 }),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const communityItemInstalls = pgTable('community_item_installs', {
  userId: bigintString('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  itemId: bigintString('item_id')
    .notNull()
    .references(() => communityItems.id, { onDelete: 'cascade' }),
  scope: communityItemScopeEnum('scope').notNull().default('global'),
  scopeId: bigintString('scope_id'),
  installedAt: timestamp('installed_at', { withTimezone: true }).notNull().defaultNow(),
});

export const communityItemReports = pgTable('community_item_reports', {
  id: bigintString('id').primaryKey(),
  itemId: bigintString('item_id')
    .notNull()
    .references(() => communityItems.id, { onDelete: 'cascade' }),
  reporterId: bigintString('reporter_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  reason: varchar('reason', { length: 64 }).notNull(),
  details: varchar('details', { length: 500 }),
  status: communityReportStatusEnum('status').notNull().default('open'),
  reviewedBy: bigintString('reviewed_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
});

export const betaBugReports = pgTable('beta_bug_reports', {
  id: bigintString('id').primaryKey(),
  reporterId: bigintString('reporter_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 120 }).notNull(),
  summary: text('summary').notNull(),
  steps: text('steps'),
  expected: text('expected'),
  actual: text('actual'),
  route: varchar('route', { length: 255 }),
  pageUrl: text('page_url'),
  channelLabel: varchar('channel_label', { length: 120 }),
  viewport: varchar('viewport', { length: 64 }),
  userAgent: text('user_agent'),
  clientTimestamp: timestamp('client_timestamp', { withTimezone: true }),
  submissionSource: varchar('submission_source', { length: 32 }).notNull().default('web'),
  status: betaBugReportStatusEnum('status').notNull().default('open'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// Soft currency economy
// ============================================================================

export const rewardSourceEnum = pgEnum('reward_source', [
  'chat_message',
  'server_engagement',
  'daily_checkin',
  'shop_purchase',
  'creator_item_purchase',
]);

export const currencyWallets = pgTable('currency_wallets', {
  userId: bigintString('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  balance: integer('balance').notNull().default(0),
  lifetimeEarned: integer('lifetime_earned').notNull().default(0),
  lifetimeSpent: integer('lifetime_spent').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const currencyLedger = pgTable('currency_ledger', {
  id: bigintString('id').primaryKey(),
  userId: bigintString('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  direction: varchar('direction', { length: 10 }).notNull(), // earn | spend
  amount: integer('amount').notNull(),
  source: rewardSourceEnum('source').notNull(),
  description: varchar('description', { length: 255 }),
  contextKey: varchar('context_key', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const rewardEvents = pgTable('reward_events', {
  id: bigintString('id').primaryKey(),
  userId: bigintString('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  source: rewardSourceEnum('source').notNull(),
  contextKey: varchar('context_key', { length: 100 }),
  amount: integer('amount').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// Email verification tokens (hashed, single-use)
// ============================================================================

export const emailVerificationTokens = pgTable('email_verification_tokens', {
  id: bigintString('id').primaryKey(),
  userId: bigintString('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 128 }).notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
