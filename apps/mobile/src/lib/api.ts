import Constants from 'expo-constants';
import { useAuthStore } from '../stores/auth.store';

const API_URL =
  (Constants.expoConfig?.extra as Record<string, string> | undefined)?.['apiUrl'] ?? 'https://api.gratonite.chat';
const BASE = `${API_URL}/api/v1`;

/**
 * Core fetch wrapper with auth token injection and auto-refresh.
 */
async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = useAuthStore.getState().token;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // Don't send stale auth tokens on login/register — those endpoints don't need them
  if (token && !path.startsWith('/auth/')) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (res.status === 401 && token) {
    // Try refreshing the token
    const refreshed = await refreshToken();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${refreshed}`;
      const retry = await fetch(`${BASE}${path}`, {
        ...options,
        headers,
        credentials: 'include',
      });
      if (!retry.ok) {
        throw new ApiError(retry.status, await retry.text());
      }
      return retry.json();
    }
    // Refresh failed — force logout
    await useAuthStore.getState().logout();
    throw new ApiError(401, 'Session expired');
  }

  if (!res.ok) {
    throw new ApiError(res.status, await res.text());
  }

  // Handle 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}

async function refreshToken(): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return null;
    const data = await res.json();
    const newToken = data.accessToken;
    if (newToken) {
      // Update the store (which also persists to SecureStore)
      const user = useAuthStore.getState().user;
      if (user) {
        await useAuthStore.getState().login(user, newToken);
      }
      return newToken;
    }
    return null;
  } catch {
    return null;
  }
}

class ApiError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`API Error ${status}: ${body}`);
  }
}

// ── Auth ──────────────────────────────────────────────
export const authApi = {
  login: (data: { login: string; password: string; mfaCode?: string; mfaBackupCode?: string }) =>
    apiFetch<{ user: any; accessToken: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  register: (data: { username: string; email: string; password: string }) =>
    apiFetch<{ user: any; accessToken: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  refresh: () => refreshToken(),
};

// ── Users ─────────────────────────────────────────────
export const usersApi = {
  getMe: () => apiFetch<any>('/users/@me'),

  updateProfile: (data: Record<string, any>) =>
    apiFetch<any>('/users/@me', { method: 'PATCH', body: JSON.stringify(data) }),

  getProfile: (userId: string) => apiFetch<any>(`/users/${userId}/profile`),

  searchUsers: (query: string) => apiFetch<any[]>(`/users/search?q=${encodeURIComponent(query)}`),

  getSummaries: (ids: string[]) =>
    apiFetch<Array<{ id: string; username: string; displayName: string; avatarHash: string | null }>>(
      `/users?ids=${encodeURIComponent(ids.join(','))}`,
    ),

  getPresences: (ids: string[]) =>
    apiFetch<Array<{ userId: string; status: string; lastSeen: number | null }>>(
      `/users/presences?ids=${encodeURIComponent(ids.join(','))}`,
    ),

  getMutuals: (userId: string) =>
    apiFetch<{
      mutualServers: Array<{ id: string; name: string; iconHash: string | null; nickname: string | null }>;
      mutualFriends: Array<{ id: string; username: string; displayName: string; avatarHash: string | null }>;
    }>(`/users/${userId}/mutuals`),

  updatePresence: (status: string) =>
    apiFetch<void>('/users/@me/presence', {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};

// ── Guilds ────────────────────────────────────────────
export const guildsApi = {
  getMine: () => apiFetch<any[]>('/guilds/@me'),

  get: (guildId: string) => apiFetch<any>(`/guilds/${guildId}`),

  getMembers: (guildId: string, limit = 100) =>
    apiFetch<any[]>(`/guilds/${guildId}/members?limit=${limit}`),

  create: (data: { name: string; description?: string }) =>
    apiFetch<any>('/guilds', { method: 'POST', body: JSON.stringify(data) }),

  leave: (guildId: string) =>
    apiFetch<void>(`/guilds/${guildId}/members/@me`, { method: 'DELETE' }),

  delete: (guildId: string) =>
    apiFetch<void>(`/guilds/${guildId}`, { method: 'DELETE' }),

  kickMember: (guildId: string, userId: string) =>
    apiFetch<void>(`/guilds/${guildId}/members/${userId}`, { method: 'DELETE' }),

  banMember: (guildId: string, userId: string, reason?: string) =>
    apiFetch<void>(`/guilds/${guildId}/bans/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    }),

  unbanMember: (guildId: string, userId: string) =>
    apiFetch<void>(`/guilds/${guildId}/bans/${userId}`, { method: 'DELETE' }),

  getBans: (guildId: string) =>
    apiFetch<any[]>(`/guilds/${guildId}/bans`),

  getRoles: (guildId: string) =>
    apiFetch<any[]>(`/guilds/${guildId}/roles`),

  createRole: (guildId: string, data: { name: string; mentionable?: boolean }) =>
    apiFetch<any>(`/guilds/${guildId}/roles`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteRole: (guildId: string, roleId: string) =>
    apiFetch<void>(`/guilds/${guildId}/roles/${roleId}`, { method: 'DELETE' }),

  updateRole: (guildId: string, roleId: string, data: { name?: string; mentionable?: boolean }) =>
    apiFetch<any>(`/guilds/${guildId}/roles/${roleId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  getMemberRoles: (guildId: string, userId: string) =>
    apiFetch<any[]>(`/guilds/${guildId}/members/${userId}/roles`),

  assignRole: (guildId: string, userId: string, roleId: string) =>
    apiFetch<void>(`/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
      method: 'PUT',
    }),

  removeRole: (guildId: string, userId: string, roleId: string) =>
    apiFetch<void>(`/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
      method: 'DELETE',
    }),

  getEmojis: (guildId: string) =>
    apiFetch<any[]>(`/guilds/${guildId}/emojis`),

  deleteEmoji: (guildId: string, emojiId: string) =>
    apiFetch<void>(`/guilds/${guildId}/emojis/${emojiId}`, { method: 'DELETE' }),
};

// ── Channels ──────────────────────────────────────────
export const channelsApi = {
  getGuildChannels: (guildId: string) =>
    apiFetch<any[]>(`/guilds/${guildId}/channels`),

  get: (channelId: string) => apiFetch<any>(`/channels/${channelId}`),

  create: (guildId: string, data: { name: string; type: string; parentId?: string; topic?: string }) =>
    apiFetch<any>(`/guilds/${guildId}/channels`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  delete: (channelId: string) =>
    apiFetch<void>(`/channels/${channelId}`, { method: 'DELETE' }),
};

// ── Messages ──────────────────────────────────────────
export const messagesApi = {
  list: (channelId: string, params?: { limit?: number; before?: string }) => {
    const parts: string[] = [];
    if (params?.limit) parts.push(`limit=${params.limit}`);
    if (params?.before) parts.push(`before=${encodeURIComponent(params.before)}`);
    const qs = parts.length ? `?${parts.join('&')}` : '';
    return apiFetch<any[]>(`/channels/${channelId}/messages${qs}`);
  },

  send: (channelId: string, data: { content: string; nonce?: string }) =>
    apiFetch<any>(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  edit: (channelId: string, messageId: string, data: { content: string }) =>
    apiFetch<any>(`/channels/${channelId}/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (channelId: string, messageId: string) =>
    apiFetch<void>(`/channels/${channelId}/messages/${messageId}`, {
      method: 'DELETE',
    }),

  addReaction: (channelId: string, messageId: string, emoji: string) =>
    apiFetch<void>(
      `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`,
      { method: 'PUT' },
    ),

  removeReaction: (channelId: string, messageId: string, emoji: string) =>
    apiFetch<void>(
      `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`,
      { method: 'DELETE' },
    ),

  getPinned: (channelId: string) =>
    apiFetch<any[]>(`/channels/${channelId}/pins`),

  pin: (channelId: string, messageId: string) =>
    apiFetch<void>(`/channels/${channelId}/pins/${messageId}`, { method: 'PUT' }),

  unpin: (channelId: string, messageId: string) =>
    apiFetch<void>(`/channels/${channelId}/pins/${messageId}`, { method: 'DELETE' }),
};

