import {
  pgTable,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  pgEnum,
  jsonb,
  real,
} from 'drizzle-orm/pg-core';
import { bigintString } from './helpers';
import { users } from './users';

// ============================================================================
// Enums
// ============================================================================

export const verificationLevelEnum = pgEnum('verification_level', [
  'none',
  'low',
  'medium',
  'high',
  'very_high',
]);

export const explicitContentFilterEnum = pgEnum('explicit_content_filter', [
  'disabled',
  'members_without_roles',
  'all_members',
]);

export const defaultNotificationsEnum = pgEnum('default_notifications', [
  'all_messages',
  'only_mentions',
]);

export const nsfwLevelEnum = pgEnum('nsfw_level', [
  'default',
  'explicit',
  'safe',
  'age_restricted',
]);

export const gradientTypeEnum = pgEnum('gradient_type', ['linear', 'radial', 'mesh', 'none']);

export const iconPackEnum = pgEnum('icon_pack', [
  'outlined',
  'filled',
  'duotone',
  'playful',
  'custom',
]);

export const cornerStyleEnum = pgEnum('corner_style', ['rounded', 'sharp', 'pill']);

export const messageLayoutDefaultEnum = pgEnum('message_layout_default', [
  'cozy',
  'compact',
  'bubbles',
  'cards',
]);

// ============================================================================
// Guilds (Servers)
// ============================================================================

