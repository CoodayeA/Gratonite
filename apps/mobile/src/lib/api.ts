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
  Attachment,
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
  FormTemplate,
  FormResponse,
  VoiceEffect,
  VoiceSettings,
  MusicTrack,
  MusicQueue,
  StudySession,
  StudyRoomSettings,
  StudyLeaderboardEntry,
  StageSession,
  Auction,
  AuctionBid,
  SocialConnection,
  InterestTag,
  InterestMatch,
  SeasonalEvent,
  SeasonalEventProgress,
  Clip,
} from '../types';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// For local dev, use your machine's LAN IP (not localhost) so the phone can reach it.
// In production, this should be https://api.gratonite.chat
const DEFAULT_API_BASE = 'https://api.gratonite.chat/api/v1';
let API_BASE = DEFAULT_API_BASE;

export { API_BASE };

export function getApiBase(): string {
  return API_BASE;
}

/**
 * Get the current server configuration.
 */
export async function getServerConfig(): Promise<{ apiBase: string; isCustom: boolean }> {
  try {
    const stored = await SecureStore.getItemAsync('server_api_base');
    if (stored) {
      return { apiBase: stored, isCustom: true };
    }
  } catch { /* ignore */ }
  return { apiBase: DEFAULT_API_BASE, isCustom: false };
}

/**
 * Set a custom server URL. Pass null to reset to official server.
 * Triggers a full reconnect (caller must handle auth refresh).
 */
export async function setServerConfig(apiBaseUrl: string | null): Promise<void> {
  if (apiBaseUrl) {
    // Normalize: ensure it ends with /api/v1
    let normalized = apiBaseUrl.replace(/\/+$/, '');
    if (!normalized.endsWith('/api/v1')) {
      normalized += '/api/v1';
    }
    API_BASE = normalized;
    await SecureStore.setItemAsync('server_api_base', normalized);
  } else {
    API_BASE = DEFAULT_API_BASE;
    await SecureStore.deleteItemAsync('server_api_base');
  }
}

/**
 * Test if a server URL is reachable and is a valid Gratonite instance.
 */
export async function testServerConnection(url: string): Promise<{ ok: boolean; version?: string; error?: string }> {
  try {
    let base = url.replace(/\/+$/, '');
    if (!base.endsWith('/api/v1')) base += '/api/v1';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    const resp = await fetch(`${base}/../health`, { signal: controller.signal });
    clearTimeout(timer);

    if (!resp.ok) return { ok: false, error: `Server responded with ${resp.status}` };

    const data = await resp.json();
    return { ok: true, version: data.version };
  } catch (err) {
    return { ok: false, error: 'Could not reach server' };
  }
}

/**
 * Initialize server config from SecureStore on app startup.
 */
export async function initServerConfig(): Promise<void> {
  try {
    const stored = await SecureStore.getItemAsync('server_api_base');
    if (stored) API_BASE = stored;
  } catch { /* use default */ }
}

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

  if (access) {
    scheduleProactiveRefresh();
  } else {
    cancelProactiveRefresh();
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

let proactiveRefreshTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleProactiveRefresh(): void {
  if (proactiveRefreshTimer) clearTimeout(proactiveRefreshTimer);
  // Refresh 60s before the 15-minute TTL expires
  const refreshInMs = (15 * 60 - 60) * 1000; // 14 minutes
  proactiveRefreshTimer = setTimeout(async () => {
    proactiveRefreshTimer = null;
    if (!accessToken) return;
    const newToken = await refreshAccessToken();
    if (newToken) {
      scheduleProactiveRefresh();
    }
  }, refreshInMs);
}

export function cancelProactiveRefresh(): void {
  if (proactiveRefreshTimer) {
    clearTimeout(proactiveRefreshTimer);
    proactiveRefreshTimer = null;
  }
}

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  const promise = (async () => {
    try {
      if (!refreshToken) {
        return null;
      }
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
      scheduleProactiveRefresh();
      return accessToken;
    } catch {
      accessToken = null;
      return null;
    }
  })();

  refreshPromise = promise;

  promise.finally(() => {
    if (refreshPromise === promise) {
      refreshPromise = null;
    }
  });

  return promise;
}

// ---------------------------------------------------------------------------
// Core fetch wrapper
// ---------------------------------------------------------------------------

