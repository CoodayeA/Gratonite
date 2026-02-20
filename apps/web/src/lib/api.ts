import type {
  AuthResponse,
  RegisterRequest,
  LoginRequest,
  ApiError,
  CursorPaginationParams,
  Guild,
  Channel,
  Message,
  GuildMember,
} from '@gratonite/types';

// ---------------------------------------------------------------------------
// Token management (module-scoped, not reactive)
// ---------------------------------------------------------------------------

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}
export function getAccessToken(): string | null {
  return accessToken;
}

// ---------------------------------------------------------------------------
// Base URL
// ---------------------------------------------------------------------------

const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

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
  // Deduplicate concurrent refresh calls
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include', // sends HttpOnly refreshToken cookie
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        accessToken = null;
        return null;
      }

      const data = (await res.json()) as { accessToken: string };
      accessToken = data.accessToken;
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

  // Attach auth header
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  // Default Content-Type for JSON bodies
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include', // always send cookies
  });

  // Rate limited
  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('Retry-After') ?? 5000);
    throw new RateLimitError(retryAfter);
  }

  // Unauthorized — try refresh once
  if (res.status === 401 && !retried) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return apiFetch<T>(path, options, true);
    }
    // Refresh failed — throw to trigger logout
    const body = await res.json().catch(() => ({ code: 'UNAUTHORIZED', message: 'Unauthorized' }));
    throw new ApiRequestError(401, body as ApiError);
  }

  // No content
  if (res.status === 204) {
    return undefined as T;
  }

  const body = await res.json();

  if (!res.ok) {
    throw new ApiRequestError(res.status, body as ApiError);
  }

  return body as T;
}

// ---------------------------------------------------------------------------
// Query string helper
// ---------------------------------------------------------------------------

function buildQuery(params?: CursorPaginationParams): string {
  if (!params) return '';
  const parts: string[] = [];
  if (params.before) parts.push(`before=${params.before}`);
  if (params.after) parts.push(`after=${params.after}`);
  if (params.around) parts.push(`around=${params.around}`);
  if (params.limit) parts.push(`limit=${params.limit}`);
  return parts.join('&');
}

// ---------------------------------------------------------------------------
// Typed API methods
// ---------------------------------------------------------------------------

interface InviteInfo {
  code: string;
  guild: {
    id: string;
    name: string;
    iconHash: string | null;
    memberCount: number;
    description: string | null;
  };
  inviter?: { id: string; username: string; displayName: string; avatarHash: string | null };
  expiresAt: string | null;
  uses: number;
  maxUses: number | null;
}

export const api = {
  auth: {
    register: (data: RegisterRequest) =>
      apiFetch<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    login: (data: LoginRequest) =>
      apiFetch<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    refresh: () => refreshAccessToken(),

    logout: () =>
      apiFetch<void>('/auth/logout', { method: 'POST' }),

    checkUsername: (username: string) =>
      apiFetch<{ available: boolean }>(
        `/auth/username-available?username=${encodeURIComponent(username)}`,
      ),
  },

  users: {
    getMe: () => apiFetch<{
      id: string;
      username: string;
      email: string;
      emailVerified: boolean;
      createdAt: string;
      profile: {
        displayName: string;
        avatarHash: string | null;
        bannerHash: string | null;
        bio: string | null;
        pronouns: string | null;
        tier: string;
      };
    }>('/users/@me'),
  },

  guilds: {
    getMine: () => apiFetch<Guild[]>('/users/@me/guilds'),

    get: (guildId: string) => apiFetch<Guild>(`/guilds/${guildId}`),

    getMembers: (guildId: string, limit = 100) =>
      apiFetch<GuildMember[]>(`/guilds/${guildId}/members?limit=${limit}`),

    create: (data: { name: string }) =>
      apiFetch<Guild>('/guilds', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  channels: {
    getGuildChannels: (guildId: string) =>
      apiFetch<Channel[]>(`/guilds/${guildId}/channels`),

    get: (channelId: string) =>
      apiFetch<Channel>(`/channels/${channelId}`),
  },

  messages: {
    list: (channelId: string, params?: CursorPaginationParams) =>
      apiFetch<Message[]>(
        `/channels/${channelId}/messages${params ? '?' + buildQuery(params) : ''}`,
      ),

    send: (channelId: string, data: { content: string; nonce?: string }) =>
      apiFetch<Message>(`/channels/${channelId}/messages`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    edit: (channelId: string, messageId: string, data: { content: string }) =>
      apiFetch<Message>(`/channels/${channelId}/messages/${messageId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    delete: (channelId: string, messageId: string) =>
      apiFetch<void>(`/channels/${channelId}/messages/${messageId}`, {
        method: 'DELETE',
      }),
  },

  invites: {
    get: (code: string) => apiFetch<InviteInfo>(`/invites/${code}`),

    accept: (code: string) =>
      apiFetch<Guild>(`/invites/${code}`, { method: 'POST' }),
  },
};