// ── Relationships (Friends) ───────────────────────────
export const relationshipsApi = {
  getAll: () => apiFetch<any[]>('/relationships'),

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

  getDmChannels: () => apiFetch<any[]>('/relationships/channels'),

  openDm: (userId: string) =>
    apiFetch<any>('/relationships/channels', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),
};

// ── Notifications ─────────────────────────────────────
export const notificationsApi = {
  // Push token registration (new endpoint needed on backend)
  registerPushToken: (token: string, platform: string) =>
    apiFetch<void>('/users/@me/push-token', {
      method: 'POST',
      body: JSON.stringify({ token, platform }),
    }),

  unregisterPushToken: (token: string) =>
    apiFetch<void>('/users/@me/push-token', {
      method: 'DELETE',
      body: JSON.stringify({ token }),
    }),
};

// ── Files ─────────────────────────────────────────────
export const filesApi = {
  upload: async (uri: string, purpose = 'attachment') => {
    const token = useAuthStore.getState().token;
    const formData = new FormData();
    const filename = uri.split('/').pop() ?? 'file';
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    const mimeType =
      ext === 'png' ? 'image/png' :
      ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
      ext === 'gif' ? 'image/gif' :
      ext === 'mp4' ? 'video/mp4' :
      'application/octet-stream';

    formData.append('file', {
      uri,
      name: filename,
      type: mimeType,
    } as any);
    formData.append('purpose', purpose);

    const res = await fetch(`${BASE}/files/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!res.ok) throw new ApiError(res.status, await res.text());
    return res.json();
  },
};

// ── Shop ──────────────────────────────────────────────
export const shopApi = {
  getItems: () => apiFetch<any[]>('/shop/items'),
  getInventory: () => apiFetch<any[]>('/shop/inventory'),
  purchase: (itemId: string) =>
    apiFetch<any>('/shop/purchase', { method: 'POST', body: JSON.stringify({ itemId }) }),
};

// ── Economy ───────────────────────────────────────────
export const economyApi = {
  getWallet: () => apiFetch<any>('/economy/wallet'),
  getLedger: (limit = 20) => apiFetch<any[]>(`/economy/ledger?limit=${limit}`),
  claimReward: (data: { type: string }) =>
    apiFetch<any>('/economy/rewards/claim', { method: 'POST', body: JSON.stringify(data) }),
};

// ── Leaderboard ───────────────────────────────────────
export const leaderboardApi = {
  get: (period: 'week' | 'month' | 'all' = 'week') =>
    apiFetch<any>(`/leaderboard?period=${period}`),
};

// ── Invites ───────────────────────────────────────────
export const invitesApi = {
  get: (code: string) => apiFetch<any>(`/invites/${code}`),
  accept: (code: string) => apiFetch<any>(`/invites/${code}`, { method: 'POST' }),

  create: (guildId: string, data: { channelId: string; maxAgeSeconds?: number }) =>
    apiFetch<any>(`/guilds/${guildId}/invites`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// ── Discover ──────────────────────────────────────────
export const discoverApi = {
  browse: (params?: { query?: string; limit?: number }) => {
    const parts: string[] = [];
    if (params?.query) parts.push(`q=${encodeURIComponent(params.query)}`);
    if (params?.limit) parts.push(`limit=${params.limit}`);
    const qs = parts.length ? `?${parts.join('&')}` : '';
    return apiFetch<any[]>(`/discover${qs}`);
  },
};

// ── Voice ────────────────────────────────────────────
export const voiceApi = {
  join: (channelId: string) =>
    apiFetch<{ token: string; url: string }>('/voice/join', {
      method: 'POST',
      body: JSON.stringify({ channelId }),
    }),

  leave: () =>
    apiFetch<void>('/voice/leave', { method: 'POST' }),

  updateState: (data: { selfMute?: boolean; selfDeafen?: boolean }) =>
    apiFetch<void>('/voice/state', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};

/**
 * Build an absolute URL for a file served by the API.
 * The API endpoint `GET /api/v1/files/:hash` resolves any asset
 * (avatar, banner, server-icon, emoji, etc.) by its hash.
 *
 * @param hash - The file hash including extension, e.g. `abc123.webp`
 * @returns Full URL like `https://api.gratonite.chat/api/v1/files/abc123.webp`
 */
export function getFileUrl(hash: string): string {
  return `${BASE}/files/${hash}`;
}

export { ApiError, API_URL };
