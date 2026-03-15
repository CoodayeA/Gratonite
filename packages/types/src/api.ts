/**
 * api.ts — Core API types for Gratonite.
 *
 * These are PURE TypeScript interfaces that represent the API contract between
 * the backend and frontend. They mirror the Drizzle schema types but:
 *   - Omit sensitive fields (passwordHash, mfaSecret, webhookSecretHash, etc.)
 *   - Use `string` for dates (JSON serializes timestamps as ISO strings)
 *   - Use `string` for bigint fields (JSON doesn't support bigint)
 *   - Include common derived/joined fields (e.g. `roles` on GuildMember)
 */

// ---------------------------------------------------------------------------
// Generic API response wrapper
// ---------------------------------------------------------------------------

/** Standardized API error shape. */
export interface ApiError {
  error: string;
  code?: string;
  /** Field-level validation errors. */
  details?: Record<string, string>;
}

/** Wraps all API responses: either data or an error. */
export type ApiResponse<T> = { data: T } | ApiError;

/** Paginated list response. */
export interface PaginatedResponse<T> {
  data: T[];
  total?: number;
  cursor?: string;
  hasMore?: boolean;
}

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

/** User presence status. */
export type UserStatus = 'online' | 'idle' | 'dnd' | 'invisible' | 'offline';

/** Rich presence activity. */
export interface UserActivity {
  name: string;
  type: string;
}

/** Public user object returned by the API. Never includes passwordHash or mfaSecret. */
export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatarHash: string | null;
  bannerHash: string | null;
  bio: string | null;
  pronouns: string | null;
  customStatus: string | null;
  status: UserStatus;
  isAdmin: boolean;
  emailVerified: boolean;
  mfaEnabled: boolean;
  onboardingCompleted: boolean;
  nameplateStyle: string | null;
  badges: string[];
  interests: string | null;
  activity: UserActivity | null;
  statusEmoji: string | null;
  statusExpiresAt: string | null;
  xp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  lastStreakAt: string | null;
  coins: number;
  avatarAnimated: boolean;
  bannerAnimated: boolean;
  bannerColor: string | null;
  isBot: boolean;
  isFederated: boolean;
  federationAddress: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Minimal user object used in message payloads, member lists, etc.
 * Avoids sending the full User object where only display info is needed.
 */
export interface UserSummary {
  id: string;
  username: string;
  displayName: string;
  avatarHash: string | null;
  status: UserStatus;
  isBot: boolean;
  badges: string[];
  nameplateStyle: string | null;
}

// ---------------------------------------------------------------------------
// Guild (Server)
// ---------------------------------------------------------------------------

