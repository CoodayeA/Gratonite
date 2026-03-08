// Shared types for Gratonite mobile app

export interface User {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
  isAdmin: boolean;
  displayName: string | null;
  avatarHash: string | null;
  bannerHash: string | null;
  bio: string | null;
  pronouns: string | null;
  status: PresenceStatus;
  customStatus: string | null;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    username: string;
    email: string;
    emailVerified: boolean;
    isAdmin: boolean;
  };
}

export interface Guild {
  id: string;
  name: string;
  ownerId: string;
  iconHash: string | null;
  bannerHash: string | null;
  description: string | null;
  memberCount: number;
  createdAt: string;
}

export interface Channel {
  id: string;
  guildId: string | null;
  name: string;
  type: string;
  topic: string | null;
  parentId: string | null;
  position: number;
  backgroundUrl?: string | null;
  backgroundType?: 'image' | 'video' | null;
}

export interface GuildEmoji {
  id: string;
  guildId: string;
  name: string;
  imageHash: string;
  uploadedBy: string;
  createdAt: string;
}

export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  type: number;
  createdAt: string;
  editedAt: string | null;
  author?: {
    id: string;
    username: string;
    displayName: string | null;
    avatarHash: string | null;
  };
  pinned?: boolean;
  replyToId?: string | null;
  replyTo?: {
    id: string;
    content: string;
    authorId: string;
    author?: {
      id: string;
      username: string;
      displayName: string | null;
    };
  } | null;
}

export interface GuildMember {
  userId: string;
  guildId: string;
  nickname: string | null;
  joinedAt: string;
}

export interface Relationship {
  id: string;
  userId: string;
  targetId: string;
  type: 'friend' | 'blocked' | 'pending_incoming' | 'pending_outgoing';
  user?: User;
}

export interface DMChannel {
  id: string;
  recipientId: string;
  recipient?: User;
  lastMessageAt: string | null;
}

export type PresenceStatus = 'online' | 'idle' | 'dnd' | 'invisible' | 'offline';

export interface VoiceState {
  channelId: string;
  userId: string;
  selfMute: boolean;
  selfDeaf: boolean;
  sessionId: string;
}

// ---------------------------------------------------------------------------
// Reactions
// ---------------------------------------------------------------------------

export interface ReactionGroup {
  emoji: string;
  count: number;
  userIds: string[];
  me: boolean;
}

// ---------------------------------------------------------------------------
// Pins
// ---------------------------------------------------------------------------

