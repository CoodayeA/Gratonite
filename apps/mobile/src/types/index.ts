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
  badges?: Array<{ id: string; name: string; icon: string; description: string }>;
  mutualFriendCount?: number;
  richPresence?: { type: string; name: string; details?: string; startedAt?: string } | null;
  statusEmoji?: string | null;
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
  slowModeSeconds?: number;
  disappearTimer?: number | null;
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
  attachments?: Attachment[];
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
  isEncrypted?: boolean;
  encryptedContent?: string | null;
  expiresAt?: string | null;
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
  lastMessagePreview?: string | null;
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
  colorMode: string;
  fontFamily: string;
  fontSize: number;
  glassMode: boolean;
  buttonShape: string;
  soundMuted: boolean;
  soundVolume: number;
  soundPack: string;
  reducedMotion: boolean;
  lowPower: boolean;
  highContrast: boolean;
  compactMode: boolean;
  accentColor: string | null;
  // Client-side prefs (stored via notif endpoint, not main settings table)
  pushEnabled?: boolean;
  dmPrivacy?: string;
  friendRequestPrivacy?: string;
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

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------

export interface Reminder {
  id: string;
  userId: string;
  channelId: string;
  messageId: string | null;
  content: string;
  remindAt: string;
  fired: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

export interface LeaderboardEntry {
  userId: string;
  username: string;
  displayName: string | null;
  avatarHash: string | null;
  score: number;
  rank: number;
}

// ---------------------------------------------------------------------------
// Friendship Streaks
// ---------------------------------------------------------------------------

export interface FriendshipStreak {
  friendId: string;
  streak: number;
  lastInteraction: string;
}

// ---------------------------------------------------------------------------
// Giveaways
// ---------------------------------------------------------------------------

export interface Giveaway {
  id: string;
  guildId: string;
  channelId: string;
  title: string;
  description: string | null;
  prize: string;
  winnersCount: number;
  endsAt: string;
  ended: boolean;
  entryCount: number;
  entered: boolean;
  winners: string[];
  creatorId: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Confessions
// ---------------------------------------------------------------------------

export interface Confession {
  id: string;
  guildId: string;
  content: string;
  number: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Greeting Cards
// ---------------------------------------------------------------------------

export interface GreetingCardTemplate {
  id: string;
  name: string;
  imageUrl: string;
  category: string;
}

export interface GreetingCard {
  id: string;
  templateId: string;
  senderId: string;
  recipientId: string;
  message: string;
  template?: GreetingCardTemplate;
  senderName?: string;
  recipientName?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Photo Albums
// ---------------------------------------------------------------------------

export interface PhotoAlbum {
  id: string;
  guildId: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  itemCount: number;
  creatorId: string;
  createdAt: string;
}

export interface PhotoAlbumItem {
  id: string;
  albumId: string;
  imageUrl: string;
  caption: string | null;
  uploaderId: string;
  uploaderName?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------

export interface Ticket {
  id: string;
  guildId: string;
  channelId: string | null;
  subject: string;
  status: 'open' | 'closed';
  priority: 'low' | 'medium' | 'high';
  creatorId: string;
  creatorName?: string;
  assigneeId: string | null;
  assigneeName?: string | null;
  createdAt: string;
  closedAt: string | null;
}

export interface TicketConfig {
  guildId: string;
  enabled: boolean;
  categoryId: string | null;
  welcomeMessage: string | null;
}

// ---------------------------------------------------------------------------
// Starboard
// ---------------------------------------------------------------------------

export interface StarboardConfig {
  guildId: string;
  enabled: boolean;
  channelId: string | null;
  threshold: number;
  emoji: string;
}

export interface StarboardEntry {
  id: string;
  messageId: string;
  channelId: string;
  authorId: string;
  authorName?: string;
  content: string;
  starCount: number;
  starboardMessageId: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

export interface OnboardingStep {
  id: string;
  guildId: string;
  title: string;
  description: string | null;
  type: string;
  required: boolean;
  position: number;
  config: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Showcase
// ---------------------------------------------------------------------------

export interface ShowcaseItem {
  id: string;
  userId: string;
  type: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  position: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Quests
// ---------------------------------------------------------------------------

export interface Quest {
  id: string;
  guildId: string;
  title: string;
  description: string | null;
  type: string;
  goalAmount: number;
  currentAmount: number;
  reward: string | null;
  status: 'active' | 'completed' | 'expired';
  endsAt: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Mood Boards
// ---------------------------------------------------------------------------

export interface MoodBoardItem {
  id: string;
  guildId: string;
  emoji: string;
  text: string;
  color: string | null;
  authorId: string;
  authorName?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export interface TimelineEvent {
  id: string;
  channelId: string;
  title: string;
  description: string | null;
  eventDate: string;
  type: string;
  icon: string | null;
  authorId: string;
  authorName?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Marketplace
// ---------------------------------------------------------------------------

export interface MarketplaceListing {
  id: string;
  sellerId: string;
  sellerName?: string;
  title: string;
  description: string;
  price: number;
  category: string;
  imageUrl: string | null;
  status: 'active' | 'sold' | 'removed';
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

export interface FormTemplate {
  id: string;
  guildId: string;
  title: string;
  description: string | null;
  fields: Array<{ name: string; type: string; required: boolean }>;
  createdAt: string;
}

export interface FormResponse {
  id: string;
  templateId: string;
  userId: string;
  username?: string;
  answers: Record<string, unknown>;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Auto Roles
// ---------------------------------------------------------------------------

export interface AutoRole {
  id: string;
  guildId: string;
  roleId: string;
  roleName?: string;
  trigger: string;
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Reaction Roles
// ---------------------------------------------------------------------------

export interface ReactionRole {
  id: string;
  guildId: string;
  channelId: string;
  messageId: string;
  emoji: string;
  roleId: string;
  roleName?: string;
}

// ---------------------------------------------------------------------------
// Workflows
// ---------------------------------------------------------------------------

export interface Workflow {
  id: string;
  guildId: string;
  name: string;
  description: string | null;
  trigger: string;
  actions: Array<Record<string, unknown>>;
  enabled: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Activity Log
// ---------------------------------------------------------------------------

export interface ActivityLogEvent {
  id: string;
  guildId: string;
  type: string;
  actorId: string;
  actorName?: string;
  description: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Digest Config
// ---------------------------------------------------------------------------

export interface DigestConfig {
  guildId: string;
  enabled: boolean;
  frequency: 'daily' | 'weekly';
  channelId: string | null;
}

// ---------------------------------------------------------------------------
// Sticky Messages
// ---------------------------------------------------------------------------

export interface StickyMessageData {
  id: string;
  channelId: string;
  content: string;
  authorId: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Text Reactions
// ---------------------------------------------------------------------------

export interface TextReaction {
  id: string;
  messageId: string;
  userId: string;
  text: string;
  username?: string;
  createdAt: string;
}

export interface TextReactionGroup {
  text: string;
  count: number;
  userIds: string[];
  me: boolean;
}

// ---------------------------------------------------------------------------
// Guild Bans
// ---------------------------------------------------------------------------

export interface GuildBan {
  userId: string;
  guildId: string;
  reason: string | null;
  bannedBy: string;
  createdAt: string;
  user?: {
    id: string;
    username: string;
    displayName: string | null;
    avatarHash: string | null;
  };
}

// ---------------------------------------------------------------------------
// Automod Rules
// ---------------------------------------------------------------------------

export interface AutomodRule {
  id: string;
  guildId: string;
  name: string;
  type: string;
  enabled: boolean;
  config: Record<string, unknown>;
  actions: Array<{ type: string; config?: Record<string, unknown> }>;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Server Templates
// ---------------------------------------------------------------------------

export interface ServerTemplate {
  id: string;
  guildId: string;
  name: string;
  description: string | null;
  code: string;
  creatorId: string;
  creatorName?: string;
  usageCount: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  earned: boolean;
  earnedAt: string | null;
  progress?: number;
  goal?: number;
}

// ---------------------------------------------------------------------------
// Cosmetics
// ---------------------------------------------------------------------------

export interface Cosmetic {
  id: string;
  name: string;
  description: string;
  type: 'avatar_frame' | 'nameplate' | 'badge';
  imageUrl: string;
  rarity: string;
  equipped: boolean;
  owned: boolean;
  price?: number;
}

// ---------------------------------------------------------------------------
// Activity Feed
// ---------------------------------------------------------------------------

export interface ActivityFeedItem {
  id: string;
  type: string;
  description: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Bot Store
// ---------------------------------------------------------------------------

export interface BotListing {
  id: string;
  name: string;
  description: string;
  iconUrl: string | null;
  category: string;
  tags: string[];
  installCount: number;
  rating: number;
  verified: boolean;
  creatorId: string;
  creatorName?: string;
  createdAt: string;
}

export interface BotReview {
  id: string;
  botId: string;
  userId: string;
  username?: string;
  avatarHash?: string | null;
  rating: number;
  content: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

export interface FeedbackItem {
  id: string;
  userId: string;
  type: 'bug' | 'feature' | 'general';
  content: string;
  status: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Voice Effects
// ---------------------------------------------------------------------------

export interface VoiceEffect {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export interface VoiceSettings {
  activeEffect: string | null;
  effectVolume: number;
}

// ---------------------------------------------------------------------------
// Music Rooms
// ---------------------------------------------------------------------------

export interface MusicTrack {
  id: string;
  title: string;
  thumbnail: string | null;
  duration: number;
  url: string;
  addedBy: string;
  addedByName?: string;
}

export interface MusicQueue {
  settings: { maxQueueSize: number; allowDuplicates: boolean };
  queue: MusicTrack[];
}

// ---------------------------------------------------------------------------
// Study Rooms
// ---------------------------------------------------------------------------

export interface StudySession {
  id: string;
  channelId: string;
  userId: string;
  username?: string;
  phase: 'work' | 'break';
  workDuration: number;
  breakDuration: number;
  startedAt: string;
  totalFocusTime: number;
}

export interface StudyRoomSettings {
  pomodoroWork: number;
  pomodoroBreak: number;
  ambientSound: string | null;
}

export interface StudyLeaderboardEntry {
  userId: string;
  username: string;
  displayName: string | null;
  avatarHash: string | null;
  totalMinutes: number;
  sessionsCompleted: number;
  rank: number;
}

// ---------------------------------------------------------------------------
// Stage Channels
// ---------------------------------------------------------------------------

export interface StageSpeaker {
  userId: string;
  username: string;
  displayName: string | null;
  avatarHash: string | null;
  role: 'host' | 'speaker' | 'audience';
  isSpeaking: boolean;
}

export interface StageSession {
  id: string;
  channelId: string;
  topic: string;
  hostId: string;
  speakers: StageSpeaker[];
  audienceCount: number;
  startedAt: string;
}

// ---------------------------------------------------------------------------
// Auctions
// ---------------------------------------------------------------------------

export interface Auction {
  id: string;
  sellerId: string;
  sellerName?: string;
  cosmeticId: string;
  cosmetic?: { id: string; name: string; imageUrl: string | null; rarity: string };
  startingPrice: number;
  currentBid: number;
  currentBidderId: string | null;
  currentBidderName?: string | null;
  endsAt: string;
  status: 'active' | 'ended' | 'cancelled';
  bidCount: number;
  createdAt: string;
}

export interface AuctionBid {
  id: string;
  auctionId: string;
  bidderId: string;
  bidderName?: string;
  amount: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Connections (Social Accounts)
// ---------------------------------------------------------------------------

export interface SocialConnection {
  id: string;
  provider: 'github' | 'twitch' | 'steam' | 'twitter' | 'youtube';
  providerUsername: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Interest Tags
// ---------------------------------------------------------------------------

export interface InterestTag {
  id: string;
  name: string;
  category: string;
  emoji: string;
}

export interface InterestMatch {
  userId: string;
  username: string;
  displayName: string | null;
  avatarHash: string | null;
  sharedInterests: string[];
}

// ---------------------------------------------------------------------------
// Seasonal Events
// ---------------------------------------------------------------------------

export interface SeasonalEvent {
  id: string;
  name: string;
  themeOverride: string | null;
  bannerColor: string | null;
  emoji: string | null;
  startAt: string;
  endAt: string;
  milestones: Array<{ id: string; name: string; threshold: number; reward: string }>;
}

export interface SeasonalEventProgress {
  eventId: string;
  points: number;
  claimedRewards: string[];
}

// ---------------------------------------------------------------------------
// Clips
// ---------------------------------------------------------------------------

export interface Clip {
  id: string;
  guildId: string;
  channelId: string;
  channelName?: string;
  creatorId: string;
  creatorName?: string;
  title: string;
  url: string;
  duration: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Help Center
// ---------------------------------------------------------------------------

export type HelpCategory =
  | 'All'
  | 'Getting Started'
  | 'Account & Security'
  | 'Portals & Channels'
  | 'Bots & Integrations'
  | 'Billing & Premium'
  | 'Cosmetics & Shop'
  | 'Creator Tools'
  | 'Marketplace & Auctions'
  | 'Messaging & Chat'
  | 'Privacy & Safety';

export interface HelpArticle {
  id: string;
  title: string;
  description: string;
  category: Exclude<HelpCategory, 'All'>;
  body: string[];
}
