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
  Thread,
  GuildEmoji,
  AvatarDecoration,
  ProfileEffect,
  Nameplate,
  PresenceStatus,
} from '@gratonite/types';

// ---------------------------------------------------------------------------
// Token management (module-scoped, not reactive)
// ---------------------------------------------------------------------------

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

if (typeof window !== 'undefined') {
  accessToken = window.localStorage.getItem('gratonite_access_token');
}

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      window.localStorage.setItem('gratonite_access_token', token);
    } else {
      window.localStorage.removeItem('gratonite_access_token');
    }
  }
}
export function getAccessToken(): string | null {
  return accessToken;
}

// ---------------------------------------------------------------------------
// Base URL
// ---------------------------------------------------------------------------

const rawApiBase = import.meta.env.VITE_API_URL ?? '/api/v1';
const API_BASE = rawApiBase.endsWith('/api/v1')
  ? rawApiBase
  : `${rawApiBase.replace(/\/$/, '')}/api/v1`;

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

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ApiRequestError(res.status, {
      code: 'PARSE_ERROR',
      message: res.ok
        ? 'Invalid response from server'
        : `Server error (${res.status}). Is the API running?`,
    } as ApiError);
  }

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

interface SearchMessagesResponse {
  results: Array<{
    id: string;
    channelId: string;
    guildId: string | null;
    authorId: string;
    content: string;
    type: number;
    createdAt: string;
    highlight: string;
    rank: number;
  }>;
  total: number;
  limit: number;
  offset: number;
}

export interface CommunityShopItem {
  id: string;
  itemType: 'display_name_style_pack' | 'profile_widget_pack' | 'server_tag_badge' | 'avatar_decoration' | 'profile_effect' | 'nameplate';
  name: string;
  description: string | null;
  uploaderId: string;
  payload: Record<string, unknown>;
  payloadSchemaVersion: number;
  assetHash: string | null;
  tags: string[];
  status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'published' | 'unpublished';
  moderationNotes: string | null;
  rejectionCode: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  installCount: number;
}

export interface CurrencyWallet {
  userId: string;
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  updatedAt: string;
}

export interface CurrencyLedgerEntry {
  id: string;
  userId: string;
  direction: 'earn' | 'spend';
  amount: number;
  source: 'chat_message' | 'server_engagement' | 'daily_checkin' | 'shop_purchase' | 'creator_item_purchase';
  description: string | null;
  contextKey: string | null;
  createdAt: string;
}

