/**
 * API client for Gratonite mobile app.
 * Ported from the web prototype's src/lib/api.ts, adapted for React Native
 * (uses SecureStore instead of localStorage, no cookies).
 */

import * as SecureStore from 'expo-secure-store';
import type {
  AuthResponse,
  Guild,
  Channel,
  Message,
  GuildMember,
  Relationship,
  DMChannel,
  User,
  PresenceStatus,
  ReactionGroup,
  PinnedMessage,
  Role,
  GuildInvite,
  InvitePreview,
  SearchResult,
  Thread,
  ScheduledEvent,
  Poll,
  WikiPage,
  WikiRevision,
  Notification,
  Bookmark,
  Draft,
  ScheduledMessage,
  UserMute,
  Sticker,
  GroupDMChannel,
  UserSettings,
  Session,
  ShopItem,
  InventoryItem,
  WalletInfo,
  LedgerEntry,
  ReadState,
  AuditLogEntry,
  Webhook,
  WordFilter,
  BanAppeal,
  ServerFolder,
  ChannelNotificationPref,
  ForumPost,
  GuildEmoji,
  Reminder,
  LeaderboardEntry,
  FriendshipStreak,
  Giveaway,
  Confession,
  GreetingCardTemplate,
  GreetingCard,
  PhotoAlbum,
  PhotoAlbumItem,
  Ticket,
  TicketConfig,
  StarboardConfig,
  StarboardEntry,
  OnboardingStep,
  ShowcaseItem,
  Quest,
  MoodBoardItem,
  StickyMessageData,
  TimelineEvent,
  MarketplaceListing,
  AutoRole,
  ReactionRole,
  Workflow,
  ActivityLogEvent,
  DigestConfig,
  TextReactionGroup,
  GuildBan,
  AutomodRule,
  ServerTemplate,
  Achievement,
  Cosmetic,
  ActivityFeedItem,
  BotListing,
  BotReview,
  FeedbackItem,
} from '../types';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// For local dev, use your machine's LAN IP (not localhost) so the phone can reach it.
// In production, this should be https://api.gratonite.chat
const API_BASE = 'https://api.gratonite.chat/api/v1';

export { API_BASE };

// ---------------------------------------------------------------------------
// Token management (SecureStore for mobile)
// ---------------------------------------------------------------------------

let accessToken: string | null = null;
let refreshToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

const TOKEN_KEY = 'gratonite_access_token';
const REFRESH_KEY = 'gratonite_refresh_token';

export async function loadTokens(): Promise<void> {
  accessToken = await SecureStore.getItemAsync(TOKEN_KEY);
  refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
}

export async function setTokens(access: string | null, refresh?: string | null): Promise<void> {
  accessToken = access;
  if (refresh !== undefined) refreshToken = refresh;

  if (access) {
    await SecureStore.setItemAsync(TOKEN_KEY, access);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
  if (refresh !== undefined) {
    if (refresh) {
      await SecureStore.setItemAsync(REFRESH_KEY, refresh);
    } else {
      await SecureStore.deleteItemAsync(REFRESH_KEY);
    }
  }
}

export function getAccessToken(): string | null {
  return accessToken;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

export class ApiRequestError extends Error {
  code: string;
  status: number;
  details?: Record<string, string[]>;

  constructor(status: number, body: ApiError) {
    super(body.message);
    this.name = 'ApiRequestError';
    this.code = body.code;
    this.status = status;
    this.details = body.details;
  }
}

export class RateLimitError extends Error {
  retryAfter: number;

  constructor(retryAfter: number) {
    super(`Rate limited. Retry after ${retryAfter}ms`);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      if (!refreshToken) return null;
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        accessToken = null;
        return null;
      }
      const data = (await res.json()) as { accessToken: string; refreshToken?: string };
      accessToken = data.accessToken;
      if (data.refreshToken) {
        refreshToken = data.refreshToken;
        await SecureStore.setItemAsync(REFRESH_KEY, data.refreshToken);
      }
      await SecureStore.setItemAsync(TOKEN_KEY, data.accessToken);
      return accessToken;
    } catch {
      accessToken = null;
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ---------------------------------------------------------------------------
// Core fetch wrapper
// ---------------------------------------------------------------------------

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  retried = false,
): Promise<T> {
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) ?? {}),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('Retry-After') ?? 5000);
    throw new RateLimitError(retryAfter);
  }

  if (res.status === 401 && !retried) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return apiFetch<T>(path, options, true);
    }
    const body = await res.json().catch(() => ({ code: 'UNAUTHORIZED', message: 'Unauthorized' }));
    throw new ApiRequestError(401, body as ApiError);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ApiRequestError(res.status, {
      code: 'PARSE_ERROR',
      message: res.ok
        ? 'Invalid response from server'
        : `Server error (${res.status}). Is the API running?`,
    });
  }

  if (!res.ok) {
    throw new ApiRequestError(res.status, body as ApiError);
  }

  return body as T;
}

// ---------------------------------------------------------------------------
// Query string helper
// ---------------------------------------------------------------------------

interface CursorPaginationParams {
  before?: string;
  after?: string;
  limit?: number;
}

