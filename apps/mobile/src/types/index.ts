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
