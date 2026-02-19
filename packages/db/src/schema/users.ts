import {
  pgTable,
  bigint,
  varchar,
  text,
  boolean,
  timestamp,
  date,
  integer,
  pgEnum,
} from 'drizzle-orm/pg-core';

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
  id: bigint('id', { mode: 'number' }).primaryKey(),
  username: varchar('username', { length: 32 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  passwordHash: text('password_hash'), // nullable for OAuth-only users
  dateOfBirth: text('date_of_birth'), // encrypted at rest (AES-256-GCM)
  googleId: varchar('google_id', { length: 255 }).unique(),
  mfaSecret: text('mfa_secret'), // encrypted
  mfaBackupCodes: text('mfa_backup_codes'), // JSON array, hashed with Argon2
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  disabled: boolean('disabled').notNull().default(false),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// ============================================================================
// User profiles (all display/customization)
// ============================================================================

export const userProfiles = pgTable('user_profiles', {
  userId: bigint('user_id', { mode: 'number' })
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
  avatarDecorationId: bigint('avatar_decoration_id', { mode: 'number' }),
  profileEffectId: bigint('profile_effect_id', { mode: 'number' }),
  themePreference: themePreferenceEnum('theme_preference').notNull().default('dark'),
  tier: userTierEnum('tier').notNull().default('free'),
});

// ============================================================================
// User settings (preferences)
// ============================================================================

export const userSettings = pgTable('user_settings', {
  userId: bigint('user_id', { mode: 'number' })
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
});

// ============================================================================
// Custom status (ephemeral)
// ============================================================================

export const userCustomStatus = pgTable('user_custom_status', {
  userId: bigint('user_id', { mode: 'number' })
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  text: varchar('text', { length: 128 }),
  emojiId: bigint('emoji_id', { mode: 'number' }),
  emojiName: varchar('emoji_name', { length: 64 }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
});

// ============================================================================
// Connected accounts
// ============================================================================

export const connectedAccounts = pgTable('connected_accounts', {
  id: bigint('id', { mode: 'number' }).primaryKey(),
  userId: bigint('user_id', { mode: 'number' })
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
  userId: bigint('user_id', { mode: 'number' })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  targetId: bigint('target_id', { mode: 'number' })
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
  id: bigint('id', { mode: 'number' }).primaryKey(),
  userId: bigint('user_id', { mode: 'number' })
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
  authorId: bigint('author_id', { mode: 'number' })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  targetId: bigint('target_id', { mode: 'number' })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  content: varchar('content', { length: 256 }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// Badges
// ============================================================================

export const badges = pgTable('badges', {
  id: bigint('id', { mode: 'number' }).primaryKey(),
  name: varchar('name', { length: 64 }).notNull(),
  description: varchar('description', { length: 255 }).notNull(),
  iconHash: varchar('icon_hash', { length: 64 }).notNull(),
  iconAnimated: boolean('icon_animated').notNull().default(false),
  bitPosition: integer('bit_position').notNull().unique(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const userBadges = pgTable('user_badges', {
  userId: bigint('user_id', { mode: 'number' })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  badgeId: bigint('badge_id', { mode: 'number' })
    .notNull()
    .references(() => badges.id, { onDelete: 'cascade' }),
  grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// Account deletion requests
// ============================================================================

export const accountDeletionRequests = pgTable('account_deletion_requests', {
  userId: bigint('user_id', { mode: 'number' })
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
  executeAt: timestamp('execute_at', { withTimezone: true }).notNull(),
  messageHandling: varchar('message_handling', { length: 20 }).notNull().default('anonymize'),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  executedAt: timestamp('executed_at', { withTimezone: true }),
});