const MAX_RATE_LIMIT_RETRIES = 3;

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  retried = false,
  _rateLimitRetry = 0,
): Promise<T> {
  // Auto-reload tokens from SecureStore if wiped (e.g. by hot module reload)
  if (!accessToken) {
    await loadTokens();
  }

  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) ?? {}),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const url = `${API_BASE}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err) {
    // Network error (offline, CORS, DNS failure) — status 0 / TypeError
    throw new ApiRequestError(0, {
      code: 'NETWORK_ERROR',
      message: 'Unable to reach the server. Check your internet connection.',
    });
  }

  if (!res.ok && res.status !== 401) {
    console.warn(`[apiFetch] ${options.method || 'GET'} ${url} → ${res.status}`);
  }

  if (res.status === 429) {
    if (_rateLimitRetry < MAX_RATE_LIMIT_RETRIES) {
      const retryAfter = Number(res.headers.get('Retry-After') || 0);
      const backoffMs = retryAfter > 0 ? retryAfter : 1000 * Math.pow(2, _rateLimitRetry);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      return apiFetch<T>(path, options, retried, _rateLimitRetry + 1);
    }
    const retryAfter = Number(res.headers.get('Retry-After') ?? 5000);
    throw new RateLimitError(retryAfter);
  }

  if (res.status === 401 && !retried) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return apiFetch<T>(path, options, true, _rateLimitRetry);
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

interface KeysetPaginationParams {
  before?: string;
  after?: string;
  around?: string;
  limit?: number;
}

function buildQuery(params?: KeysetPaginationParams): string {
  if (!params) return '';
  const parts: string[] = [];
  if (params.before) parts.push(`before=${params.before}`);
  if (params.after) parts.push(`after=${params.after}`);
  if (params.around) parts.push(`around=${params.around}`);
  if (params.limit) parts.push(`limit=${params.limit}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const auth = {
  register(data: { username: string; email: string; password: string }) {
    return apiFetch<{ email: string }>('/auth/register', {
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

  requestVerifyEmail(email: string) {
    return apiFetch<{ message: string }>('/auth/verify-email/request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  verifyEmailConfirm(token: string) {
    return apiFetch<{ message: string }>('/auth/verify-email/confirm', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },

  forgotPassword(email: string) {
    return apiFetch<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  resetPassword(token: string, password: string) {
    return apiFetch<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
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
    status: raw.status ?? 'offline',
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

  giveFame(userId: string) {
    return apiFetch<{ success: boolean; fameGiven: number; remaining: number }>(`/users/${userId}/fame`, {
      method: 'POST',
    });
  },

  getFame(userId: string) {
    return apiFetch<{ fameReceived: number; fameGiven: number }>(`/users/${userId}/fame`);
  },

  getFameRemaining() {
    return apiFetch<{ remaining: number; used: number }>('/users/@me/fame/remaining');
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

  getMemberRoles(guildId: string, userId: string) {
    return apiFetch<Role[]>(`/guilds/${guildId}/members/${userId}/roles`);
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

  getEncryptionKeys(guildId: string, channelId: string) {
    return apiFetch<{ id: string; channelId: string; version: number; keyData: Record<string, string> }>(
      `/guilds/${guildId}/channels/${channelId}/encryption-keys`,
    );
  },

  create(guildId: string, data: { name: string; type: string; parentId?: string; nsfw?: boolean; slowModeSeconds?: number }) {
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

  updatePositions(guildId: string, updates: Array<{ id: string; position: number; parentId?: string | null }>) {
    return apiFetch<void>(`/guilds/${guildId}/channels/positions`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },
};

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

/** POST /channels/:id/messages body — aligned with web `messagesApi.send`. */
export type MessageSendBody = {
  content?: string | null;
  nonce?: string;
  messageReference?: { messageId: string };
  attachmentIds?: string[];
  replyToId?: string;
  threadId?: string;
  expiresIn?: number;
  isEncrypted?: boolean;
  encryptedContent?: string;
  keyVersion?: number;
  embeds?: Record<string, unknown>[];
  stickerId?: string;
};

export const messages = {
  list(channelId: string, params?: KeysetPaginationParams, signal?: AbortSignal) {
    const qs = buildQuery(params);
    return apiFetch<Message[]>(`/channels/${channelId}/messages${qs}`, { signal });
  },

  send(
    channelId: string,
    contentOrBody: string | (MessageSendBody & { signal?: AbortSignal }),
    maybeOpts?: MessageSendBody & { signal?: AbortSignal },
  ): Promise<Message> {
    let signal: AbortSignal | undefined;
    let body: Record<string, unknown>;
    if (typeof contentOrBody === 'string') {
      const opts = maybeOpts ?? {};
      signal = opts.signal;
      const { signal: _s, ...rest } = opts;
      body = { content: contentOrBody, ...rest };
    } else {
      const { signal: sig, ...rest } = contentOrBody;
      signal = sig;
      body = { ...rest };
    }
    return apiFetch<Message>(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify(body),
      signal,
    });
  },

  edit(
    channelId: string,
    messageId: string,
    contentOrBody: string | { content?: string | null; attachmentIds?: string[] },
  ) {
    return apiFetch<Message>(`/channels/${channelId}/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify(
        typeof contentOrBody === 'string'
          ? { content: contentOrBody }
          : contentOrBody,
      ),
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
      lastMessagePreview:
        ch.lastMessage?.attachments?.length
          ? '[Attachment]'
          : ch.lastMessage?.content ?? null,
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
      lastMessagePreview:
        raw.lastMessage?.attachments?.length
          ? '[Attachment]'
          : raw.lastMessage?.content ?? null,
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
    return apiFetch<{ id: string; url: string; filename?: string; size?: number; mimeType?: string }>('/files/upload', {
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
  messages(params: { q: string; channelId?: string; authorId?: string; limit?: number; offset?: number }) {
    const parts: string[] = [`q=${encodeURIComponent(params.q)}`];
    if (params.channelId) parts.push(`channelId=${params.channelId}`);
    if (params.authorId) parts.push(`authorId=${params.authorId}`);
    if (params.limit) parts.push(`limit=${params.limit}`);
    if (params.offset !== undefined) parts.push(`offset=${params.offset}`);
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

  create(channelId: string, data: { name: string; messageId?: string; body?: string | null; attachmentIds?: string[]; tags?: string[] }) {
    return apiFetch<Thread>(`/channels/${channelId}/threads`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update(threadId: string, data: { name?: string; body?: string | null; attachmentIds?: string[]; tags?: string[] }) {
    return apiFetch<Thread>(`/threads/${threadId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  get(threadId: string) {
    return apiFetch<Thread & { memberCount: number }>(`/threads/${threadId}`);
  },

  getMessages(threadId: string, params?: KeysetPaginationParams) {
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

function normalizeAttachment(raw: any): Attachment {
  return {
    id: raw?.id ?? '',
    messageId: raw?.messageId ?? '',
    filename: raw?.filename ?? 'Attachment',
    contentType: raw?.contentType ?? raw?.mimeType ?? 'application/octet-stream',
    size: Number(raw?.size ?? 0),
    url: raw?.url ?? '',
    width: raw?.width ?? null,
    height: raw?.height ?? null,
  };
}

function normalizeForumPost(raw: any, fallbackChannelId?: string): ForumPost {
  const messageCount = Number(raw?.messageCount ?? raw?.replyCount ?? 0);
  const hasCanonicalMessageCount = raw?.messageCount !== undefined;
  const tags = raw?.tags ?? raw?.forumTagIds ?? [];
  const attachments = Array.isArray(raw?.attachments) ? raw.attachments.map((item: any) => normalizeAttachment(item)) : [];
  const opAttachment = raw?.opAttachment ? normalizeAttachment(raw.opAttachment) : attachments[0] ?? null;
  return {
    id: raw?.id ?? '',
    channelId: raw?.channelId ?? fallbackChannelId ?? '',
    title: raw?.title ?? raw?.name ?? 'Untitled',
    content: raw?.content ?? raw?.opPreview ?? raw?.body ?? '',
    authorId: raw?.authorId ?? raw?.creatorId ?? raw?.author?.id ?? '',
    authorName: raw?.authorName ?? raw?.creatorName ?? raw?.author?.displayName ?? raw?.author?.username,
    tags: Array.isArray(tags) ? tags : [],
    pinned: Boolean(raw?.pinned),
    locked: Boolean(raw?.locked),
    replyCount: hasCanonicalMessageCount ? Math.max(0, messageCount - 1) : messageCount,
    createdAt: raw?.createdAt ?? new Date().toISOString(),
    lastReplyAt: raw?.lastReplyAt ?? raw?.lastActivity ?? raw?.lastMessageAt ?? null,
    attachments,
    opAttachment,
  };
}

async function getAllThreadMessages(threadId: string, pageSize = 100): Promise<Message[]> {
  const newestFirst: Message[] = [];
  const seen = new Set<string>();
  let before: string | undefined;

  while (true) {
    const page = await threads.getMessages(threadId, { limit: pageSize, before });
    if (page.length === 0) break;

    for (const message of page) {
      if (!seen.has(message.id)) {
        seen.add(message.id);
        newestFirst.push(message);
      }
    }

    const oldestLoaded = page[page.length - 1];
    if (page.length < pageSize || !oldestLoaded?.id || oldestLoaded.id === before) break;
    before = oldestLoaded.id;
  }

  return newestFirst.reverse();
}

export const forum = {
  async listPosts(channelId: string) {
    const data = await apiFetch<any[]>(`/channels/${channelId}/threads`);
    return data.map((item) => normalizeForumPost(item, channelId));
  },

  async createPost(channelId: string, data: { title: string; content?: string | null; tags?: string[]; attachmentIds?: string[] }) {
    const thread = await apiFetch<any>(`/channels/${channelId}/threads`, {
      method: 'POST',
      body: JSON.stringify({
        name: data.title,
        body: data.content?.trim() || null,
        tags: data.tags,
        attachmentIds: data.attachmentIds,
      }),
    });
    return normalizeForumPost({ ...thread, content: data.content ?? '', tags: data.tags ?? thread?.forumTagIds }, channelId);
  },

  async updatePost(postId: string, data: { title?: string; content?: string | null; tags?: string[]; attachmentIds?: string[] }) {
    const thread = await threads.update(postId, {
      name: data.title,
      body: data.content,
      tags: data.tags,
      attachmentIds: data.attachmentIds,
    }) as any;
    return normalizeForumPost({ ...thread, content: data.content ?? '', tags: data.tags ?? thread?.forumTagIds });
  },

  async getPost(postId: string) {
    const thread = await threads.get(postId);
    const messages = await getAllThreadMessages(postId).catch(() => []);
    const op = messages[0];
    return normalizeForumPost({
      ...thread,
      content: op?.content ?? '',
      attachments: op?.attachments ?? [],
      messageCount: messages.length,
    });
  },

  async getReplies(postId: string, params?: KeysetPaginationParams) {
    if (params?.before || params?.after || params?.around || params?.limit) {
      const data = await threads.getMessages(postId, params);
      return [...data].reverse();
    }

    const oldestFirst = await getAllThreadMessages(postId);
    return oldestFirst.slice(1);
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

  getGlobal(period?: 'week' | 'month' | 'all') {
    const qs = period ? `?period=${period}` : '';
    return apiFetch<LeaderboardEntry[]>(`/leaderboard${qs}`);
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
    return apiFetch<{ keyVersion: number }>('/users/@me/public-key', {
      method: 'POST',
      body: JSON.stringify({ publicKeyJwk }),
    });
  },

  getPublicKey(userId: string) {
    return apiFetch<{ publicKeyJwk: string | null; keyVersion: number | null }>(`/users/${userId}/public-key`);
  },

  getGroupKey(channelId: string) {
    return apiFetch<{ encryptedKey: string | null; version: number | null }>(`/channels/${channelId}/group-key`);
  },

  setGroupKey(channelId: string, version: number, keyData: Record<string, string>) {
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
    return apiFetch<Cosmetic[]>('/cosmetics/marketplace');
  },

  owned() {
    return apiFetch<Cosmetic[]>('/cosmetics/mine');
  },

  equip(cosmeticId: string) {
    return apiFetch<void>(`/cosmetics/${cosmeticId}/equip`, { method: 'PATCH' });
  },

  unequip(cosmeticId: string) {
    return apiFetch<void>(`/cosmetics/${cosmeticId}/equip`, { method: 'DELETE' });
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

// ---------------------------------------------------------------------------
// Voice Effects
// ---------------------------------------------------------------------------

export const voiceEffects = {
  list() {
    return apiFetch<VoiceEffect[]>('/voice/effects');
  },

  getSettings() {
    return apiFetch<VoiceSettings>('/users/@me/voice-settings');
  },

  updateSettings(data: Partial<VoiceSettings>) {
    return apiFetch<VoiceSettings>('/users/@me/voice-settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};

// ---------------------------------------------------------------------------
// Music Rooms
// ---------------------------------------------------------------------------

export const musicRooms = {
  getState(channelId: string) {
    return apiFetch<MusicQueue>(`/channels/${channelId}/music`);
  },

  addTrack(channelId: string, data: { url: string; title: string; thumbnail?: string; duration?: number }) {
    return apiFetch<MusicTrack>(`/channels/${channelId}/music/queue`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  removeTrack(channelId: string, trackId: string) {
    return apiFetch<void>(`/channels/${channelId}/music/queue/${trackId}`, { method: 'DELETE' });
  },

  skip(channelId: string) {
    return apiFetch<void>(`/channels/${channelId}/music/skip`, { method: 'POST' });
  },

  next(channelId: string) {
    return apiFetch<{ next: MusicTrack | null }>(`/channels/${channelId}/music/next`, { method: 'POST' });
  },

  updateSettings(channelId: string, data: { maxQueueSize?: number; allowDuplicates?: boolean }) {
    return apiFetch<void>(`/channels/${channelId}/music/settings`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};

// ---------------------------------------------------------------------------
// Study Rooms
// ---------------------------------------------------------------------------

export const studyRooms = {
  getSettings(channelId: string) {
    return apiFetch<StudyRoomSettings>(`/channels/${channelId}/study`);
  },

  updateSettings(channelId: string, data: { defaultWorkDuration?: number; defaultBreakDuration?: number }) {
    return apiFetch<void>(`/channels/${channelId}/study/settings`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  start(channelId: string, data: { workDuration: number; breakDuration: number }) {
    return apiFetch<StudySession>(`/channels/${channelId}/study/start`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  end(channelId: string) {
    return apiFetch<void>(`/channels/${channelId}/study/end`, { method: 'POST' });
  },

  leaderboard(guildId: string, period?: string) {
    const qs = period ? `?period=${period}` : '';
    return apiFetch<StudyLeaderboardEntry[]>(`/guilds/${guildId}/study/leaderboard${qs}`);
  },

  stats(guildId: string) {
    return apiFetch<{ totalSessions: number; totalMinutes: number; activeUsers: number }>(`/guilds/${guildId}/study/stats`);
  },
};

// ---------------------------------------------------------------------------
// Stage Channels
// ---------------------------------------------------------------------------

export const stage = {
  getSession(channelId: string) {
    return apiFetch<StageSession | null>(`/channels/${channelId}/stage`);
  },

  start(channelId: string, data: { topic: string }) {
    return apiFetch<StageSession>(`/channels/${channelId}/stage/start`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  end(channelId: string) {
    return apiFetch<void>(`/channels/${channelId}/stage`, { method: 'DELETE' });
  },

  requestSpeak(channelId: string) {
    return apiFetch<void>(`/channels/${channelId}/stage/request-speak`, { method: 'POST' });
  },

  addSpeaker(channelId: string, userId: string) {
    return apiFetch<void>(`/channels/${channelId}/stage/speakers`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  },

  removeSpeaker(channelId: string, userId: string) {
    return apiFetch<void>(`/channels/${channelId}/stage/speakers/${userId}`, { method: 'DELETE' });
  },
};

// ---------------------------------------------------------------------------
// Auctions
// ---------------------------------------------------------------------------

export const auctions = {
  list(filters?: { status?: string; sort?: string }) {
    const parts: string[] = [];
    if (filters?.status) parts.push(`status=${filters.status}`);
    if (filters?.sort) parts.push(`sort=${filters.sort}`);
    const qs = parts.length ? `?${parts.join('&')}` : '';
    return apiFetch<Auction[]>(`/auctions${qs}`);
  },

  get(auctionId: string) {
    return apiFetch<Auction & { bids: AuctionBid[] }>(`/auctions/${auctionId}`);
  },

  create(data: { cosmeticId: string; startingPrice: number; durationHours: number }) {
    return apiFetch<Auction>('/auctions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  bid(auctionId: string, amount: number) {
    return apiFetch<AuctionBid>(`/auctions/${auctionId}/bid`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  },

  cancel(auctionId: string) {
    return apiFetch<void>(`/auctions/${auctionId}`, { method: 'DELETE' });
  },
};

// ---------------------------------------------------------------------------
// Guild Forms
// ---------------------------------------------------------------------------

export const guildForms = {
  list(guildId: string) {
    return apiFetch<FormTemplate[]>(`/guilds/${guildId}/forms`);
  },

  get(guildId: string, formId: string) {
    return apiFetch<FormTemplate>(`/guilds/${guildId}/forms/${formId}`);
  },

  create(guildId: string, data: { title: string; description?: string; fields: Array<{ name: string; type: string; required: boolean }> }) {
    return apiFetch<FormTemplate>(`/guilds/${guildId}/forms`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update(guildId: string, formId: string, data: Partial<FormTemplate>) {
    return apiFetch<FormTemplate>(`/guilds/${guildId}/forms/${formId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  delete(guildId: string, formId: string) {
    return apiFetch<void>(`/guilds/${guildId}/forms/${formId}`, { method: 'DELETE' });
  },

  submit(guildId: string, formId: string, answers: Record<string, unknown>) {
    return apiFetch<FormResponse>(`/guilds/${guildId}/forms/${formId}/responses`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    });
  },

  getResponses(guildId: string, formId: string) {
    return apiFetch<FormResponse[]>(`/guilds/${guildId}/forms/${formId}/responses`);
  },

  reviewResponse(guildId: string, formId: string, responseId: string, data: { status: 'approved' | 'rejected' }) {
    return apiFetch<void>(`/guilds/${guildId}/forms/${formId}/responses/${responseId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },
};

// ---------------------------------------------------------------------------
// Connections (Social Accounts)
// ---------------------------------------------------------------------------

export const connections = {
  list() {
    return apiFetch<SocialConnection[]>('/users/@me/connections');
  },

  add(data: { provider: string; providerUsername: string; profileUrl?: string }) {
    return apiFetch<SocialConnection>('/users/@me/connections', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  remove(provider: string) {
    return apiFetch<void>(`/users/@me/connections/${provider}`, { method: 'DELETE' });
  },

  getForUser(userId: string) {
    return apiFetch<SocialConnection[]>(`/users/${userId}/connections`);
  },
};

// ---------------------------------------------------------------------------
// Interest Tags
// ---------------------------------------------------------------------------

export const interestTags = {
  listAll() {
    return apiFetch<InterestTag[]>('/interest-tags');
  },

  getMyInterests() {
    return apiFetch<string[]>('/users/@me/interests');
  },

  setMyInterests(tags: string[]) {
    return apiFetch<void>('/users/@me/interests', {
      method: 'PUT',
      body: JSON.stringify({ tags }),
    });
  },

  getMatches(guildId: string) {
    return apiFetch<InterestMatch[]>(`/guilds/${guildId}/interest-matches`);
  },
};

// ---------------------------------------------------------------------------
// Seasonal Events
// ---------------------------------------------------------------------------

export const seasonalEvents = {
  getActive() {
    return apiFetch<SeasonalEvent[]>('/events/active');
  },

  getProgress(eventId: string) {
    return apiFetch<SeasonalEventProgress>(`/events/${eventId}/progress`);
  },

  claimMilestone(eventId: string, milestoneId: string) {
    return apiFetch<void>(`/events/${eventId}/claim`, {
      method: 'POST',
      body: JSON.stringify({ milestoneId }),
    });
  },
};

// ---------------------------------------------------------------------------
// Clips
// ---------------------------------------------------------------------------

export const clips = {
  list(guildId: string) {
    return apiFetch<Clip[]>(`/guilds/${guildId}/clips`);
  },

  get(guildId: string, clipId: string) {
    return apiFetch<Clip>(`/guilds/${guildId}/clips/${clipId}`);
  },

  create(guildId: string, data: { channelId: string; title: string; duration: number }) {
    return apiFetch<Clip>(`/guilds/${guildId}/clips`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  delete(guildId: string, clipId: string) {
    return apiFetch<void>(`/guilds/${guildId}/clips/${clipId}`, { method: 'DELETE' });
  },
};
