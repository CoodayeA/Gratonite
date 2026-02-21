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

  // Default Content-Type for JSON bodies — skip for FormData (browser sets multipart boundary)
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
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

    updateProfile: (data: { displayName?: string; bio?: string; pronouns?: string; accentColor?: string }) =>
      apiFetch<any>('/users/@me', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    uploadAvatar: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiFetch<{ avatarHash: string; avatarAnimated: boolean }>('/users/@me/avatar', {
        method: 'POST',
        body: formData,
      });
    },

    deleteAvatar: () =>
      apiFetch<void>('/users/@me/avatar', { method: 'DELETE' }),

    uploadBanner: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiFetch<{ bannerHash: string; bannerAnimated: boolean }>('/users/@me/banner', {
        method: 'POST',
        body: formData,
      });
    },

    deleteBanner: () =>
      apiFetch<void>('/users/@me/banner', { method: 'DELETE' }),

    updateSettings: (data: Record<string, unknown>) =>
      apiFetch<any>('/users/@me/settings', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    getDndSchedule: () =>
      apiFetch<{
        enabled: boolean;
        startTime: string;
        endTime: string;
        timezone: string;
        daysOfWeek: number;
        allowExceptions: string[];
      }>('/users/@me/dnd-schedule'),

    updateDndSchedule: (data: Record<string, unknown>) =>
      apiFetch<any>('/users/@me/dnd-schedule', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },

  profiles: {
    getMemberProfile: (guildId: string, userId: string) =>
      apiFetch<any>(`/guilds/${guildId}/members/${userId}/profile`),

    updateMemberProfile: (guildId: string, data: { nickname?: string | null; bio?: string | null }) =>
      apiFetch<any>(`/guilds/${guildId}/members/@me/profile`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    uploadMemberAvatar: (guildId: string, file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiFetch<any>(`/guilds/${guildId}/members/@me/profile/avatar`, {
        method: 'POST',
        body: formData,
      });
    },

    deleteMemberAvatar: (guildId: string) =>
      apiFetch<any>(`/guilds/${guildId}/members/@me/profile/avatar`, { method: 'DELETE' }),

    uploadMemberBanner: (guildId: string, file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiFetch<any>(`/guilds/${guildId}/members/@me/profile/banner`, {
        method: 'POST',
        body: formData,
      });
    },

    deleteMemberBanner: (guildId: string) =>
      apiFetch<any>(`/guilds/${guildId}/members/@me/profile/banner`, { method: 'DELETE' }),
  },

  voice: {
    join: (channelId: string, data?: { selfMute?: boolean; selfDeaf?: boolean }) =>
      apiFetch<{ token: string; voiceState: any; endpoint: string }>('/voice/join', {
        method: 'POST',
        body: JSON.stringify({ channelId, ...(data ?? {}) }),
      }),
    leave: () =>
      apiFetch<void>('/voice/leave', { method: 'POST' }),
  },

  guilds: {
    getMine: () => apiFetch<Guild[]>('/users/@me/guilds'),

    get: (guildId: string) => apiFetch<Guild>(`/guilds/${guildId}`),

    getMembers: (guildId: string, limit = 100) =>
      apiFetch<GuildMember[]>(`/guilds/${guildId}/members?limit=${limit}`),

    create: (data: { name: string; description?: string }) =>
      apiFetch<Guild>('/guilds', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (guildId: string, data: { name?: string; description?: string }) =>
      apiFetch<Guild>(`/guilds/${guildId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    leave: (guildId: string) =>
      apiFetch<void>(`/guilds/${guildId}/members/@me`, { method: 'DELETE' }),

    delete: (guildId: string) =>
      apiFetch<void>(`/guilds/${guildId}`, { method: 'DELETE' }),

    getRoles: (guildId: string) =>
      apiFetch<any[]>(`/guilds/${guildId}/roles`),

    createRole: (guildId: string, data: { name: string; color?: string; permissions?: string }) =>
      apiFetch<any>(`/guilds/${guildId}/roles`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updateRole: (guildId: string, roleId: string, data: { name?: string; color?: string; permissions?: string }) =>
      apiFetch<any>(`/guilds/${guildId}/roles/${roleId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    deleteRole: (guildId: string, roleId: string) =>
      apiFetch<void>(`/guilds/${guildId}/roles/${roleId}`, { method: 'DELETE' }),

    getBans: (guildId: string) =>
      apiFetch<any[]>(`/guilds/${guildId}/bans`),

    ban: (guildId: string, userId: string, reason?: string) =>
      apiFetch<void>(`/guilds/${guildId}/bans/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ reason }),
      }),

    unban: (guildId: string, userId: string) =>
      apiFetch<void>(`/guilds/${guildId}/bans/${userId}`, { method: 'DELETE' }),

    kickMember: (guildId: string, userId: string) =>
      apiFetch<void>(`/guilds/${guildId}/members/${userId}`, { method: 'DELETE' }),
  },

  channels: {
    getGuildChannels: (guildId: string) =>
      apiFetch<Channel[]>(`/guilds/${guildId}/channels`),

    get: (channelId: string) =>
      apiFetch<Channel>(`/channels/${channelId}`),

    create: (guildId: string, data: { name: string; type?: string; parentId?: string; topic?: string }) =>
      apiFetch<Channel>(`/guilds/${guildId}/channels`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (channelId: string, data: { name?: string; topic?: string; nsfw?: boolean; rateLimitPerUser?: number }) =>
      apiFetch<Channel>(`/channels/${channelId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    delete: (channelId: string) =>
      apiFetch<void>(`/channels/${channelId}`, { method: 'DELETE' }),
  },

  messages: {
    list: (channelId: string, params?: CursorPaginationParams) =>
      apiFetch<Message[]>(
        `/channels/${channelId}/messages${params ? '?' + buildQuery(params) : ''}`,
      ),

    send: (channelId: string, data: { content: string; nonce?: string; messageReference?: { messageId: string }; attachmentIds?: string[] }) =>
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

    addReaction: (channelId: string, messageId: string, emoji: string) =>
      apiFetch<void>(`/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`, {
        method: 'PUT',
      }),

    removeReaction: (channelId: string, messageId: string, emoji: string) =>
      apiFetch<void>(`/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`, {
        method: 'DELETE',
      }),

    getReactions: (channelId: string, messageId: string) =>
      apiFetch<any[]>(`/channels/${channelId}/messages/${messageId}/reactions`),

    getPins: (channelId: string) =>
      apiFetch<Message[]>(`/channels/${channelId}/pins`),

    pin: (channelId: string, messageId: string) =>
      apiFetch<void>(`/channels/${channelId}/pins/${messageId}`, { method: 'PUT' }),

    unpin: (channelId: string, messageId: string) =>
      apiFetch<void>(`/channels/${channelId}/pins/${messageId}`, { method: 'DELETE' }),
  },

  invites: {
    get: (code: string) => apiFetch<InviteInfo>(`/invites/${code}`),

    accept: (code: string) =>
      apiFetch<Guild>(`/invites/${code}`, { method: 'POST' }),

    create: (guildId: string, data: { channelId: string; maxUses?: number; maxAgeSeconds?: number }) =>
      apiFetch<{ code: string; expiresAt: string | null }>(`/invites/guilds/${guildId}/invites`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  files: {
    upload: (file: File, purpose: string = 'attachment') => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('purpose', purpose);
      return apiFetch<{ id: string; url: string; filename: string; size: number; mimeType: string }>('/files/upload', {
        method: 'POST',
        body: formData,
      });
    },
  },

  relationships: {
    getAll: () =>
      apiFetch<any[]>('/relationships'),

    sendFriendRequest: (userId: string) =>
      apiFetch<any>('/relationships/friends', {
        method: 'POST',
        body: JSON.stringify({ userId }),
      }),

    acceptFriendRequest: (userId: string) =>
      apiFetch<any>(`/relationships/friends/${userId}`, { method: 'PUT' }),

    removeFriend: (userId: string) =>
      apiFetch<void>(`/relationships/friends/${userId}`, { method: 'DELETE' }),

    block: (userId: string) =>
      apiFetch<void>(`/relationships/blocks/${userId}`, { method: 'PUT' }),

    unblock: (userId: string) =>
      apiFetch<void>(`/relationships/blocks/${userId}`, { method: 'DELETE' }),

    getDmChannels: () =>
      apiFetch<any[]>('/relationships/channels'),

    openDm: (userId: string) =>
      apiFetch<any>('/relationships/channels', {
        method: 'POST',
        body: JSON.stringify({ recipientId: userId }),
      }),
  },
};