export const guilds = pgTable('guilds', {
  id: bigintString('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  ownerId: bigintString('owner_id')
    .notNull()
    .references(() => users.id),
  iconHash: varchar('icon_hash', { length: 64 }),
  iconAnimated: boolean('icon_animated').notNull().default(false),
  bannerHash: varchar('banner_hash', { length: 64 }),
  bannerAnimated: boolean('banner_animated').notNull().default(false),
  splashHash: varchar('splash_hash', { length: 64 }),
  discoverySplashHash: varchar('discovery_splash_hash', { length: 64 }),
  description: varchar('description', { length: 1000 }),
  vanityUrlCode: varchar('vanity_url_code', { length: 32 }).unique(),
  preferredLocale: varchar('preferred_locale', { length: 10 }).notNull().default('en-US'),
  nsfwLevel: nsfwLevelEnum('nsfw_level').notNull().default('default'),
  verificationLevel: verificationLevelEnum('verification_level').notNull().default('none'),
  explicitContentFilter: explicitContentFilterEnum('explicit_content_filter')
    .notNull()
    .default('disabled'),
  defaultMessageNotifications: defaultNotificationsEnum('default_message_notifications')
    .notNull()
    .default('only_mentions'),
  features: jsonb('features').notNull().default([]),
  discoverable: boolean('discoverable').notNull().default(false),
  memberCount: integer('member_count').notNull().default(0),
  boostCount: integer('boost_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// Guild members
// ============================================================================

export const guildMembers = pgTable('guild_members', {
  userId: bigintString('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  guildId: bigintString('guild_id')
    .notNull()
    .references(() => guilds.id, { onDelete: 'cascade' }),
  nickname: varchar('nickname', { length: 32 }),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  premiumSince: timestamp('premium_since', { withTimezone: true }),
  deaf: boolean('deaf').notNull().default(false),
  mute: boolean('mute').notNull().default(false),
  communicationDisabledUntil: timestamp('communication_disabled_until', { withTimezone: true }),
});

// ============================================================================
// Per-server member profiles
// ============================================================================

export const memberProfiles = pgTable('member_profiles', {
  userId: bigintString('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  guildId: bigintString('guild_id')
    .notNull()
    .references(() => guilds.id, { onDelete: 'cascade' }),
  nickname: varchar('nickname', { length: 32 }),
  avatarHash: varchar('avatar_hash', { length: 64 }),
  avatarAnimated: boolean('avatar_animated').notNull().default(false),
  bannerHash: varchar('banner_hash', { length: 64 }),
  bannerAnimated: boolean('banner_animated').notNull().default(false),
  bio: varchar('bio', { length: 190 }),
});

// ============================================================================
// Roles
// ============================================================================

export const guildRoles = pgTable('guild_roles', {
  id: bigintString('id').primaryKey(),
  guildId: bigintString('guild_id')
    .notNull()
    .references(() => guilds.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  color: integer('color').notNull().default(0), // 24-bit RGB
  hoist: boolean('hoist').notNull().default(false),
  iconHash: varchar('icon_hash', { length: 64 }),
  iconAnimated: boolean('icon_animated').notNull().default(false),
  unicodeEmoji: varchar('unicode_emoji', { length: 32 }),
  position: integer('position').notNull().default(0),
  permissions: bigintString('permissions').notNull().default('0'),
  managed: boolean('managed').notNull().default(false),
  mentionable: boolean('mentionable').notNull().default(false),
});

export const userRoles = pgTable('user_roles', {
  userId: bigintString('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  roleId: bigintString('role_id')
    .notNull()
    .references(() => guildRoles.id, { onDelete: 'cascade' }),
  guildId: bigintString('guild_id')
    .notNull()
    .references(() => guilds.id, { onDelete: 'cascade' }),
});

// ============================================================================
// Guild brand identity
// ============================================================================

export const guildBrand = pgTable('guild_brand', {
  guildId: bigintString('guild_id')
    .primaryKey()
    .references(() => guilds.id, { onDelete: 'cascade' }),
  colorPrimary: varchar('color_primary', { length: 7 }),
  colorSecondary: varchar('color_secondary', { length: 7 }),
  colorAccent: varchar('color_accent', { length: 7 }),
  gradientType: gradientTypeEnum('gradient_type').notNull().default('none'),
  gradientConfig: jsonb('gradient_config'),
  backgroundImageHash: varchar('background_image_hash', { length: 64 }),
  backgroundBlur: integer('background_blur').notNull().default(8),
  fontDisplay: varchar('font_display', { length: 64 }),
  fontBody: varchar('font_body', { length: 64 }),
  iconPack: iconPackEnum('icon_pack').notNull().default('outlined'),
  noiseOpacity: real('noise_opacity').notNull().default(0.03),
  glassOpacity: real('glass_opacity').notNull().default(0.85),
  cornerStyle: cornerStyleEnum('corner_style').notNull().default('rounded'),
  messageLayout: messageLayoutDefaultEnum('message_layout').notNull().default('cozy'),
});

// ============================================================================
// Invites
// ============================================================================

export const invites = pgTable('invites', {
  code: varchar('code', { length: 32 }).primaryKey(),
  guildId: bigintString('guild_id')
    .notNull()
    .references(() => guilds.id, { onDelete: 'cascade' }),
  channelId: bigintString('channel_id').notNull(),
  inviterId: bigintString('inviter_id')
    .notNull()
    .references(() => users.id),
  maxUses: integer('max_uses'),
  uses: integer('uses').notNull().default(0),
  maxAgeSeconds: integer('max_age_seconds'),
  temporary: boolean('temporary').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
});

// ============================================================================
// Bans
// ============================================================================

export const bans = pgTable('bans', {
  guildId: bigintString('guild_id')
    .notNull()
    .references(() => guilds.id, { onDelete: 'cascade' }),
  userId: bigintString('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  moderatorId: bigintString('moderator_id')
    .notNull()
    .references(() => users.id),
  reason: varchar('reason', { length: 512 }),
  deleteMessageSeconds: integer('delete_message_seconds').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// Welcome screens
// ============================================================================

export const welcomeScreens = pgTable('welcome_screens', {
  guildId: bigintString('guild_id')
    .primaryKey()
    .references(() => guilds.id, { onDelete: 'cascade' }),
  description: varchar('description', { length: 140 }),
  enabled: boolean('enabled').notNull().default(false),
});

export const welcomeScreenChannels = pgTable('welcome_screen_channels', {
  id: bigintString('id').primaryKey(),
  guildId: bigintString('guild_id')
    .notNull()
    .references(() => guilds.id, { onDelete: 'cascade' }),
  channelId: bigintString('channel_id').notNull(),
  description: varchar('description', { length: 50 }).notNull(),
  emojiId: bigintString('emoji_id'),
  emojiName: varchar('emoji_name', { length: 64 }),
  sortOrder: integer('sort_order').notNull().default(0),
});

// ============================================================================
// Audit log
// ============================================================================

export const auditLogEntries = pgTable('audit_log_entries', {
  id: bigintString('id').primaryKey(),
  guildId: bigintString('guild_id')
    .notNull()
    .references(() => guilds.id, { onDelete: 'cascade' }),
  userId: bigintString('user_id')
    .notNull()
    .references(() => users.id),
  targetId: bigintString('target_id'),
  actionType: integer('action_type').notNull(),
  changes: jsonb('changes'),
  reason: varchar('reason', { length: 512 }),
  options: jsonb('options'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// Custom Emojis
// ============================================================================

export const guildEmojis = pgTable('guild_emojis', {
  id: bigintString('id').primaryKey(),
  guildId: bigintString('guild_id')
    .notNull()
    .references(() => guilds.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 32 }).notNull(),
  hash: varchar('hash', { length: 64 }).notNull(),
  animated: boolean('animated').notNull().default(false),
  creatorId: bigintString('creator_id')
    .notNull()
    .references(() => users.id),
  available: boolean('available').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// Stickers
// ============================================================================

export const guildStickers = pgTable('guild_stickers', {
  id: bigintString('id').primaryKey(),
  guildId: bigintString('guild_id')
    .notNull()
    .references(() => guilds.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 30 }).notNull(),
  description: varchar('description', { length: 100 }),
  hash: varchar('hash', { length: 64 }).notNull(),
  formatType: varchar('format_type', { length: 10 }).notNull(), // 'png' | 'apng' | 'lottie' | 'webp'
  tags: varchar('tags', { length: 200 }),
  available: boolean('available').notNull().default(true),
  creatorId: bigintString('creator_id')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// Scheduled Events
// ============================================================================

export const guildScheduledEventStatusEnum = pgEnum('guild_scheduled_event_status', [
  'scheduled',
  'active',
  'completed',
  'cancelled',
]);

export const guildScheduledEventEntityTypeEnum = pgEnum('guild_scheduled_event_entity_type', [
  'stage_instance',
  'voice',
  'external',
]);

export const guildScheduledEvents = pgTable('guild_scheduled_events', {
  id: bigintString('id').primaryKey(),
  guildId: bigintString('guild_id')
    .notNull()
    .references(() => guilds.id, { onDelete: 'cascade' }),
  channelId: bigintString('channel_id'),
  creatorId: bigintString('creator_id')
    .notNull()
    .references(() => users.id),
  name: varchar('name', { length: 100 }).notNull(),
  description: varchar('description', { length: 1000 }),
  scheduledStartTime: timestamp('scheduled_start_time', { withTimezone: true }).notNull(),
  scheduledEndTime: timestamp('scheduled_end_time', { withTimezone: true }),
  entityType: guildScheduledEventEntityTypeEnum('entity_type').notNull(),
  entityMetadata: jsonb('entity_metadata'),
  status: guildScheduledEventStatusEnum('status').notNull().default('scheduled'),
  imageHash: varchar('image_hash', { length: 64 }),
  interestedCount: integer('interested_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const guildScheduledEventUsers = pgTable('guild_scheduled_event_users', {
  eventId: bigintString('event_id')
    .notNull()
    .references(() => guildScheduledEvents.id, { onDelete: 'cascade' }),
  userId: bigintString('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  interestedAt: timestamp('interested_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// Auto-Moderation
// ============================================================================

export const autoModEventTypeEnum = pgEnum('auto_mod_event_type', [
  'message_send',
  'member_update',
]);

export const autoModTriggerTypeEnum = pgEnum('auto_mod_trigger_type', [
  'keyword',
  'spam',
  'keyword_preset',
  'mention_spam',
]);

export const autoModActionTypeEnum = pgEnum('auto_mod_action_type', [
  'block_message',
  'send_alert_message',
  'timeout',
]);

export const autoModRules = pgTable('auto_mod_rules', {
  id: bigintString('id').primaryKey(),
  guildId: bigintString('guild_id')
    .notNull()
    .references(() => guilds.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  creatorId: bigintString('creator_id')
    .notNull()
    .references(() => users.id),
  eventType: autoModEventTypeEnum('event_type').notNull(),
  triggerType: autoModTriggerTypeEnum('trigger_type').notNull(),
  triggerMetadata: jsonb('trigger_metadata').notNull().default({}),
  actions: jsonb('actions').notNull().default([]),
  enabled: boolean('enabled').notNull().default(true),
  exemptRoles: jsonb('exempt_roles').notNull().default([]),
  exemptChannels: jsonb('exempt_channels').notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const autoModActionLogs = pgTable('auto_mod_action_logs', {
  id: bigintString('id').primaryKey(),
  guildId: bigintString('guild_id')
    .notNull()
    .references(() => guilds.id, { onDelete: 'cascade' }),
  ruleId: bigintString('rule_id')
    .notNull()
    .references(() => autoModRules.id, { onDelete: 'cascade' }),
  userId: bigintString('user_id')
    .notNull()
    .references(() => users.id),
  channelId: bigintString('channel_id'),
  messageContent: text('message_content'),
  matchedKeyword: varchar('matched_keyword', { length: 200 }),
  actionType: autoModActionTypeEnum('action_type').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// Raid Protection
// ============================================================================

export const raidActionEnum = pgEnum('raid_action', [
  'kick',
  'ban',
  'enable_verification',
  'lock_channels',
  'alert_only',
]);

export const raidConfig = pgTable('raid_config', {
  guildId: bigintString('guild_id')
    .primaryKey()
    .references(() => guilds.id, { onDelete: 'cascade' }),
  enabled: boolean('enabled').notNull().default(false),
  joinThreshold: integer('join_threshold').notNull().default(10),
  joinWindowSeconds: integer('join_window_seconds').notNull().default(60),
  action: raidActionEnum('action').notNull().default('alert_only'),
  autoResolveMinutes: integer('auto_resolve_minutes').notNull().default(30),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// Reports
// ============================================================================

export const reportReasonEnum = pgEnum('report_reason', [
  'spam',
  'harassment',
  'hate_speech',
  'nsfw',
  'self_harm',
  'other',
]);

export const reportStatusEnum = pgEnum('report_status', [
  'pending',
  'reviewing',
  'resolved',
  'dismissed',
]);

export const reports = pgTable('reports', {
  id: bigintString('id').primaryKey(),
  reporterId: bigintString('reporter_id')
    .notNull()
    .references(() => users.id),
  reportedUserId: bigintString('reported_user_id')
    .notNull()
    .references(() => users.id),
  guildId: bigintString('guild_id')
    .notNull()
    .references(() => guilds.id, { onDelete: 'cascade' }),
  messageId: bigintString('message_id'),
  reason: reportReasonEnum('reason').notNull(),
  description: varchar('description', { length: 1000 }),
  status: reportStatusEnum('status').notNull().default('pending'),
  reviewerId: bigintString('reviewer_id').references(() => users.id),
  resolutionNote: text('resolution_note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
});

// ============================================================================
// Server Analytics
// ============================================================================

export const serverAnalyticsDaily = pgTable('server_analytics_daily', {
  guildId: bigintString('guild_id')
    .notNull()
    .references(() => guilds.id, { onDelete: 'cascade' }),
  date: timestamp('date', { withTimezone: true }).notNull(),
  totalMembers: integer('total_members').notNull().default(0),
  newMembers: integer('new_members').notNull().default(0),
  leftMembers: integer('left_members').notNull().default(0),
  messagesSent: integer('messages_sent').notNull().default(0),
  activeMembers: integer('active_members').notNull().default(0),
  voiceMinutes: integer('voice_minutes').notNull().default(0),
  reactionsAdded: integer('reactions_added').notNull().default(0),
  topChannels: jsonb('top_channels').notNull().default([]),
});

export const serverAnalyticsHourly = pgTable('server_analytics_hourly', {
  guildId: bigintString('guild_id')
    .notNull()
    .references(() => guilds.id, { onDelete: 'cascade' }),
  hour: timestamp('hour', { withTimezone: true }).notNull(),
  messages: integer('messages').notNull().default(0),
  activeUsers: integer('active_users').notNull().default(0),
  voiceUsers: integer('voice_users').notNull().default(0),
});