export interface Guild {
  id: string;
  name: string;
  description: string | null;
  iconHash: string | null;
  bannerHash: string | null;
  accentColor: string | null;
  ownerId: string;
  isDiscoverable: boolean;
  isFeatured: boolean;
  isPinned: boolean;
  discoverRank: number;
  memberCount: number;
  welcomeMessage: string | null;
  rulesChannelId: string | null;
  category: string | null;
  rulesText: string | null;
  requireRulesAgreement: boolean;
  vanityCode: string | null;
  boostCount: number;
  boostTier: number;
  spotlightChannelId: string | null;
  spotlightMessage: string | null;
  afkChannelId: string | null;
  afkTimeout: number | null;
  publicStatsEnabled: boolean;
  federationEnabled: boolean;
  federationAddress: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Channel
// ---------------------------------------------------------------------------

export type ChannelType =
  | 'GUILD_TEXT'
  | 'GUILD_VOICE'
  | 'GUILD_CATEGORY'
  | 'DM'
  | 'GROUP_DM';

export interface Channel {
  id: string;
  guildId: string | null;
  name: string;
  type: ChannelType;
  topic: string | null;
  position: number;
  parentId: string | null;
  isNsfw: boolean;
  rateLimitPerUser: number;
  backgroundUrl: string | null;
  backgroundType: string | null;
  isGroup: boolean;
  groupName: string | null;
  groupIcon: string | null;
  ownerId: string | null;
  disappearTimer: number | null;
  linkedTextChannelId: string | null;
  forumTags: ForumTag[] | null;
  isAnnouncement: boolean;
  userLimit: number | null;
  isEncrypted: boolean;
  attachmentsEnabled: boolean;
  permissionSynced: boolean;
  archived: boolean;
  autoArchiveDays: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ForumTag {
  id: string;
  name: string;
  color?: string;
}

// ---------------------------------------------------------------------------
// Message
// ---------------------------------------------------------------------------

export interface Attachment {
  id: string;
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}

export interface Embed {
  url?: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  /** For bot rich embeds */
  type?: 'rich' | 'link';
  color?: string;
  fields?: EmbedField[];
  thumbnail?: { url: string };
  footer?: { text: string; iconUrl?: string };
  author?: { name: string; url?: string; iconUrl?: string };
  timestamp?: string;
}

export interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface MessageComponent {
  type: 'action_row';
  components: ComponentButton[];
}

export interface ComponentButton {
  type: 'button' | 'select_menu';
  customId?: string;
  label?: string;
  style?: number;
  url?: string;
  disabled?: boolean;
  emoji?: string;
  options?: SelectOption[];
}

export interface SelectOption {
  label: string;
  value: string;
  description?: string;
  emoji?: string;
  default?: boolean;
}

export interface Message {
  id: string;
  channelId: string;
  authorId: string | null;
  content: string | null;
  attachments: Attachment[];
  edited: boolean;
  editedAt: string | null;
  replyToId: string | null;
  threadId: string | null;
  embeds: Embed[];
  components: MessageComponent[];
  isEncrypted: boolean;
  encryptedContent: string | null;
  keyVersion: number | null;
  createdAt: string;
  expiresAt: string | null;
  /** Joined field: author user object (included in most message fetches). */
  author?: UserSummary;
  /** Joined field: reactions grouped by emoji. */
  reactions?: ReactionGroup[];
  /** Joined field: the message being replied to. */
  replyTo?: Message | null;
}

// ---------------------------------------------------------------------------
// GuildMember
// ---------------------------------------------------------------------------

export interface GuildMember {
  id: string;
  guildId: string;
  userId: string;
  nickname: string | null;
  joinedAt: string;
  timeoutUntil: string | null;
  agreedRulesAt: string | null;
  /** Joined field: the user object for this member. */
  user?: UserSummary;
  /** Joined field: roles assigned to this member. */
  roles?: Role[];
}

// ---------------------------------------------------------------------------
// Role
// ---------------------------------------------------------------------------

export interface Role {
  id: string;
  guildId: string;
  name: string;
  color: string | null;
  position: number;
  /** Serialized as string because bigint is not JSON-safe. */
  permissions: string;
  hoist: boolean;
  mentionable: boolean;
  iconHash: string | null;
  unicodeEmoji: string | null;
  createdAt: string;
}

/**
 * Permission bit flags (as bigint constants).
 * Consumers should parse Role.permissions with BigInt() and use bitwise ops.
 */
export const Permissions = {
  ADMINISTRATOR:     1n << 0n,
  MANAGE_GUILD:      1n << 1n,
  MANAGE_CHANNELS:   1n << 2n,
  MANAGE_ROLES:      1n << 3n,
  KICK_MEMBERS:      1n << 4n,
  BAN_MEMBERS:       1n << 5n,
  MANAGE_MESSAGES:   1n << 6n,
  SEND_MESSAGES:     1n << 7n,
  VIEW_CHANNEL:      1n << 8n,
  CONNECT:           1n << 9n,
  SPEAK:             1n << 10n,
  MUTE_MEMBERS:      1n << 11n,
  DEAFEN_MEMBERS:    1n << 12n,
  MANAGE_NICKNAMES:  1n << 13n,
  MANAGE_EMOJIS:     1n << 14n,
  MANAGE_WEBHOOKS:   1n << 15n,
  CREATE_INVITES:    1n << 16n,
  MODERATE_MEMBERS:  1n << 17n,
} as const;

// ---------------------------------------------------------------------------
// Invite
// ---------------------------------------------------------------------------

export interface Invite {
  code: string;
  guildId: string;
  createdBy: string;
  maxUses: number | null;
  uses: number;
  expiresAt: string | null;
  temporary: boolean;
  createdAt: string;
  /** Joined field: the guild this invite is for. */
  guild?: Guild;
  /** Joined field: the user who created the invite. */
  creator?: UserSummary;
}

// ---------------------------------------------------------------------------
// BotApplication
// ---------------------------------------------------------------------------

export interface BotApplication {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  avatarHash: string | null;
  webhookUrl: string;
  isActive: boolean;
  subscribedEvents: string[] | null;
  botUserId: string | null;
  listingId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Reaction
// ---------------------------------------------------------------------------

export interface Reaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: string;
}

/** Aggregated reaction info (grouped by emoji on a message). */
export interface ReactionGroup {
  emoji: string;
  count: number;
  /** Whether the current user has reacted with this emoji. */
  me: boolean;
  /** User IDs who reacted (may be partial). */
  userIds?: string[];
}

// ---------------------------------------------------------------------------
// Thread
// ---------------------------------------------------------------------------

export interface Thread {
  id: string;
  channelId: string;
  name: string;
  creatorId: string;
  originMessageId: string | null;
  archived: boolean;
  locked: boolean;
  forumTagIds: string[] | null;
  pinned: boolean;
  messageCount: number;
  archiveAfter: number | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Notification
// ---------------------------------------------------------------------------

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  read: boolean;
  createdAt: string;
}