export interface BetaBugReport {
  id: string;
  reporterId: string;
  title: string;
  summary: string;
  steps: string | null;
  expected: string | null;
  actual: string | null;
  route: string | null;
  pageUrl: string | null;
  channelLabel: string | null;
  viewport: string | null;
  userAgent: string | null;
  clientTimestamp: string | null;
  submissionSource: string;
  status: 'open' | 'triaged' | 'resolved' | 'dismissed';
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface BetaBugReportInboxItem extends BetaBugReport {
  reporterProfile?: {
    userId: string;
    displayName: string;
    avatarHash: string | null;
  } | null;
}

export const api = {
  auth: {
    register: (data: RegisterRequest) =>
      apiFetch<{ email: string }>('/auth/register', {
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

    requestEmailVerification: (email: string) =>
      apiFetch<{ ok: true; message: string }>('/auth/verify-email/request', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),

    confirmEmailVerification: (token: string) =>
      apiFetch<{ ok: true; message: string; accessToken: string }>('/auth/verify-email/confirm', {
        method: 'POST',
        body: JSON.stringify({ token }),
      }),

    getMfaStatus: () =>
      apiFetch<{ enabled: boolean; pendingSetup: boolean; backupCodeCount: number }>('/auth/mfa/status'),

    startMfaSetup: (deviceLabel?: string) =>
      apiFetch<{
        secret: string;
        otpauthUrl: string;
        qrCodeDataUrl: string;
        expiresInSeconds: number;
      }>('/auth/mfa/setup/start', {
        method: 'POST',
        body: JSON.stringify(deviceLabel ? { deviceLabel } : {}),
      }),

    enableMfa: (code: string) =>
      apiFetch<{ ok: true; backupCodes: string[] }>('/auth/mfa/setup/enable', {
        method: 'POST',
        body: JSON.stringify({ code }),
      }),

    disableMfa: (code: string) =>
      apiFetch<{ ok: true }>('/auth/mfa/disable', {
        method: 'POST',
        body: JSON.stringify({ code }),
      }),

    regenerateMfaBackupCodes: (code: string) =>
      apiFetch<{ ok: true; backupCodes: string[] }>('/auth/mfa/backup-codes/regenerate', {
        method: 'POST',
        body: JSON.stringify({ code }),
      }),
  },

  users: {
    getMe: () => apiFetch<{
      id: string;
      username: string;
      email: string;
      emailVerified: boolean;
      createdAt: string;
      isAdmin: boolean;
      profile: {
        displayName: string;
        avatarHash: string | null;
        bannerHash: string | null;
        bio: string | null;
        pronouns: string | null;
        avatarDecorationId: string | null;
        profileEffectId: string | null;
        nameplateId: string | null;
        tier: string;
        previousAvatarHashes: string[];
        messageCount: number;
      } | null;
    }>('/users/@me'),

    updateProfile: (data: { displayName?: string; bio?: string; pronouns?: string; accentColor?: string; primaryColor?: string }) =>
      apiFetch<any>('/users/@me', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    updateAccountBasics: (data: { username?: string; displayName?: string }) =>
      apiFetch<{
        success: true;
        user: {
          id: string;
          username: string;
          email: string;
          emailVerified: boolean;
        };
        profile: {
          displayName: string;
        } | null;
      }>('/users/@me/account', {
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

    getSummaries: (ids: string[]) =>
      apiFetch<Array<{ id: string; username: string; displayName: string; avatarHash: string | null }>>(
        `/users?ids=${encodeURIComponent(ids.join(','))}`,
      ),

    searchUsers: (query: string) =>
      apiFetch<Array<{ id: string; username: string; displayName: string; avatarHash: string | null }>>(
        `/users/search?q=${encodeURIComponent(query)}`,
      ),

    getPresences: (ids: string[]) =>
      apiFetch<Array<{ userId: string; status: PresenceStatus; lastSeen: number | null }>>(
        `/users/presences?ids=${encodeURIComponent(ids.join(','))}`,
      ),

    getProfile: (userId: string) =>
      apiFetch<{
        id: string;
        username: string;
        displayName: string;
        avatarHash: string | null;
        bannerHash: string | null;
        bio: string | null;
        pronouns: string | null;
        accentColor: string | null;
        primaryColor: string | null;
        messageCount: number;
        createdAt: string;
      }>(`/users/${userId}/profile`),

    getMutuals: (userId: string) =>
      apiFetch<{
        mutualServers: Array<{ id: string; name: string; iconHash: string | null; nickname: string | null }>;
        mutualFriends: Array<{ id: string; username: string; displayName: string; avatarHash: string | null }>;
      }>(`/users/${userId}/mutuals`),

    updatePresence: (status: Extract<PresenceStatus, 'online' | 'idle' | 'dnd' | 'invisible'>) =>
      apiFetch<{ status: PresenceStatus }>('/users/@me/presence', {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),

    updateCustomStatus: (data: { text: string | null; expiresAt: string | null }) =>
      apiFetch<void>('/users/@me/status', { method: 'PATCH', body: JSON.stringify(data) }),

    updateWidgets: (widgets: string[]) =>
      apiFetch<void>('/users/@me/widgets', { method: 'PATCH', body: JSON.stringify({ widgets }) }),
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

    getAvatarDecorations: () =>
      apiFetch<AvatarDecoration[]>('/avatar-decorations'),

    getProfileEffects: () =>
      apiFetch<ProfileEffect[]>('/profile-effects'),

    getNameplates: () =>
      apiFetch<Nameplate[]>('/nameplates'),

    updateCustomization: (data: { avatarDecorationId?: string | null; profileEffectId?: string | null; nameplateId?: string | null }) =>
      apiFetch<any>('/users/@me/customization', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },

  communityShop: {
    listItems: (params: {
      itemType?: string;
      status?: string;
      search?: string;
      mine?: boolean;
      limit?: number;
      offset?: number;
    } = {}) => {
      const query = new URLSearchParams();
      if (params.itemType) query.set('itemType', params.itemType);
      if (params.status) query.set('status', params.status);
      if (params.search) query.set('search', params.search);
      if (params.mine !== undefined) query.set('mine', String(params.mine));
      if (params.limit !== undefined) query.set('limit', String(params.limit));
      if (params.offset !== undefined) query.set('offset', String(params.offset));
      const suffix = query.toString() ? `?${query.toString()}` : '';
      return apiFetch<CommunityShopItem[]>(`/community-items${suffix}`);
    },

    createItem: (data: {
      itemType: CommunityShopItem['itemType'];
      name: string;
      description?: string;
      payload?: Record<string, unknown>;
      payloadSchemaVersion?: number;
      assetHash?: string;
      tags?: string[];
    }) =>
      apiFetch<CommunityShopItem>('/community-items', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    submitForReview: (itemId: string) =>
      apiFetch<CommunityShopItem>(`/community-items/${itemId}/submit`, {
        method: 'POST',
      }),

    install: (itemId: string, data: { scope?: 'global' | 'guild'; scopeId?: string } = {}) =>
      apiFetch<any>(`/community-items/${itemId}/install`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    uninstall: (itemId: string, data: { scope?: 'global' | 'guild'; scopeId?: string } = {}) => {
      const query = new URLSearchParams();
      if (data.scope) query.set('scope', data.scope);
      if (data.scopeId) query.set('scopeId', data.scopeId);
      const suffix = query.toString() ? `?${query.toString()}` : '';
      return apiFetch<void>(`/community-items/${itemId}/install${suffix}`, { method: 'DELETE' });
    },

    getMyItems: () =>
      apiFetch<{
        created: CommunityShopItem[];
        installed: Array<{
          itemId: string;
          scope: 'global' | 'guild';
          scopeId: string | null;
          installedAt: string;
        }>;
      }>('/users/@me/community-items'),
  },

  economy: {
    getWallet: () =>
      apiFetch<CurrencyWallet>('/economy/wallet'),

    getLedger: (limit = 20) =>
      apiFetch<CurrencyLedgerEntry[]>(`/economy/ledger?limit=${limit}`),

    claimReward: (data: {
      source: 'chat_message' | 'server_engagement' | 'daily_checkin';
      contextKey?: string;
    }) =>
      apiFetch<{ wallet: CurrencyWallet; ledgerEntry: CurrencyLedgerEntry | null; amount: number }>('/economy/rewards/claim', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    spend: (data: {
      source: 'shop_purchase' | 'creator_item_purchase';
      amount: number;
      description: string;
      contextKey?: string;
    }) =>
      apiFetch<{ wallet: CurrencyWallet | null; ledgerEntry: CurrencyLedgerEntry | null }>('/economy/spend', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  voice: {
    join: (channelId: string, data?: { selfMute?: boolean; selfDeaf?: boolean }) =>
      apiFetch<{ token: string; voiceState: any; endpoint: string }>('/voice/join', {
        method: 'POST',
        body: JSON.stringify({ channelId, ...(data ?? {}) }),
      }),
    leave: () =>
      apiFetch<void>('/voice/leave', { method: 'POST' }),
    getChannelStates: (channelId: string) =>
      apiFetch<any[]>(`/channels/${channelId}/voice-states`),
    getGuildVoiceStates: (guildId: string) =>
      apiFetch<any[]>(`/guilds/${guildId}/voice-states`),
    getSoundboard: (guildId: string) =>
      apiFetch<Array<{
        id: string;
        guildId: string;
        name: string;
        soundHash: string;
        volume: number;
        emojiId?: string | null;
        emojiName?: string | null;
        uploaderId: string;
        available: boolean;
      }>>(`/guilds/${guildId}/soundboard`),
    playSoundboard: (guildId: string, soundId: string) =>
      apiFetch<void>(`/guilds/${guildId}/soundboard/${soundId}/play`, {
        method: 'POST',
      }),
    createSoundboard: (
      guildId: string,
      data: { name: string; soundHash: string; volume?: number; emojiName?: string },
    ) =>
      apiFetch<any>(`/guilds/${guildId}/soundboard`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateSoundboard: (
      guildId: string,
      soundId: string,
      data: { name?: string; volume?: number; available?: boolean; emojiName?: string | null },
    ) =>
      apiFetch<any>(`/guilds/${guildId}/soundboard/${soundId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    deleteSoundboard: (guildId: string, soundId: string) =>
      apiFetch<void>(`/guilds/${guildId}/soundboard/${soundId}`, { method: 'DELETE' }),
    getStageInstances: (guildId: string) =>
      apiFetch<any[]>(`/guilds/${guildId}/stage-instances`),
    requestToSpeak: (channelId: string) =>
      apiFetch<void>(`/channels/${channelId}/voice/request-speak`, { method: 'PUT' }),
    addSpeaker: (channelId: string, userId: string) =>
      apiFetch<void>(`/channels/${channelId}/voice/speakers/${userId}`, { method: 'PUT' }),
    removeSpeaker: (channelId: string, userId: string) =>
      apiFetch<void>(`/channels/${channelId}/voice/speakers/${userId}`, { method: 'DELETE' }),
    createStageInstance: (channelId: string, data: { topic: string }) =>
      apiFetch<any>('/stage-instances', {
        method: 'POST',
        body: JSON.stringify({ channelId, ...data }),
      }),
    deleteStageInstance: (channelId: string) =>
      apiFetch<void>(`/stage-instances/${channelId}`, { method: 'DELETE' }),
  },

  guilds: {
    getMine: () => apiFetch<Guild[]>('/guilds/@me'),

    discover: () => apiFetch<Array<{
      id: string;
      name: string;
      description: string | null;
      iconHash: string | null;
      bannerHash: string | null;
      memberCount: number;
      tags: string[];
      categories: string[];
    }>>('/guilds/discover'),

    get: (guildId: string) => apiFetch<Guild>(`/guilds/${guildId}`),

    getMembers: (guildId: string, limit = 100) =>
      apiFetch<GuildMember[]>(`/guilds/${guildId}/members?limit=${limit}`),

    create: (data: { name: string; description?: string; tags?: string[]; categories?: string[] }) =>
      apiFetch<Guild>('/guilds', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (guildId: string, data: { name?: string; description?: string; tags?: string[]; categories?: string[] }) =>
      apiFetch<Guild>(`/guilds/${guildId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    leave: (guildId: string) =>
      apiFetch<void>(`/guilds/${guildId}/members/@me`, { method: 'DELETE' }),

    delete: (guildId: string) =>
      apiFetch<void>(`/guilds/${guildId}`, { method: 'DELETE' }),

    uploadIcon: (guildId: string, file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiFetch<{ iconHash: string; iconAnimated: boolean }>(`/guilds/${guildId}/icon`, {
        method: 'POST',
        body: formData,
      });
    },

    deleteIcon: (guildId: string) =>
      apiFetch<void>(`/guilds/${guildId}/icon`, { method: 'DELETE' }),

    uploadBanner: (guildId: string, file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiFetch<{ bannerHash: string; bannerAnimated: boolean }>(`/guilds/${guildId}/banner`, {
        method: 'POST',
        body: formData,
      });
    },

    deleteBanner: (guildId: string) =>
      apiFetch<void>(`/guilds/${guildId}/banner`, { method: 'DELETE' }),

    getRoles: (guildId: string) =>
      apiFetch<any[]>(`/guilds/${guildId}/roles`),

    createRole: (guildId: string, data: { name: string; color?: number; mentionable?: boolean; permissions?: number }) =>
      apiFetch<any>(`/guilds/${guildId}/roles`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updateRole: (guildId: string, roleId: string, data: { name?: string; color?: number; mentionable?: boolean; permissions?: number }) =>
      apiFetch<any>(`/guilds/${guildId}/roles/${roleId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    deleteRole: (guildId: string, roleId: string) =>
      apiFetch<void>(`/guilds/${guildId}/roles/${roleId}`, { method: 'DELETE' }),

    getMemberRoles: (guildId: string, userId: string) =>
      apiFetch<any[]>(`/guilds/${guildId}/members/${userId}/roles`),

    assignMemberRole: (guildId: string, userId: string, roleId: string) =>
      apiFetch<void>(`/guilds/${guildId}/members/${userId}/roles/${roleId}`, { method: 'PUT' }),

    removeMemberRole: (guildId: string, userId: string, roleId: string) =>
      apiFetch<void>(`/guilds/${guildId}/members/${userId}/roles/${roleId}`, { method: 'DELETE' }),

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

    getEmojis: (guildId: string) =>
      apiFetch<GuildEmoji[]>(`/guilds/${guildId}/emojis`),

    createEmoji: (guildId: string, data: { name: string; file: File }) => {
      const formData = new FormData();
      formData.append('name', data.name);
      formData.append('file', data.file);
      return apiFetch<GuildEmoji>(`/guilds/${guildId}/emojis`, {
        method: 'POST',
        body: formData,
      });
    },

    deleteEmoji: (guildId: string, emojiId: string) =>
      apiFetch<void>(`/guilds/${guildId}/emojis/${emojiId}`, { method: 'DELETE' }),
  },

  channels: {
    getGuildChannels: (guildId: string) =>
      apiFetch<Channel[]>(`/guilds/${guildId}/channels`),

    get: (channelId: string) =>
      apiFetch<Channel>(`/channels/${channelId}`),

    create: (
      guildId: string,
      data: {
        name: string;
        type?: string;
        parentId?: string;
        topic?: string;
        nsfw?: boolean;
        rateLimitPerUser?: number;
      },
    ) =>
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

    getPermissionOverrides: (channelId: string) =>
      apiFetch<Array<{ id: string; channelId: string; targetId: string; targetType: 'role' | 'user'; allow: string; deny: string }>>(
        `/channels/${channelId}/permissions`,
      ),

    setPermissionOverride: (
      channelId: string,
      targetId: string,
      data: { targetType: 'role' | 'user'; allow: string; deny: string },
    ) =>
      apiFetch<{ id: string; channelId: string; targetId: string; targetType: 'role' | 'user'; allow: string; deny: string }>(
        `/channels/${channelId}/permissions/${targetId}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            type: data.targetType,
            allow: data.allow,
            deny: data.deny,
          }),
        },
      ),

    deletePermissionOverride: (channelId: string, targetId: string) =>
      apiFetch<void>(`/channels/${channelId}/permissions/${targetId}`, { method: 'DELETE' }),
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

  search: {
    messages: (params: { query: string; guildId?: string; channelId?: string; authorId?: string; before?: string; after?: string; limit?: number; offset?: number }) => {
      const query = new URLSearchParams();
      query.set('query', params.query);
      if (params.guildId) query.set('guildId', params.guildId);
      if (params.channelId) query.set('channelId', params.channelId);
      if (params.authorId) query.set('authorId', params.authorId);
      if (params.before) query.set('before', params.before);
      if (params.after) query.set('after', params.after);
      if (params.limit) query.set('limit', String(params.limit));
      if (params.offset) query.set('offset', String(params.offset));
      return apiFetch<SearchMessagesResponse>(`/search/messages?${query.toString()}`);
    },
  },

  threads: {
    create: (channelId: string, data: { name: string; type?: string; autoArchiveDuration?: number; message?: string }) =>
      apiFetch<Thread>(`/channels/${channelId}/threads`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    list: (channelId: string) =>
      apiFetch<Thread[]>(`/channels/${channelId}/threads`),

    get: (threadId: string) =>
      apiFetch<Thread>(`/threads/${threadId}`),

    join: (threadId: string) =>
      apiFetch<void>(`/threads/${threadId}/members/@me`, { method: 'PUT' }),

    leave: (threadId: string) =>
      apiFetch<void>(`/threads/${threadId}/members/@me`, { method: 'DELETE' }),
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
    upload: (file: File, purpose: string = 'upload') => {
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
        body: JSON.stringify({ userId }),
      }),
  },

  bugReports: {
    create: (data: {
      title: string;
      summary: string;
      steps?: string;
      expected?: string;
      actual?: string;
      route?: string;
      pageUrl?: string;
      channelLabel?: string;
      viewport?: string;
      userAgent?: string;
      clientTimestamp?: string;
      metadata?: Record<string, unknown>;
    }) =>
      apiFetch<BetaBugReport>('/bug-reports', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    list: (params: {
      status?: 'open' | 'triaged' | 'resolved' | 'dismissed';
      mine?: boolean;
      limit?: number;
    } = {}) => {
      const query = new URLSearchParams();
      if (params.status) query.set('status', params.status);
      if (params.mine !== undefined) query.set('mine', String(params.mine));
      if (params.limit !== undefined) query.set('limit', String(params.limit));
      const suffix = query.toString() ? `?${query.toString()}` : '';
      return apiFetch<{ items: BetaBugReportInboxItem[]; adminView: boolean }>(`/bug-reports${suffix}`);
    },

    updateStatus: (reportId: string, status: 'open' | 'triaged' | 'resolved' | 'dismissed') =>
      apiFetch<BetaBugReport>(`/bug-reports/${reportId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
  },

  shop: {
    getItems: () =>
      apiFetch<any[]>('/shop/items'),

    getInventory: () =>
      apiFetch<any[]>('/shop/inventory'),

    purchase: (itemId: string) =>
      apiFetch<any>('/shop/purchase', {
        method: 'POST',
        body: JSON.stringify({ itemId }),
      }),
  },

  wiki: {
    listPages: (channelId: string) =>
      apiFetch<any[]>(`/channels/${channelId}/wiki`),

    createPage: (channelId: string, data: { title: string; content: string }) =>
      apiFetch<any>(`/channels/${channelId}/wiki`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    getPage: (pageId: string) =>
      apiFetch<any>(`/wiki/${pageId}`),

    updatePage: (pageId: string, data: { title?: string; content?: string }) =>
      apiFetch<any>(`/wiki/${pageId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    deletePage: (pageId: string) =>
      apiFetch<void>(`/wiki/${pageId}`, { method: 'DELETE' }),

    getRevisions: (pageId: string) =>
      apiFetch<any[]>(`/wiki/${pageId}/revisions`),

    revertRevision: (pageId: string, revisionId: string) =>
      apiFetch<any>(`/wiki/${pageId}/revert/${revisionId}`, { method: 'POST' }),
  },

  events: {
    list: (guildId: string) =>
      apiFetch<any[]>(`/guilds/${guildId}/scheduled-events`),

    get: (guildId: string, eventId: string) =>
      apiFetch<any>(`/guilds/${guildId}/scheduled-events/${eventId}`),

    create: (
      guildId: string,
      data: {
        name: string;
        description?: string;
        startTime: string;
        endTime?: string;
        entityType: 'STAGE' | 'VOICE' | 'EXTERNAL';
        location?: string;
        channelId?: string;
      },
    ) =>
      apiFetch<any>(`/guilds/${guildId}/scheduled-events`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (
      guildId: string,
      eventId: string,
      data: { name?: string; description?: string; startTime?: string; endTime?: string; status?: string; location?: string },
    ) =>
      apiFetch<any>(`/guilds/${guildId}/scheduled-events/${eventId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    delete: (guildId: string, eventId: string) =>
      apiFetch<void>(`/guilds/${guildId}/scheduled-events/${eventId}`, { method: 'DELETE' }),

    markInterested: (guildId: string, eventId: string) =>
      apiFetch<void>(`/guilds/${guildId}/scheduled-events/${eventId}/interested`, { method: 'PUT' }),

    unmarkInterested: (guildId: string, eventId: string) =>
      apiFetch<void>(`/guilds/${guildId}/scheduled-events/${eventId}/interested`, { method: 'DELETE' }),
  },

  polls: {
    list: (channelId: string) =>
      apiFetch<any[]>(`/channels/${channelId}/polls`),
    get: (pollId: string) =>
      apiFetch<any>(`/polls/${pollId}`),
    create: (channelId: string, data: { question: string; options: string[]; duration?: number; multiselect?: boolean }) =>
      apiFetch<any>(`/channels/${channelId}/polls`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    vote: (pollId: string, optionIds: string[]) =>
      apiFetch<void>(`/polls/${pollId}/answers`, {
        method: 'POST',
        body: JSON.stringify({ optionIds }),
      }),
    removeVote: (pollId: string) =>
      apiFetch<void>(`/polls/${pollId}/answers/@me`, { method: 'DELETE' }),
    end: (pollId: string) =>
      apiFetch<void>(`/polls/${pollId}/expire`, { method: 'POST' }),
    getVoters: (pollId: string, optionId: string) =>
      apiFetch<any[]>(`/polls/${pollId}/answers/${optionId}/voters`),
  },

  scheduledMessages: {
    list: (guildId: string) =>
      apiFetch<any[]>(`/guilds/${guildId}/scheduled-messages`),
    create: (guildId: string, data: { channelId: string; content: string; scheduledFor: string }) =>
      apiFetch<any>(`/guilds/${guildId}/scheduled-messages`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    get: (guildId: string, messageId: string) =>
      apiFetch<any>(`/guilds/${guildId}/scheduled-messages/${messageId}`),
    delete: (guildId: string, messageId: string) =>
      apiFetch<void>(`/guilds/${guildId}/scheduled-messages/${messageId}`, { method: 'DELETE' }),
  },

  leaderboard: {
    get: (period: 'week' | 'month' | 'all' = 'week') =>
      apiFetch<Array<{
        rank: number;
        userId: string;
        username: string;
        displayName: string;
        avatarHash: string | null;
        messageCount: number;
        gratonitesEarned: number;
        memberSince: string;
      }>>(`/leaderboard?period=${period}`),
  },
  themes: {
    browse: (params?: { q?: string; tag?: string }) => {
      const qs = new URLSearchParams();
      if (params?.q) qs.set('q', params.q);
      if (params?.tag) qs.set('tag', params.tag);
      const query = qs.toString();
      return apiFetch<any[]>(`/themes${query ? `?${query}` : ''}`);
    },
    get: (themeId: string) =>
      apiFetch<any>(`/themes/${themeId}`),
    create: (data: { name: string; description?: string; tags?: string[]; vars: Record<string, string> }) =>
      apiFetch<any>('/themes', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (themeId: string, data: { name?: string; description?: string; tags?: string[]; vars?: Record<string, string> }) =>
      apiFetch<any>(`/themes/${themeId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    publish: (themeId: string) =>
      apiFetch<void>(`/themes/${themeId}/publish`, { method: 'POST' }),
    delete: (themeId: string) =>
      apiFetch<void>(`/themes/${themeId}`, { method: 'DELETE' }),
    myThemes: () =>
      apiFetch<any[]>('/users/@me/themes'),
  },
  cosmetics: {
    // ── Marketplace browse ────────────────────────────────────────────────
    browse: (params?: { type?: string; limit?: number; offset?: number }) => {
      const qs = new URLSearchParams();
      if (params?.type) qs.set('type', params.type);
      if (params?.limit) qs.set('limit', String(params.limit));
      if (params?.offset) qs.set('offset', String(params.offset));
      const query = qs.toString();
      return apiFetch<any[]>(`/cosmetics/marketplace${query ? `?${query}` : ''}`);
    },
    // ── Single cosmetic ───────────────────────────────────────────────────
    get: (cosmeticId: string) =>
      apiFetch<any>(`/cosmetics/${cosmeticId}`),
    // ── Creator cosmetics ─────────────────────────────────────────────────
    listByCreator: (creatorId: string, params?: { limit?: number; offset?: number }) => {
      const qs = new URLSearchParams();
      if (params?.limit) qs.set('limit', String(params.limit));
      if (params?.offset) qs.set('offset', String(params.offset));
      const query = qs.toString();
      return apiFetch<any[]>(`/cosmetics/creator/${creatorId}${query ? `?${query}` : ''}`);
    },
    // ── My cosmetics (creator) ────────────────────────────────────────────
    listMine: () =>
      apiFetch<any[]>('/cosmetics/mine'),
    // ── CRUD ─────────────────────────────────────────────────────────────
    create: (data: { name: string; description?: string; type: string; previewImageUrl?: string; assetUrl?: string; price?: number }) =>
      apiFetch<any>('/cosmetics', { method: 'POST', body: JSON.stringify(data) }),
    update: (cosmeticId: string, data: { name?: string; description?: string; previewImageUrl?: string; assetUrl?: string; price?: number; isPublished?: boolean }) =>
      apiFetch<any>(`/cosmetics/${cosmeticId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (cosmeticId: string) =>
      apiFetch<void>(`/cosmetics/${cosmeticId}`, { method: 'DELETE' }),
    // ── Upload ────────────────────────────────────────────────────────────
    upload: (formData: FormData) =>
      apiFetch<{ preview_image_url?: string; asset_url?: string }>('/cosmetics/upload', {
        method: 'POST',
        body: formData,
      }),
    // ── Purchase ──────────────────────────────────────────────────────────
    purchase: (cosmeticId: string) =>
      apiFetch<any>(`/cosmetics/${cosmeticId}/purchase`, { method: 'POST' }),
    // ── Equip / Unequip ───────────────────────────────────────────────────
    equip: (cosmeticId: string) =>
      apiFetch<any>(`/cosmetics/${cosmeticId}/equip`, { method: 'PATCH' }),
    unequip: (cosmeticId: string) =>
      apiFetch<void>(`/cosmetics/${cosmeticId}/equip`, { method: 'DELETE' }),
    // ── Equipped cosmetics ────────────────────────────────────────────────
    getEquipped: () =>
      apiFetch<Array<{ type: string; cosmeticId: string; name: string; assetUrl: string | null; previewImageUrl: string | null }>>('/users/@me/equipped-cosmetics'),
    // ── Creator stats ─────────────────────────────────────────────────────
    getStats: (cosmeticId: string) =>
      apiFetch<{ cosmeticId: string; totalSales: number; totalRevenueGratonites: number; createdAt: string; updatedAt: string }>(`/cosmetics/${cosmeticId}/stats`),
  },
};
