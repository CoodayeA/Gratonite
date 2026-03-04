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
} from '../types';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// For local dev, use your machine's LAN IP (not localhost) so the phone can reach it.
// In production, this should be https://api.gratonite.chat
const API_BASE = __DEV__
  ? 'http://192.168.68.103:4000/api/v1'  // Change to your LAN IP
  : 'https://api.gratonite.chat/api/v1';

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

export const users = {
  getMe() {
    return apiFetch<User>('/users/@me');
  },

  updateMe(data: Partial<Pick<User, 'displayName' | 'bio' | 'pronouns'>>) {
    return apiFetch<User>('/users/@me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  updatePresence(status: PresenceStatus) {
    return apiFetch<void>('/users/@me/presence', {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  getProfile(userId: string) {
    return apiFetch<User>(`/users/${userId}/profile`);
  },

  search(query: string) {
    return apiFetch<User[]>(`/users/search?q=${encodeURIComponent(query)}`);
  },

  getBatch(ids: string[]) {
    return apiFetch<Array<{ id: string; username: string; displayName: string | null; avatarHash: string | null }>>(
      `/users?ids=${ids.join(',')}`
    );
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

  send(channelId: string, content: string) {
    return apiFetch<Message>(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
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
  getAll() {
    return apiFetch<Relationship[]>('/relationships');
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

  getDMChannels() {
    return apiFetch<DMChannel[]>('/relationships/channels');
  },

  openDM(recipientId: string) {
    return apiFetch<DMChannel>('/relationships/channels', {
      method: 'POST',
      body: JSON.stringify({ recipientId }),
    });
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