export interface PinnedMessage {
  id: string;
  channelId: string;
  content: string;
  attachments?: unknown;
  authorId: string;
  createdAt: string;
  pinnedAt: string;
  pinnedBy: string;
  author: {
    id: string;
    username: string;
    displayName: string | null;
    avatarHash: string | null;
  } | null;
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export interface Role {
  id: string;
  guildId: string;
  name: string;
  color: string | null;
  position: number;
  permissions: string;
  hoist: boolean;
  mentionable: boolean;
}

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------

export interface GuildInvite {
  code: string;
  guildId: string;
  createdBy: string;
  maxUses: number | null;
  uses: number;
  expiresAt: string | null;
  temporary: boolean;
  createdAt: string;
  creatorUsername?: string;
}

export interface InvitePreview {
  invite: { code: string; guildId: string };
  guild: {
    id: string;
    name: string;
    iconHash: string | null;
    memberCount: number;
    description: string | null;
  };
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export interface SearchResult {
  id: string;
  channelId: string;
  channelName: string | null;
  guildId: string | null;
  guildName: string | null;
  content: string;
  createdAt: string;
  author: {
    id: string;
    username: string;
    displayName: string | null;
    avatarHash: string | null;
  } | null;
}

// ---------------------------------------------------------------------------
// Threads
// ---------------------------------------------------------------------------

export interface Thread {
  id: string;
  channelId: string;
  name: string;
  creatorId: string;
  creatorName?: string;
  creatorAvatarHash?: string | null;
  originMessageId: string | null;
  archived: boolean;
  locked: boolean;
  createdAt: string;
  messageCount?: number;
  lastActivity?: string | null;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export interface ScheduledEvent {
  id: string;
  guildId: string;
  channelId: string | null;
  name: string;
  description: string | null;
  startTime: string;
  endTime: string | null;
  location: string | null;
  creatorId: string;
  creatorName?: string;
  interestedCount: number;
  status: string;
  createdAt: string;
  isInterested?: boolean;
}

// ---------------------------------------------------------------------------
// Polls
// ---------------------------------------------------------------------------

export interface PollOption {
  id: string;
  text: string;
  position: number;
  voteCount: number;
}

export interface Poll {
  id: string;
  channelId: string;
  question: string;
  multipleChoice: boolean;
  expiresAt: string | null;
  creatorId: string;
  creatorName?: string;
  createdAt: string;
  totalVoters: number;
  myVotes: string[];
  options: PollOption[];
}

// ---------------------------------------------------------------------------
// Wiki
// ---------------------------------------------------------------------------

export interface WikiPage {
  id: string;
  channelId: string;
  title: string;
  content: string;
  authorId: string;
  author?: string;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WikiRevision {
  id: string;
  pageId: string;
  content: string;
  editedBy: string;
  author?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export interface Notification {
  id: string;
  type: string;
  senderId: string | null;
  senderName: string | null;
  channelId: string | null;
  guildId: string | null;
  content: string;
  preview: string | null;
  read: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

export interface Attachment {
  id: string;
  messageId: string;
  filename: string;
  contentType: string;
  size: number;
  url: string;
  width?: number | null;
  height?: number | null;
}

// ---------------------------------------------------------------------------
// Stickers
// ---------------------------------------------------------------------------

export interface Sticker {
  id: string;
  guildId: string | null;
  name: string;
  url: string;
  creatorId: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Bookmarks
// ---------------------------------------------------------------------------

export interface Bookmark {
  id: string;
  messageId: string;
  note: string | null;
  createdAt: string;
  messageContent: string | null;
  messageAuthorId: string | null;
  channelId: string;
  channelName: string | null;
  guildId: string | null;
  guildName: string | null;
  authorUsername: string | null;
  authorDisplayName: string | null;
}

// ---------------------------------------------------------------------------
// Drafts
// ---------------------------------------------------------------------------

export interface Draft {
  id: string;
  userId: string;
  channelId: string;
  content: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Scheduled Messages
// ---------------------------------------------------------------------------

export interface ScheduledMessage {
  id: string;
  channelId: string;
  content: string;
  scheduledFor: string;
  status: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Group DMs
// ---------------------------------------------------------------------------

export interface GroupDMChannel {
  id: string;
  name: string | null;
  ownerId: string;
  iconHash: string | null;
  recipients: Array<{
    id: string;
    username: string;
    displayName: string | null;
    avatarHash: string | null;
  }>;
  lastMessageAt: string | null;
}

// ---------------------------------------------------------------------------
// User Settings
// ---------------------------------------------------------------------------

export interface UserSettings {
  theme: string;
  compactMode: boolean;
  fontSize: string;
  pushEnabled: boolean;
  dmPrivacy: string;
  friendRequestPrivacy: string;
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export interface Session {
  id: string;
  device: string;
  ip: string;
  lastActive: string;
  current: boolean;
}

// ---------------------------------------------------------------------------
// User Mutes
// ---------------------------------------------------------------------------

export interface UserMute {
  id: string;
  userId: string;
  mutedUserId: string;
  mutedUser?: {
    id: string;
    username: string;
    displayName: string | null;
    avatarHash: string | null;
  };
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Audit Log
// ---------------------------------------------------------------------------

export interface AuditLogEntry {
  id: string;
  guildId: string;
  actorId: string;
  actorName?: string;
  action: string;
  targetType: string;
  targetId: string | null;
  changes: Record<string, unknown> | null;
  reason: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

export interface Webhook {
  id: string;
  guildId: string;
  channelId: string;
  name: string;
  avatarHash: string | null;
  token: string;
  creatorId: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Word Filter
// ---------------------------------------------------------------------------

export interface WordFilter {
  id: string;
  guildId: string;
  word: string;
  action: 'block' | 'delete' | 'warn';
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Ban Appeal
// ---------------------------------------------------------------------------

export interface BanAppeal {
  id: string;
  guildId: string;
  userId: string;
  username?: string;
  reason: string;
  status: 'pending' | 'accepted' | 'rejected';
  reviewedBy: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Server Folder
// ---------------------------------------------------------------------------

export interface ServerFolder {
  id: string;
  userId: string;
  name: string;
  color: string | null;
  guildIds: string[];
  position: number;
}

// ---------------------------------------------------------------------------
// Economy / Shop
// ---------------------------------------------------------------------------

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  type: string;
  price: number;
  imageUrl: string | null;
  rarity: string;
  available: boolean;
}

export interface InventoryItem {
  id: string;
  itemId: string;
  item: ShopItem;
  equipped: boolean;
  acquiredAt: string;
}

export interface WalletInfo {
  balance: number;
  lifetimeEarned: number;
  lastClaimAt: string | null;
}

export interface LedgerEntry {
  id: string;
  amount: number;
  type: string;
  description: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Forum
// ---------------------------------------------------------------------------

export interface ForumPost {
  id: string;
  channelId: string;
  title: string;
  content: string;
  authorId: string;
  authorName?: string;
  tags: string[];
  pinned: boolean;
  locked: boolean;
  replyCount: number;
  createdAt: string;
  lastReplyAt: string | null;
}

// ---------------------------------------------------------------------------
// Channel Notification Prefs
// ---------------------------------------------------------------------------

export interface ChannelNotificationPref {
  channelId: string;
  level: 'all' | 'mentions' | 'none';
}

// ---------------------------------------------------------------------------
// Read State
// ---------------------------------------------------------------------------

export interface ReadState {
  channelId: string;
  lastReadMessageId: string | null;
  mentionCount: number;
}