function buildQuery(params?: CursorPaginationParams): string {
  if (!params) return '';
  const parts: string[] = [];
  if (params.before) parts.push(`before=${params.before}`);
  if (params.after) parts.push(`after=${params.after}`);
  if (params.limit) parts.push(`limit=${params.limit}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const auth = {
  register(data: { username: string; email: string; password: string }) {
    return apiFetch<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  login(data: { login: string; password: string; mfaCode?: string }) {
    return apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  logout() {
    return apiFetch<void>('/auth/logout', { method: 'POST' });
  },

  refresh() {
    return refreshAccessToken();
  },

  verifyEmailConfirm(token: string) {
    return apiFetch<{ message: string }>('/auth/verify-email/confirm', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },
};

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

function flattenUserProfile(raw: any): User {
  const profile = raw.profile ?? {};
  return {
    id: raw.id,
    username: raw.username,
    email: raw.email ?? '',
    emailVerified: raw.emailVerified ?? false,
    isAdmin: raw.isAdmin ?? false,
    displayName: profile.displayName ?? raw.displayName ?? null,
    avatarHash: profile.avatarHash ?? raw.avatarHash ?? null,
    bannerHash: profile.bannerHash ?? raw.bannerHash ?? null,
    bio: profile.bio ?? raw.bio ?? null,
    pronouns: profile.pronouns ?? raw.pronouns ?? null,
    status: raw.status ?? 'online',
    customStatus: raw.customStatus ?? null,
  };
}

export const users = {
  async getMe() {
    const raw = await apiFetch<any>('/users/@me');
    return flattenUserProfile(raw);
  },

  async updateMe(data: Partial<Pick<User, 'displayName' | 'bio' | 'pronouns'>>) {
    const raw = await apiFetch<any>('/users/@me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return flattenUserProfile(raw);
  },

  updatePresence(status: PresenceStatus) {
    return apiFetch<void>('/users/@me/presence', {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  async getProfile(userId: string) {
    const raw = await apiFetch<any>(`/users/${userId}/profile`);
    return flattenUserProfile(raw);
  },

  search(query: string) {
    return apiFetch<User[]>(`/users/search?q=${encodeURIComponent(query)}`);
  },

  getBatch(ids: string[]) {
    return apiFetch<Array<{ id: string; username: string; displayName: string | null; avatarHash: string | null }>>(
      `/users?ids=${ids.join(',')}`
    );
  },

  getPresences(ids: string[]) {
    return apiFetch<Array<{ userId: string; status: string }>>(
      `/users/presences?ids=${ids.join(',')}`
    );
  },

  getMutualFriends(userId: string) {
    return apiFetch<Array<{ id: string; username: string; displayName: string | null; avatarHash: string | null }>>(`/users/${userId}/mutual-friends`);
  },

  getMutualGuilds(userId: string) {
    return apiFetch<Array<{ id: string; name: string; iconHash: string | null }>>(`/users/${userId}/mutual-guilds`);
  },
};

// ---------------------------------------------------------------------------
// Guilds
// ---------------------------------------------------------------------------

export const guilds = {
  getMine() {
    return apiFetch<Guild[]>('/guilds/@me');
  },

  get(guildId: string) {
    return apiFetch<Guild>(`/guilds/${guildId}`);
  },

  create(data: { name: string; description?: string }) {
    return apiFetch<Guild>('/guilds', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update(guildId: string, data: Partial<Guild>) {
    return apiFetch<Guild>(`/guilds/${guildId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  delete(guildId: string) {
    return apiFetch<void>(`/guilds/${guildId}`, { method: 'DELETE' });
  },

  leave(guildId: string) {
    return apiFetch<void>(`/guilds/${guildId}/members/@me`, { method: 'DELETE' });
  },

  getMembers(guildId: string) {
    return apiFetch<GuildMember[]>(`/guilds/${guildId}/members`);
  },

  discover() {
    return apiFetch<Guild[]>('/guilds/discover');
  },

  join(guildId: string) {
    return apiFetch<Guild>(`/guilds/${guildId}/join`, { method: 'POST' });
  },
};

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

export const channels = {
  getForGuild(guildId: string) {
    return apiFetch<Channel[]>(`/guilds/${guildId}/channels`);
  },

  get(channelId: string) {
    return apiFetch<Channel>(`/channels/${channelId}`);
  },

  create(guildId: string, data: { name: string; type: string; parentId?: string }) {
    return apiFetch<Channel>(`/guilds/${guildId}/channels`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update(channelId: string, data: Partial<Channel>) {
    return apiFetch<Channel>(`/channels/${channelId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  setDisappearTimer(channelId: string, timer: number | null) {
    return apiFetch<void>(`/channels/${channelId}/messages/disappear-timer`, {
      method: 'PATCH',
      body: JSON.stringify({ disappearTimer: timer }),
    });
  },

  delete(channelId: string) {
    return apiFetch<void>(`/channels/${channelId}`, { method: 'DELETE' });
  },
};

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export const messages = {
  list(channelId: string, params?: CursorPaginationParams) {
    const qs = buildQuery(params);
    return apiFetch<Message[]>(`/channels/${channelId}/messages${qs}`);
  },

  send(channelId: string, content: string, opts?: { replyToId?: string; stickerId?: string; isEncrypted?: boolean; encryptedContent?: string }) {
    return apiFetch<Message>(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, ...opts }),
    });
  },

  edit(channelId: string, messageId: string, content: string) {
    return apiFetch<Message>(`/channels/${channelId}/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    });
  },

  delete(channelId: string, messageId: string) {
    return apiFetch<void>(`/channels/${channelId}/messages/${messageId}`, {
      method: 'DELETE',
    });
  },

  sendTyping(channelId: string) {
    return apiFetch<void>(`/channels/${channelId}/messages/typing`, {
      method: 'POST',
    });
  },
};

// ---------------------------------------------------------------------------
// Relationships (friends, blocks, DMs)
// ---------------------------------------------------------------------------

export const relationships = {
  async getAll() {
    const raw = await apiFetch<any[]>('/relationships');
    return raw.map((r): Relationship => ({
      id: r.id,
      userId: r.user?.id ?? '',
      targetId: r.user?.id ?? '',
      type: (r.type as string).toLowerCase() as Relationship['type'],
      user: r.user ?? undefined,
    }));
  },

  sendFriendRequest(userId: string) {
    return apiFetch<void>('/relationships/friends', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  },

  acceptFriend(userId: string) {
    return apiFetch<void>(`/relationships/friends/${userId}`, { method: 'PUT' });
  },

  removeFriend(userId: string) {
    return apiFetch<void>(`/relationships/friends/${userId}`, { method: 'DELETE' });
  },

  block(userId: string) {
    return apiFetch<void>(`/relationships/blocks/${userId}`, { method: 'PUT' });
  },

  unblock(userId: string) {
    return apiFetch<void>(`/relationships/blocks/${userId}`, { method: 'DELETE' });
  },

  async getDMChannels() {
    const raw = await apiFetch<any[]>('/relationships/channels');
    return raw.map((ch): DMChannel => ({
      id: ch.id,
      recipientId: ch.otherUser?.id ?? '',
      recipient: ch.otherUser ?? undefined,
      lastMessageAt: ch.lastMessage?.createdAt ?? null,
    }));
  },

  async openDM(recipientId: string) {
    const raw = await apiFetch<any>('/relationships/channels', {
      method: 'POST',
      body: JSON.stringify({ userId: recipientId }),
    });
    return {
      id: raw.id,
      recipientId,
      recipient: raw.otherUser ?? undefined,
      lastMessageAt: raw.lastMessage?.createdAt ?? null,
    } as DMChannel;
  },
};

// ---------------------------------------------------------------------------
// Voice
// ---------------------------------------------------------------------------

export const voice = {
  join(channelId: string, selfMute = false, selfDeaf = false) {
    return apiFetch<{ token: string; endpoint: string; voiceState: any }>(
      '/voice/join',
      {
        method: 'POST',
        body: JSON.stringify({ channelId, selfMute, selfDeaf }),
      },
    );
  },

  leave() {
    return apiFetch<void>('/voice/leave', { method: 'POST' });
  },
};

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

export const files = {
  upload(formData: FormData) {
    return apiFetch<{ id: string; url: string }>('/files/upload', {
      method: 'POST',
      body: formData,
    });
  },
};

// ---------------------------------------------------------------------------
// Reactions
// ---------------------------------------------------------------------------

export const reactions = {
  get(channelId: string, messageId: string) {
    return apiFetch<ReactionGroup[]>(
      `/channels/${channelId}/messages/${messageId}/reactions`,
    );
  },

  add(channelId: string, messageId: string, emoji: string) {
    return apiFetch<{ code: string }>(
      `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`,
      { method: 'PUT' },
    );
  },

  remove(channelId: string, messageId: string, emoji: string) {
    return apiFetch<{ code: string }>(
      `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`,
      { method: 'DELETE' },
    );
  },
};

// ---------------------------------------------------------------------------
// Pins
// ---------------------------------------------------------------------------

export const pins = {
  list(channelId: string) {
    return apiFetch<PinnedMessage[]>(`/channels/${channelId}/pins`);
  },

  add(channelId: string, messageId: string) {
    return apiFetch<{ code: string }>(`/channels/${channelId}/pins/${messageId}`, {
      method: 'PUT',
    });
  },

  remove(channelId: string, messageId: string) {
    return apiFetch<{ code: string }>(`/channels/${channelId}/pins/${messageId}`, {
      method: 'DELETE',
    });
  },
};

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export const roles = {
  list(guildId: string) {
    return apiFetch<Role[]>(`/guilds/${guildId}/roles`);
  },

  create(guildId: string, data: { name: string; color?: string; permissions?: string; hoist?: boolean; mentionable?: boolean }) {
    return apiFetch<Role>(`/guilds/${guildId}/roles`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update(guildId: string, roleId: string, data: Partial<Omit<Role, 'id' | 'guildId'>>) {
    return apiFetch<Role>(`/guilds/${guildId}/roles/${roleId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  delete(guildId: string, roleId: string) {
    return apiFetch<{ code: string }>(`/guilds/${guildId}/roles/${roleId}`, {
      method: 'DELETE',
    });
  },

  addToMember(guildId: string, userId: string, roleId: string) {
    return apiFetch<{ code: string }>(
      `/guilds/${guildId}/roles/members/${userId}/roles/${roleId}`,
      { method: 'PUT' },
    );
  },

  removeFromMember(guildId: string, userId: string, roleId: string) {
    return apiFetch<{ code: string }>(
      `/guilds/${guildId}/roles/members/${userId}/roles/${roleId}`,
      { method: 'DELETE' },
    );
  },
};

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------

export const invites = {
  create(guildId: string, data?: { maxUses?: number | null; expiresIn?: number | null; temporary?: boolean }) {
    return apiFetch<GuildInvite>(`/guilds/${guildId}/invites`, {
      method: 'POST',
      body: JSON.stringify(data ?? {}),
    });
  },

  listForGuild(guildId: string) {
    return apiFetch<GuildInvite[]>(`/guilds/${guildId}/invites`);
  },

  preview(code: string) {
    return apiFetch<InvitePreview>(`/invites/${code}`);
  },

  accept(code: string) {
    return apiFetch<{ code: string; guildId: string }>(`/invites/${code}`, {
      method: 'POST',
    });
  },

  revoke(code: string) {
    return apiFetch<{ code: string }>(`/invites/${code}`, {
      method: 'DELETE',
    });
  },
};

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export const search = {
  messages(params: { q: string; channelId?: string; authorId?: string; limit?: number }) {
    const parts: string[] = [`q=${encodeURIComponent(params.q)}`];
    if (params.channelId) parts.push(`channelId=${params.channelId}`);
    if (params.authorId) parts.push(`authorId=${params.authorId}`);
    if (params.limit) parts.push(`limit=${params.limit}`);
    return apiFetch<SearchResult[]>(`/search/messages?${parts.join('&')}`);
  },
};

// ---------------------------------------------------------------------------
// Threads
// ---------------------------------------------------------------------------

export const threads = {
  listForChannel(channelId: string, sort?: 'latest' | 'top') {
    const qs = sort ? `?sort=${sort}` : '';
    return apiFetch<Thread[]>(`/channels/${channelId}/threads${qs}`);
  },

  create(channelId: string, data: { name: string; messageId?: string; body?: string }) {
    return apiFetch<Thread>(`/channels/${channelId}/threads`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  get(threadId: string) {
    return apiFetch<Thread & { memberCount: number }>(`/threads/${threadId}`);
  },

  getMessages(threadId: string, params?: CursorPaginationParams) {
    const qs = buildQuery(params);
    return apiFetch<Message[]>(`/threads/${threadId}/messages${qs}`);
  },
};

// ---------------------------------------------------------------------------
// Scheduled Events
// ---------------------------------------------------------------------------

export const events = {
  list(guildId: string) {
    return apiFetch<ScheduledEvent[]>(`/guilds/${guildId}/scheduled-events`);
  },

  get(guildId: string, eventId: string) {
    return apiFetch<ScheduledEvent>(`/guilds/${guildId}/scheduled-events/${eventId}`);
  },

  create(guildId: string, data: { name: string; description?: string; startTime: string; endTime?: string; location?: string; channelId?: string }) {
    return apiFetch<ScheduledEvent>(`/guilds/${guildId}/scheduled-events`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update(guildId: string, eventId: string, data: Partial<Pick<ScheduledEvent, 'name' | 'description' | 'startTime' | 'endTime' | 'location' | 'status'>>) {
    return apiFetch<ScheduledEvent>(`/guilds/${guildId}/scheduled-events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  delete(guildId: string, eventId: string) {
    return apiFetch<{ code: string }>(`/guilds/${guildId}/scheduled-events/${eventId}`, {
      method: 'DELETE',
    });
  },

  markInterested(guildId: string, eventId: string) {
    return apiFetch<{ code: string; interested: boolean }>(
      `/guilds/${guildId}/scheduled-events/${eventId}/interested`,
      { method: 'PUT' },
    );
  },

  removeInterested(guildId: string, eventId: string) {
    return apiFetch<{ code: string; interested: boolean }>(
      `/guilds/${guildId}/scheduled-events/${eventId}/interested`,
      { method: 'DELETE' },
    );
  },
};

// ---------------------------------------------------------------------------
// Polls
// ---------------------------------------------------------------------------

export const polls = {
  listForChannel(channelId: string) {
    return apiFetch<Poll[]>(`/channels/${channelId}/polls`);
  },

  create(channelId: string, data: { question: string; options: string[]; duration?: number; multiselect?: boolean }) {
    return apiFetch<Poll>(`/channels/${channelId}/polls`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  get(pollId: string) {
    return apiFetch<Poll>(`/polls/${pollId}`);
  },

  vote(pollId: string, optionId: string) {
    return apiFetch<Poll>(`/polls/${pollId}/vote/${optionId}`, {
      method: 'PUT',
    });
  },

  removeVote(pollId: string) {
    return apiFetch<Poll>(`/polls/${pollId}/vote`, {
      method: 'DELETE',
    });
  },

  expire(pollId: string) {
    return apiFetch<Poll>(`/polls/${pollId}/expire`, {
      method: 'POST',
    });
  },

  submitAnswers(pollId: string, optionIds: string[]) {
    return apiFetch<Poll>(`/polls/${pollId}/answers`, {
      method: 'POST',
      body: JSON.stringify({ optionIds }),
    });
  },

  removeAnswers(pollId: string) {
    return apiFetch<{ code: string }>(`/polls/${pollId}/answers/@me`, {
      method: 'DELETE',
    });
  },

  getVoters(pollId: string, optionId: string) {
    return apiFetch<Array<{ id: string; username: string; displayName: string | null; avatarHash: string | null }>>(
      `/polls/${pollId}/answers/${optionId}/voters`,
    );
  },
};

// ---------------------------------------------------------------------------
// Wiki
// ---------------------------------------------------------------------------

export const wiki = {
  listPages(channelId: string) {
    return apiFetch<WikiPage[]>(`/channels/${channelId}/wiki`);
  },

  createPage(channelId: string, data: { title: string; content?: string }) {
    return apiFetch<WikiPage>(`/channels/${channelId}/wiki`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getPage(pageId: string) {
    return apiFetch<WikiPage>(`/wiki/${pageId}`);
  },

  updatePage(pageId: string, data: { title?: string; content?: string }) {
    return apiFetch<WikiPage>(`/wiki/${pageId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  deletePage(pageId: string) {
    return apiFetch<void>(`/wiki/${pageId}`, { method: 'DELETE' });
  },

  getRevisions(pageId: string) {
    return apiFetch<WikiRevision[]>(`/wiki/${pageId}/revisions`);
  },

  revertToRevision(pageId: string, revisionId: string) {
    return apiFetch<WikiPage>(`/wiki/${pageId}/revert/${revisionId}`, {
      method: 'POST',
    });
  },
};

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const notifications = {
  list(limit?: number) {
    const qs = limit ? `?limit=${limit}` : '';
    return apiFetch<Notification[]>(`/notifications${qs}`);
  },

  unreadCount() {
    return apiFetch<{ count: number }>('/notifications/unread-count');
  },

  markRead(notificationId: string) {
    return apiFetch<{ code: string }>(`/notifications/${notificationId}/read`, {
      method: 'POST',
    });
  },

  markAllRead() {
    return apiFetch<{ code: string }>('/notifications/mark-all-read', {
      method: 'POST',
    });
  },

  dismiss(notificationId: string) {
    return apiFetch<{ code: string }>(`/notifications/${notificationId}`, {
      method: 'DELETE',
    });
  },
};

// ---------------------------------------------------------------------------
// Bookmarks
// ---------------------------------------------------------------------------

export const bookmarks = {
  list() {
    return apiFetch<Bookmark[]>('/users/@me/bookmarks');
  },

  create(messageId: string, note?: string) {
    return apiFetch<Bookmark>('/users/@me/bookmarks', {
      method: 'POST',
      body: JSON.stringify({ messageId, note }),
    });
  },

  delete(messageId: string) {
    return apiFetch<void>(`/users/@me/bookmarks/${messageId}`, { method: 'DELETE' });
  },
};

// ---------------------------------------------------------------------------
// Drafts
// ---------------------------------------------------------------------------

export const drafts = {
  get(channelId: string) {
    return apiFetch<Draft | null>(`/drafts/${channelId}`);
  },

  save(channelId: string, content: string) {
    return apiFetch<Draft>('/drafts', {
      method: 'PUT',
      body: JSON.stringify({ channelId, content }),
    });
  },

  delete(channelId: string) {
    return apiFetch<void>(`/drafts/${channelId}`, { method: 'DELETE' });
  },
};

// ---------------------------------------------------------------------------
// Scheduled Messages
// ---------------------------------------------------------------------------

export const scheduledMessages = {
  list(channelId: string) {
    return apiFetch<ScheduledMessage[]>(`/channels/${channelId}/scheduled-messages`);
  },

  create(channelId: string, content: string, scheduledFor: string) {
    return apiFetch<ScheduledMessage>(`/channels/${channelId}/scheduled-messages`, {
      method: 'POST',
      body: JSON.stringify({ content, scheduledFor }),
    });
  },

  delete(messageId: string) {
    return apiFetch<void>(`/scheduled-messages/${messageId}`, { method: 'DELETE' });
  },
};

// ---------------------------------------------------------------------------
// User Mutes
// ---------------------------------------------------------------------------

export const userMutes = {
  list() {
    return apiFetch<UserMute[]>('/users/@me/mutes');
  },

  mute(userId: string) {
    return apiFetch<UserMute>(`/users/@me/mutes/${userId}`, { method: 'PUT' });
  },

  unmute(userId: string) {
    return apiFetch<void>(`/users/@me/mutes/${userId}`, { method: 'DELETE' });
  },
};

// ---------------------------------------------------------------------------
// Stickers
// ---------------------------------------------------------------------------

export const stickers = {
  listForGuild(guildId: string) {
    return apiFetch<Sticker[]>(`/guilds/${guildId}/stickers`);
  },

  create(guildId: string, formData: FormData) {
    return apiFetch<Sticker>(`/guilds/${guildId}/stickers`, {
      method: 'POST',
      body: formData,
    });
  },

  delete(guildId: string, stickerId: string) {
    return apiFetch<void>(`/guilds/${guildId}/stickers/${stickerId}`, { method: 'DELETE' });
  },
};

// ---------------------------------------------------------------------------
// Guild Emojis
// ---------------------------------------------------------------------------

export const guildEmojis = {
  list(guildId: string) {
    return apiFetch<GuildEmoji[]>(`/guilds/${guildId}/emojis`);
  },

  upload(guildId: string, formData: FormData) {
    return apiFetch<GuildEmoji>(`/guilds/${guildId}/emojis`, {
      method: 'POST',
      body: formData,
    });
  },

  delete(guildId: string, emojiId: string) {
    return apiFetch<void>(`/guilds/${guildId}/emojis/${emojiId}`, { method: 'DELETE' });
  },
};

// ---------------------------------------------------------------------------
// Group DMs
// ---------------------------------------------------------------------------

export const groupDms = {
  create(recipientIds: string[], name?: string) {
    return apiFetch<GroupDMChannel>('/relationships/group-channels', {
      method: 'POST',
      body: JSON.stringify({ recipientIds, name }),
    });
  },

  update(channelId: string, data: { name?: string }) {
    return apiFetch<GroupDMChannel>(`/relationships/group-channels/${channelId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  addMember(channelId: string, userId: string) {
    return apiFetch<void>(`/relationships/group-channels/${channelId}/members/${userId}`, {
      method: 'PUT',
    });
  },

  removeMember(channelId: string, userId: string) {
    return apiFetch<void>(`/relationships/group-channels/${channelId}/members/${userId}`, {
      method: 'DELETE',
    });
  },

  leave(channelId: string) {
    return apiFetch<void>(`/relationships/group-channels/${channelId}/members/@me`, {
      method: 'DELETE',
    });
  },
};

// ---------------------------------------------------------------------------
// Moderation
// ---------------------------------------------------------------------------

export const moderation = {
  kick(guildId: string, userId: string, reason?: string) {
    return apiFetch<void>(`/guilds/${guildId}/members/${userId}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    });
  },

  ban(guildId: string, userId: string, reason?: string, deleteMessageDays?: number) {
    return apiFetch<void>(`/guilds/${guildId}/bans/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ reason, deleteMessageDays }),
    });
  },

  unban(guildId: string, userId: string) {
    return apiFetch<void>(`/guilds/${guildId}/bans/${userId}`, { method: 'DELETE' });
  },

  timeout(guildId: string, userId: string, duration: number, reason?: string) {
    return apiFetch<void>(`/guilds/${guildId}/members/${userId}/timeout`, {
      method: 'POST',
      body: JSON.stringify({ duration, reason }),
    });
  },

  warn(guildId: string, userId: string, reason: string) {
    return apiFetch<void>(`/guilds/${guildId}/members/${userId}/warn`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  getAuditLog(guildId: string, limit?: number) {
    const qs = limit ? `?limit=${limit}` : '';
    return apiFetch<AuditLogEntry[]>(`/guilds/${guildId}/audit-log${qs}`);
  },

  getBanAppeals(guildId: string) {
    return apiFetch<BanAppeal[]>(`/guilds/${guildId}/ban-appeals`);
  },

  reviewBanAppeal(guildId: string, appealId: string, status: 'accepted' | 'rejected') {
    return apiFetch<BanAppeal>(`/guilds/${guildId}/ban-appeals/${appealId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },
};

// ---------------------------------------------------------------------------
// Channel Notification Overrides
// ---------------------------------------------------------------------------

export const channelOverrides = {
  list() {
    return apiFetch<ChannelNotificationPref[]>('/users/@me/channel-notification-prefs');
  },

  set(channelId: string, level: 'all' | 'mentions' | 'none') {
    return apiFetch<ChannelNotificationPref>(`/users/@me/channel-notification-prefs/${channelId}`, {
      method: 'PUT',
      body: JSON.stringify({ level }),
    });
  },

  delete(channelId: string) {
    return apiFetch<void>(`/users/@me/channel-notification-prefs/${channelId}`, {
      method: 'DELETE',
    });
  },
};

// ---------------------------------------------------------------------------
// User Settings
// ---------------------------------------------------------------------------

export const userSettings = {
  get() {
    return apiFetch<UserSettings>('/users/@me/settings');
  },

  update(data: Partial<UserSettings>) {
    return apiFetch<UserSettings>('/users/@me/settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async getSessions() {
    const rt = await SecureStore.getItemAsync(REFRESH_KEY);
    return apiFetch<Session[]>('/auth/sessions', {
      headers: rt ? { 'X-Refresh-Token': rt } : {},
    });
  },

  async logoutSession(sessionId: string) {
    const rt = await SecureStore.getItemAsync(REFRESH_KEY);
    return apiFetch<void>(`/auth/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: rt ? { 'X-Refresh-Token': rt } : {},
    });
  },

  async logoutAllSessions() {
    const rt = await SecureStore.getItemAsync(REFRESH_KEY);
    return apiFetch<void>('/auth/sessions', {
      method: 'DELETE',
      headers: rt ? { 'X-Refresh-Token': rt } : {},
    });
  },
};

// ---------------------------------------------------------------------------
// Push Notifications
// ---------------------------------------------------------------------------

export const push = {
  register(token: string, platform: string) {
    return apiFetch<{ code: string }>('/push/register', {
      method: 'POST',
      body: JSON.stringify({ token, platform }),
    });
  },

  unregister(token: string) {
    return apiFetch<void>('/push/unregister', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },
};

// ---------------------------------------------------------------------------
// Economy / Shop
// ---------------------------------------------------------------------------

export const economy = {
  getWallet() {
    return apiFetch<WalletInfo>('/economy/wallet');
  },

  claimDaily() {
    return apiFetch<{ amount: number; balance: number }>('/economy/claim-daily', {
      method: 'POST',
    });
  },

  getLedger(limit?: number) {
    const qs = limit ? `?limit=${limit}` : '';
    return apiFetch<LedgerEntry[]>(`/economy/ledger${qs}`);
  },
};

export const shop = {
  list() {
    return apiFetch<ShopItem[]>('/shop');
  },

  purchase(itemId: string) {
    return apiFetch<InventoryItem>(`/shop/${itemId}/purchase`, { method: 'POST' });
  },

  getInventory() {
    return apiFetch<InventoryItem[]>('/shop/inventory');
  },

  equip(inventoryItemId: string) {
    return apiFetch<void>(`/shop/inventory/${inventoryItemId}/equip`, { method: 'POST' });
  },

  unequip(inventoryItemId: string) {
    return apiFetch<void>(`/shop/inventory/${inventoryItemId}/unequip`, { method: 'POST' });
  },
};

// ---------------------------------------------------------------------------
// Read State
// ---------------------------------------------------------------------------

export const readState = {
  getAll() {
    return apiFetch<ReadState[]>('/users/@me/read-states');
  },

  ack(channelId: string, messageId: string) {
    return apiFetch<void>(`/users/@me/read-states/${channelId}/ack`, {
      method: 'POST',
      body: JSON.stringify({ messageId }),
    });
  },
};

// ---------------------------------------------------------------------------
// User Notes
// ---------------------------------------------------------------------------

export const userNotes = {
  get(userId: string) {
    return apiFetch<{ note: string }>(`/users/${userId}/notes`);
  },

  set(userId: string, note: string) {
    return apiFetch<void>(`/users/${userId}/notes`, {
      method: 'PUT',
      body: JSON.stringify({ note }),
    });
  },
};

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

export const webhooks = {
  listForGuild(guildId: string) {
    return apiFetch<Webhook[]>(`/guilds/${guildId}/webhooks`);
  },

  create(guildId: string, data: { name: string; channelId: string }) {
    return apiFetch<Webhook>(`/guilds/${guildId}/webhooks`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update(webhookId: string, data: { name?: string; channelId?: string }) {
    return apiFetch<Webhook>(`/webhooks/${webhookId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  delete(webhookId: string) {
    return apiFetch<void>(`/webhooks/${webhookId}`, { method: 'DELETE' });
  },
};

// ---------------------------------------------------------------------------
// Word Filter
// ---------------------------------------------------------------------------

export const wordFilter = {
  list(guildId: string) {
    return apiFetch<WordFilter[]>(`/guilds/${guildId}/word-filter`);
  },

  add(guildId: string, word: string, action: 'block' | 'delete' | 'warn') {
    return apiFetch<WordFilter>(`/guilds/${guildId}/word-filter`, {
      method: 'POST',
      body: JSON.stringify({ word, action }),
    });
  },

  remove(guildId: string, filterId: string) {
    return apiFetch<void>(`/guilds/${guildId}/word-filter/${filterId}`, {
      method: 'DELETE',
    });
  },
};

// ---------------------------------------------------------------------------
// Server Folders
// ---------------------------------------------------------------------------

export const serverFolders = {
  list() {
    return apiFetch<ServerFolder[]>('/users/@me/server-folders');
  },

  create(data: { name: string; guildIds: string[]; color?: string }) {
    return apiFetch<ServerFolder>('/users/@me/server-folders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update(folderId: string, data: Partial<Pick<ServerFolder, 'name' | 'color' | 'guildIds' | 'position'>>) {
    return apiFetch<ServerFolder>(`/users/@me/server-folders/${folderId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  delete(folderId: string) {
    return apiFetch<void>(`/users/@me/server-folders/${folderId}`, { method: 'DELETE' });
  },
};

// ---------------------------------------------------------------------------
// Forum
// ---------------------------------------------------------------------------

export const forum = {
  listPosts(channelId: string) {
    return apiFetch<ForumPost[]>(`/channels/${channelId}/forum-posts`);
  },

  createPost(channelId: string, data: { title: string; content: string; tags?: string[] }) {
    return apiFetch<ForumPost>(`/channels/${channelId}/forum-posts`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getPost(postId: string) {
    return apiFetch<ForumPost>(`/forum-posts/${postId}`);
  },

  getReplies(postId: string, params?: CursorPaginationParams) {
    const qs = buildQuery(params);
    return apiFetch<Message[]>(`/forum-posts/${postId}/replies${qs}`);
  },
};

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------

export const reminders = {
  list() {
    return apiFetch<Reminder[]>('/reminders');
  },

  create(data: { channelId: string; messageId?: string; content: string; remindAt: string }) {
    return apiFetch<Reminder>('/reminders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  delete(reminderId: string) {
    return apiFetch<void>(`/reminders/${reminderId}`, { method: 'DELETE' });
  },
};

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

export const leaderboard = {
  get(guildId: string, period?: 'week' | 'month' | 'all') {
    const qs = period ? `?period=${period}` : '';
    return apiFetch<LeaderboardEntry[]>(`/guilds/${guildId}/leaderboard${qs}`);
  },
};

// ---------------------------------------------------------------------------
// Friendship Streaks
// ---------------------------------------------------------------------------

export const friendshipStreaks = {
  get(friendId: string) {
    return apiFetch<FriendshipStreak>(`/relationships/${friendId}/streak`);
  },

  getAll() {
    return apiFetch<FriendshipStreak[]>('/relationships/streaks');
  },
};

// ---------------------------------------------------------------------------
// Giveaways
// ---------------------------------------------------------------------------

export const giveaways = {
  list(guildId: string) {
    return apiFetch<Giveaway[]>(`/guilds/${guildId}/giveaways`);
  },

  get(guildId: string, giveawayId: string) {
    return apiFetch<Giveaway>(`/guilds/${guildId}/giveaways/${giveawayId}`);
  },

  create(guildId: string, data: { title: string; description?: string; prize: string; winnersCount?: number; endsAt: string; channelId: string }) {
    return apiFetch<Giveaway>(`/guilds/${guildId}/giveaways`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  enter(guildId: string, giveawayId: string) {
    return apiFetch<{ entered: boolean }>(`/guilds/${guildId}/giveaways/${giveawayId}/enter`, {
      method: 'POST',
    });
  },

  draw(guildId: string, giveawayId: string) {
    return apiFetch<Giveaway>(`/guilds/${guildId}/giveaways/${giveawayId}/draw`, {
      method: 'POST',
    });
  },

  delete(guildId: string, giveawayId: string) {
    return apiFetch<void>(`/guilds/${guildId}/giveaways/${giveawayId}`, { method: 'DELETE' });
  },
};

// ---------------------------------------------------------------------------
// Confessions
// ---------------------------------------------------------------------------

export const confessions = {
  list(guildId: string) {
    return apiFetch<Confession[]>(`/guilds/${guildId}/confessions`);
  },

  create(guildId: string, content: string) {
    return apiFetch<Confession>(`/guilds/${guildId}/confessions`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },
};

// ---------------------------------------------------------------------------
// Greeting Cards
// ---------------------------------------------------------------------------

export const greetingCards = {
  getTemplates() {
    return apiFetch<GreetingCardTemplate[]>('/greeting-cards/templates');
  },

  send(data: { templateId: string; recipientId: string; message: string }) {
    return apiFetch<GreetingCard>('/greeting-cards', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getReceived() {
    return apiFetch<GreetingCard[]>('/greeting-cards/received');
  },

  getSent() {
    return apiFetch<GreetingCard[]>('/greeting-cards/sent');
  },
};

// ---------------------------------------------------------------------------
// Photo Albums
// ---------------------------------------------------------------------------

export const photoAlbums = {
  list(guildId: string) {
    return apiFetch<PhotoAlbum[]>(`/guilds/${guildId}/albums`);
  },

  create(guildId: string, data: { name: string; description?: string }) {
    return apiFetch<PhotoAlbum>(`/guilds/${guildId}/albums`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getItems(guildId: string, albumId: string) {
    return apiFetch<PhotoAlbumItem[]>(`/guilds/${guildId}/albums/${albumId}/items`);
  },

  addItem(guildId: string, albumId: string, formData: FormData) {
    return apiFetch<PhotoAlbumItem>(`/guilds/${guildId}/albums/${albumId}/items`, {
      method: 'POST',
      body: formData,
    });
  },

  deleteItem(guildId: string, albumId: string, itemId: string) {
    return apiFetch<void>(`/guilds/${guildId}/albums/${albumId}/items/${itemId}`, { method: 'DELETE' });
  },

  delete(guildId: string, albumId: string) {
    return apiFetch<void>(`/guilds/${guildId}/albums/${albumId}`, { method: 'DELETE' });
  },
};

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------

export const tickets = {
  list(guildId: string, status?: 'open' | 'closed') {
    const qs = status ? `?status=${status}` : '';
    return apiFetch<Ticket[]>(`/guilds/${guildId}/tickets${qs}`);
  },

  create(guildId: string, data: { subject: string; priority?: string }) {
    return apiFetch<Ticket>(`/guilds/${guildId}/tickets`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  close(guildId: string, ticketId: string) {
    return apiFetch<Ticket>(`/guilds/${guildId}/tickets/${ticketId}/close`, { method: 'POST' });
  },

  reopen(guildId: string, ticketId: string) {
    return apiFetch<Ticket>(`/guilds/${guildId}/tickets/${ticketId}/reopen`, { method: 'POST' });
  },

  getConfig(guildId: string) {
    return apiFetch<TicketConfig>(`/guilds/${guildId}/tickets/config`);
  },

  updateConfig(guildId: string, data: Partial<TicketConfig>) {
    return apiFetch<TicketConfig>(`/guilds/${guildId}/tickets/config`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
};

// ---------------------------------------------------------------------------
// Starboard
// ---------------------------------------------------------------------------

export const starboard = {
  getConfig(guildId: string) {
    return apiFetch<StarboardConfig>(`/guilds/${guildId}/starboard/config`);
  },

  updateConfig(guildId: string, data: Partial<StarboardConfig>) {
    return apiFetch<StarboardConfig>(`/guilds/${guildId}/starboard/config`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  getEntries(guildId: string) {
    return apiFetch<StarboardEntry[]>(`/guilds/${guildId}/starboard`);
  },
};

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------

export const onboarding = {
  getSteps(guildId: string) {
    return apiFetch<OnboardingStep[]>(`/guilds/${guildId}/onboarding`);
  },

  updateSteps(guildId: string, steps: Partial<OnboardingStep>[]) {
    return apiFetch<OnboardingStep[]>(`/guilds/${guildId}/onboarding`, {
      method: 'PUT',
      body: JSON.stringify({ steps }),
    });
  },

  complete(guildId: string) {
    return apiFetch<void>(`/guilds/${guildId}/onboarding/complete`, { method: 'POST' });
  },
};

// ---------------------------------------------------------------------------
// Showcase
// ---------------------------------------------------------------------------

export const showcase = {
  get(userId: string) {
    return apiFetch<ShowcaseItem[]>(`/users/${userId}/showcase`);
  },

  update(items: Partial<ShowcaseItem>[]) {
    return apiFetch<ShowcaseItem[]>('/users/@me/showcase', {
      method: 'PUT',
      body: JSON.stringify({ items }),
    });
  },
};

// ---------------------------------------------------------------------------
// Quests
// ---------------------------------------------------------------------------

export const quests = {
  list(guildId: string) {
    return apiFetch<Quest[]>(`/guilds/${guildId}/quests`);
  },

  create(guildId: string, data: { title: string; description?: string; type: string; goalAmount: number; reward?: string; endsAt?: string }) {
    return apiFetch<Quest>(`/guilds/${guildId}/quests`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  contribute(guildId: string, questId: string, amount?: number) {
    return apiFetch<Quest>(`/guilds/${guildId}/quests/${questId}/contribute`, {
      method: 'POST',
      body: JSON.stringify({ amount: amount ?? 1 }),
    });
  },

  delete(guildId: string, questId: string) {
    return apiFetch<void>(`/guilds/${guildId}/quests/${questId}`, { method: 'DELETE' });
  },
};

// ---------------------------------------------------------------------------
// Mood Boards
// ---------------------------------------------------------------------------

export const moodBoards = {
  list(guildId: string) {
    return apiFetch<MoodBoardItem[]>(`/guilds/${guildId}/mood-boards`);
  },

  create(guildId: string, data: { emoji: string; text: string; color?: string }) {
    return apiFetch<MoodBoardItem>(`/guilds/${guildId}/mood-boards`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  delete(guildId: string, itemId: string) {
    return apiFetch<void>(`/guilds/${guildId}/mood-boards/${itemId}`, { method: 'DELETE' });
  },
};

// ---------------------------------------------------------------------------
// Sticky Messages
// ---------------------------------------------------------------------------

export const stickyMessages = {
  get(channelId: string) {
    return apiFetch<StickyMessageData | null>(`/channels/${channelId}/sticky`);
  },

  set(channelId: string, content: string) {
    return apiFetch<StickyMessageData>(`/channels/${channelId}/sticky`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
  },

  remove(channelId: string) {
    return apiFetch<void>(`/channels/${channelId}/sticky`, { method: 'DELETE' });
  },
};

// ---------------------------------------------------------------------------
// Digest
// ---------------------------------------------------------------------------

export const digest = {
  getConfig(guildId: string) {
    return apiFetch<DigestConfig>(`/guilds/${guildId}/digest/config`);
  },

  updateConfig(guildId: string, data: Partial<DigestConfig>) {
    return apiFetch<DigestConfig>(`/guilds/${guildId}/digest/config`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
};

// ---------------------------------------------------------------------------
// Activity Log
// ---------------------------------------------------------------------------

export const activityLog = {
  list(guildId: string, limit?: number, before?: string) {
    const parts: string[] = [];
    if (limit) parts.push(`limit=${limit}`);
    if (before) parts.push(`before=${before}`);
    const qs = parts.length ? `?${parts.join('&')}` : '';
    return apiFetch<ActivityLogEvent[]>(`/guilds/${guildId}/activity-log${qs}`);
  },
};

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export const timeline = {
  list(channelId: string) {
    return apiFetch<TimelineEvent[]>(`/channels/${channelId}/timeline`);
  },

  create(channelId: string, data: { title: string; description?: string; eventDate: string; type?: string }) {
    return apiFetch<TimelineEvent>(`/channels/${channelId}/timeline`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  delete(channelId: string, eventId: string) {
    return apiFetch<void>(`/channels/${channelId}/timeline/${eventId}`, { method: 'DELETE' });
  },
};

// ---------------------------------------------------------------------------
// Marketplace
// ---------------------------------------------------------------------------

export const marketplace = {
  list(category?: string) {
    const qs = category ? `?category=${encodeURIComponent(category)}` : '';
    return apiFetch<MarketplaceListing[]>(`/marketplace/listings${qs}`);
  },

  get(listingId: string) {
    return apiFetch<MarketplaceListing>(`/marketplace/listings/${listingId}`);
  },

  create(data: { title: string; description: string; price: number; category: string }) {
    return apiFetch<MarketplaceListing>('/marketplace/listings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  purchase(listingId: string) {
    return apiFetch<{ success: boolean }>(`/marketplace/listings/${listingId}/purchase`, {
      method: 'POST',
    });
  },

  delete(listingId: string) {
    return apiFetch<void>(`/marketplace/listings/${listingId}`, { method: 'DELETE' });
  },
};

// ---------------------------------------------------------------------------
// Auto Roles
// ---------------------------------------------------------------------------

export const autoRoles = {
  list(guildId: string) {
    return apiFetch<AutoRole[]>(`/guilds/${guildId}/auto-roles`);
  },

  create(guildId: string, data: { roleId: string; trigger: string }) {
    return apiFetch<AutoRole>(`/guilds/${guildId}/auto-roles`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update(guildId: string, autoRoleId: string, data: { enabled?: boolean }) {
    return apiFetch<AutoRole>(`/guilds/${guildId}/auto-roles/${autoRoleId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  delete(guildId: string, autoRoleId: string) {
    return apiFetch<void>(`/guilds/${guildId}/auto-roles/${autoRoleId}`, { method: 'DELETE' });
  },
};

// ---------------------------------------------------------------------------
// Reaction Roles
// ---------------------------------------------------------------------------

export const reactionRoles = {
  list(guildId: string) {
    return apiFetch<ReactionRole[]>(`/guilds/${guildId}/reaction-roles`);
  },

  create(guildId: string, data: { channelId: string; messageId: string; emoji: string; roleId: string }) {
    return apiFetch<ReactionRole>(`/guilds/${guildId}/reaction-roles`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  delete(guildId: string, reactionRoleId: string) {
    return apiFetch<void>(`/guilds/${guildId}/reaction-roles/${reactionRoleId}`, { method: 'DELETE' });
  },
};

// ---------------------------------------------------------------------------
// Workflows
// ---------------------------------------------------------------------------

export const workflows = {
  list(guildId: string) {
    return apiFetch<Workflow[]>(`/guilds/${guildId}/workflows`);
  },

  get(guildId: string, workflowId: string) {
    return apiFetch<Workflow>(`/guilds/${guildId}/workflows/${workflowId}`);
  },

  update(guildId: string, workflowId: string, data: { enabled?: boolean }) {
    return apiFetch<Workflow>(`/guilds/${guildId}/workflows/${workflowId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
};

// ---------------------------------------------------------------------------
// Translation
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Encryption
// ---------------------------------------------------------------------------

export const encryption = {
  uploadPublicKey(publicKeyJwk: string) {
    return apiFetch<void>('/users/@me/public-key', {
      method: 'POST',
      body: JSON.stringify({ publicKey: publicKeyJwk }),
    });
  },

  getPublicKey(userId: string) {
    return apiFetch<{ publicKey: string | null }>(`/users/${userId}/public-key`);
  },

  getGroupKey(channelId: string) {
    return apiFetch<{ keyData: string | null; version: number | null }>(`/channels/${channelId}/group-key`);
  },

  setGroupKey(channelId: string, version: number, keyData: string) {
    return apiFetch<void>(`/channels/${channelId}/group-key`, {
      method: 'POST',
      body: JSON.stringify({ version, keyData }),
    });
  },
};

export const translation = {
  translate(channelId: string, messageId: string, targetLang?: string) {
    return apiFetch<{ translatedContent: string; detectedLanguage: string; targetLanguage: string }>(
      `/channels/${channelId}/messages/${messageId}/translate`,
      {
        method: 'POST',
        body: JSON.stringify({ targetLang }),
      },
    );
  },
};

// ---------------------------------------------------------------------------
// Text Reactions
// ---------------------------------------------------------------------------

export const textReactions = {
  list(channelId: string, messageId: string) {
    return apiFetch<TextReactionGroup[]>(`/channels/${channelId}/messages/${messageId}/text-reactions`);
  },

  add(channelId: string, messageId: string, text: string) {
    return apiFetch<void>(`/channels/${channelId}/messages/${messageId}/text-reactions`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  },

  remove(channelId: string, messageId: string, text: string) {
    return apiFetch<void>(`/channels/${channelId}/messages/${messageId}/text-reactions/${encodeURIComponent(text)}`, {
      method: 'DELETE',
    });
  },
};

// ---------------------------------------------------------------------------
// Guild Bans
// ---------------------------------------------------------------------------

export const bans = {
  list(guildId: string) {
    return apiFetch<GuildBan[]>(`/guilds/${guildId}/bans`);
  },

  unban(guildId: string, userId: string) {
    return apiFetch<void>(`/guilds/${guildId}/bans/${userId}`, { method: 'DELETE' });
  },
};

// ---------------------------------------------------------------------------
// Automod
// ---------------------------------------------------------------------------

export const automod = {
  listRules(guildId: string) {
    return apiFetch<AutomodRule[]>(`/guilds/${guildId}/automod/rules`);
  },

  createRule(guildId: string, data: { name: string; type: string; config: Record<string, unknown>; actions: Array<{ type: string; config?: Record<string, unknown> }> }) {
    return apiFetch<AutomodRule>(`/guilds/${guildId}/automod/rules`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateRule(guildId: string, ruleId: string, data: Partial<AutomodRule>) {
    return apiFetch<AutomodRule>(`/guilds/${guildId}/automod/rules/${ruleId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  deleteRule(guildId: string, ruleId: string) {
    return apiFetch<void>(`/guilds/${guildId}/automod/rules/${ruleId}`, { method: 'DELETE' });
  },
};

// ---------------------------------------------------------------------------
// Server Templates
// ---------------------------------------------------------------------------

export const templates = {
  list(guildId: string) {
    return apiFetch<ServerTemplate[]>(`/guilds/${guildId}/templates`);
  },

  create(guildId: string, data: { name: string; description?: string }) {
    return apiFetch<ServerTemplate>(`/guilds/${guildId}/templates`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  preview(code: string) {
    return apiFetch<{ template: ServerTemplate; guild: Guild }>(`/templates/${code}`);
  },

  createFromTemplate(code: string, name: string) {
    return apiFetch<Guild>(`/templates/${code}/create`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  delete(guildId: string, templateId: string) {
    return apiFetch<void>(`/guilds/${guildId}/templates/${templateId}`, { method: 'DELETE' });
  },
};

// ---------------------------------------------------------------------------
// MFA (Two-Factor Authentication)
// ---------------------------------------------------------------------------

export const mfa = {
  status() {
    return apiFetch<{ enabled: boolean }>('/auth/mfa/status');
  },

  setupStart() {
    return apiFetch<{ secret: string; otpauthUrl: string }>('/auth/mfa/setup', { method: 'POST' });
  },

  enable(code: string) {
    return apiFetch<{ backupCodes: string[] }>('/auth/mfa/enable', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },

  disable(password: string, code: string) {
    return apiFetch<void>('/auth/mfa/disable', {
      method: 'POST',
      body: JSON.stringify({ password, code }),
    });
  },
};

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

export const achievements = {
  list() {
    return apiFetch<Achievement[]>('/users/@me/achievements');
  },
};

// ---------------------------------------------------------------------------
// Cosmetics (Wardrobe)
// ---------------------------------------------------------------------------

export const cosmetics = {
  catalog() {
    return apiFetch<Cosmetic[]>('/cosmetics/catalog');
  },

  owned() {
    return apiFetch<Cosmetic[]>('/cosmetics/owned');
  },

  equip(cosmeticId: string) {
    return apiFetch<void>(`/cosmetics/${cosmeticId}/equip`, { method: 'POST' });
  },

  unequip(cosmeticId: string) {
    return apiFetch<void>(`/cosmetics/${cosmeticId}/unequip`, { method: 'POST' });
  },
};

// ---------------------------------------------------------------------------
// Activity Feed
// ---------------------------------------------------------------------------

export const activityFeed = {
  list(cursor?: string) {
    const qs = cursor ? `?cursor=${cursor}` : '';
    return apiFetch<{ items: ActivityFeedItem[]; nextCursor: string | null }>(`/users/@me/activity${qs}`);
  },
};

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

export const feedback = {
  submit(data: { type: 'bug' | 'feature' | 'general'; content: string }) {
    return apiFetch<FeedbackItem>('/feedback', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  mine() {
    return apiFetch<FeedbackItem[]>('/feedback/mine');
  },
};

// ---------------------------------------------------------------------------
// Platform Stats
// ---------------------------------------------------------------------------

export const stats = {
  public() {
    return apiFetch<{ totalUsers: number; totalGuilds: number; totalMessages: number; onlineNow: number }>('/stats/public');
  },
};

// ---------------------------------------------------------------------------
// Bot Store
// ---------------------------------------------------------------------------

export const botStore = {
  list(category?: string, search?: string) {
    const parts: string[] = [];
    if (category) parts.push(`category=${encodeURIComponent(category)}`);
    if (search) parts.push(`search=${encodeURIComponent(search)}`);
    const qs = parts.length ? `?${parts.join('&')}` : '';
    return apiFetch<BotListing[]>(`/bot-store${qs}`);
  },

  get(botId: string) {
    return apiFetch<BotListing>(`/bot-store/${botId}`);
  },

  getReviews(botId: string) {
    return apiFetch<BotReview[]>(`/bot-store/${botId}/reviews`);
  },

  postReview(botId: string, data: { rating: number; content: string }) {
    return apiFetch<BotReview>(`/bot-store/${botId}/reviews`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  install(botId: string, guildId: string) {
    return apiFetch<{ success: boolean }>(`/bot-store/${botId}/install`, {
      method: 'POST',
      body: JSON.stringify({ guildId }),
    });
  },
};
