import { isAuthGuardEnabled, isAuthRuntimeExpired, setAuthRuntimeState, transitionAuthExpired } from './authRuntime';

// ---------------------------------------------------------------------------
// Inline types (standalone — no @gratonite/types dependency)
// ---------------------------------------------------------------------------

interface AuthResponse {
  accessToken: string;
  user: { id: string; username: string; email: string; emailVerified: boolean; isAdmin: boolean };
}

interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

interface LoginRequest {
  login: string;
  password: string;
  mfaCode?: string;
}

interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

interface CursorPaginationParams {
  before?: string;
  after?: string;
  around?: string;
  limit?: number;
}

interface Guild {
  id: string;
  name: string;
  ownerId: string;
  iconHash: string | null;
  bannerHash: string | null;
  description: string | null;
  memberCount: number;
  createdAt: string;
  [key: string]: unknown;
}

interface Channel {
  id: string;
  guildId: string | null;
  name: string;
  type: string;
  topic: string | null;
  parentId: string | null;
  position: number;
  [key: string]: unknown;
}

interface Message {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  type: number;
  createdAt: string;
  editedAt: string | null;
  [key: string]: unknown;
}

interface GuildMember {
  userId: string;
  guildId: string;
  nickname: string | null;
  username?: string;
  displayName?: string;
  avatarHash?: string | null;
  roleIds?: string[];
  roles?: string[];
  groupIds?: string[];
  status?: PresenceStatus;
  joinedAt: string;
  [key: string]: unknown;
}

interface Thread {
  id: string;
  channelId: string;
  name: string;
  [key: string]: unknown;
}

interface GuildEmoji {
  id: string;
  guildId: string;
  name: string;
  [key: string]: unknown;
}

type AvatarDecoration = any;
type ProfileEffect = any;
type Nameplate = any;
type PresenceStatus = 'online' | 'idle' | 'dnd' | 'invisible' | 'offline';

interface ShopItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  imageUrl: string | null;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  available: boolean;
  type: 'avatar_frame' | 'decoration' | 'profile_effect' | 'nameplate' | 'soundboard' | null;
  assetUrl: string | null;
  assetConfig: unknown | null;
  duration: number | null;
  metadata: unknown | null;
  createdAt: string;
}

interface InventoryItem {
  id: string;
  itemId: string;
  name: string;
  type: string;
  source: 'shop' | 'cosmetics';
  rarity: string;
  imageUrl: string | null;
  assetUrl: string | null;
  assetConfig: unknown | null;
  quantity: number;
  equipped: boolean;
  acquiredAt: string;
}

// ---------------------------------------------------------------------------
// Token management (module-scoped, not reactive)
// ---------------------------------------------------------------------------

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;
let meRequestPromise: Promise<{
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  isAdmin: boolean;
  onboardingCompleted: boolean;
  interests: string[] | null;
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
}> | null = null;
let walletRequestPromise: Promise<CurrencyWallet> | null = null;

if (typeof window !== 'undefined') {
  accessToken = window.localStorage.getItem('gratonite_access_token');
  if (isAuthGuardEnabled()) {
    setAuthRuntimeState(accessToken ? 'active' : 'expired');
  }
}

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (isAuthGuardEnabled()) {
    setAuthRuntimeState(token ? 'active' : 'expired');
  }
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

export { API_BASE };

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ApiRequestError extends Error {
  code: string;
  status: number;
  requestId: string | null;
  details?: Record<string, string[]>;

  constructor(status: number, body: ApiError, requestId: string | null = null) {
    super(body.message);
    this.name = 'ApiRequestError';
    this.code = body.code;
    this.status = status;
    this.requestId = requestId;
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

function shouldBypassAuthGate(path: string): boolean {
  return path.startsWith('/auth/login')
    || path.startsWith('/auth/register')
    || path.startsWith('/auth/refresh')
    || path.startsWith('/auth/verify-email')
    || path.startsWith('/telemetry/client-events');
}

function emitClientTelemetry(payload: ClientTelemetryEvent): void {
  if (typeof window === 'undefined') return;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  void fetch(`${API_BASE}/telemetry/client-events`, {
    method: 'POST',
    headers,
    credentials: 'include',
    keepalive: true,
    body: JSON.stringify(payload),
  }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

async function refreshAccessToken(): Promise<string | null> {
  // Deduplicate concurrent refresh calls
  if (refreshPromise) return refreshPromise;

  if (isAuthGuardEnabled()) {
    setAuthRuntimeState('refreshing');
    emitClientTelemetry({
      event: 'auth_refresh_attempt',
      route: typeof window !== 'undefined' ? window.location.pathname : null,
      timestamp: new Date().toISOString(),
    });
  }

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include', // sends HttpOnly refreshToken cookie
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        setAccessToken(null);
        if (isAuthGuardEnabled()) {
          emitClientTelemetry({
            event: 'auth_refresh_result',
            statusClass: 'unauthorized',
            route: typeof window !== 'undefined' ? window.location.pathname : null,
            timestamp: new Date().toISOString(),
          });
        }
        return null;
      }

      const data = (await res.json()) as { accessToken: string };
      setAccessToken(data.accessToken);
      if (isAuthGuardEnabled()) {
        setAuthRuntimeState('active');
        emitClientTelemetry({
          event: 'auth_refresh_result',
          statusClass: 'success',
          route: typeof window !== 'undefined' ? window.location.pathname : null,
          timestamp: new Date().toISOString(),
        });
      }
      return data.accessToken;
    } catch {
      setAccessToken(null);
      if (isAuthGuardEnabled()) {
        emitClientTelemetry({
          event: 'auth_refresh_result',
          statusClass: 'network',
          route: typeof window !== 'undefined' ? window.location.pathname : null,
          timestamp: new Date().toISOString(),
        });
      }
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
  if (isAuthRuntimeExpired() && !shouldBypassAuthGate(path)) {
    emitClientTelemetry({
      event: 'auth_request_short_circuit',
      route: typeof window !== 'undefined' ? window.location.pathname : null,
      reason: path,
      timestamp: new Date().toISOString(),
    });
    throw new ApiRequestError(401, {
      code: 'UNAUTHORIZED',
      message: 'Session expired',
    });
  }

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

  const requestId = res.headers.get('x-request-id') ?? res.headers.get('x-correlation-id');

  // Unauthorized — try refresh once
  if (res.status === 401 && !retried) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return apiFetch<T>(path, options, true);
    }
    // Refresh failed — clear auth state and redirect to login
    setAccessToken(null);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('gratonite_access_token');
      window.localStorage.removeItem('gratonite_user');
    }
    const fromPath = typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}${window.location.hash}`
      : '/';
    const firstExpiredTransition = transitionAuthExpired({ redirectToLogin: true, fromPath });
    if (firstExpiredTransition) {
      emitClientTelemetry({
        event: 'auth_expired_transition',
        route: typeof window !== 'undefined' ? window.location.pathname : null,
        reason: 'refresh_failed',
        timestamp: new Date().toISOString(),
      });
    }
    const body = await res.json().catch(() => ({ code: 'UNAUTHORIZED', message: 'Unauthorized' }));
    throw new ApiRequestError(401, body as ApiError, requestId);
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
    throw new ApiRequestError(res.status, body as ApiError, requestId);
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

export type ClientTelemetryEvent = {
  event:
    | 'guild_open_attempt'
    | 'guild_open_result'
    | 'guild_toast_suppressed'
    | 'auth_refresh_attempt'
    | 'auth_refresh_result'
    | 'auth_expired_transition'
    | 'auth_request_short_circuit';
  guildId?: string | null;
  route?: string | null;
  statusClass?: 'success' | 'forbidden' | 'not_found' | 'network' | 'unauthorized' | null;
  latencyMs?: number | null;
  requestId?: string | null;
  reason?: string | null;
  timestamp?: string;
};

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
  capabilities: () =>
    apiFetch<{
      routes: Record<string, boolean>;
      source: 'server';
    }>('/capabilities'),

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

    forgotPassword: (email: string) =>
      apiFetch<{ message: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),

    resetPassword: (token: string, password: string) =>
      apiFetch<{ ok: true; message: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
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
    get: (userId: string) => apiFetch<{ id: string; username: string; displayName?: string; avatarHash?: string | null }>(`/users/${userId}/profile`),

    getMe: () => {
      if (meRequestPromise) return meRequestPromise;
      meRequestPromise = apiFetch<{
      id: string;
      username: string;
      email: string;
      emailVerified: boolean;
      createdAt: string;
      isAdmin: boolean;
      onboardingCompleted: boolean;
      interests: string[] | null;
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
    }>('/users/@me').finally(() => {
      meRequestPromise = null;
    });
      return meRequestPromise;
    },

    updateProfile: (data: { displayName?: string; bio?: string; pronouns?: string; accentColor?: string; primaryColor?: string; onboardingCompleted?: boolean; interests?: string[] | null; nameplateStyle?: string }) =>
      apiFetch<any>('/users/@me', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    updateAccountBasics: (data: { username?: string; displayName?: string; email?: string }) =>
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
      apiFetch<Array<{ userId: string; status: PresenceStatus; updatedAt: string; lastSeen: number | null }>>(
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
        badges: string[];
        messageCount: number;
        createdAt: string;
      }>(`/users/${userId}/profile`),

    getMutuals: (userId: string) =>
      apiFetch<{
        mutualServers: Array<{ id: string; name: string; iconHash: string | null; nickname: string | null }>;
        mutualFriends: Array<{ id: string; username: string; displayName: string; avatarHash: string | null }>;
      }>(`/users/${userId}/mutuals`),

    getConnections: (userId: string) =>
      apiFetch<Array<{ provider: string; providerUsername: string; profileUrl: string | null }>>(`/users/${userId}/connections`),

    getNote: (userId: string) =>
      apiFetch<{ content: string }>(`/users/${userId}/note`),

    saveNote: (userId: string, content: string) =>
      apiFetch<{ success: boolean }>(`/users/${userId}/note`, {
        method: 'PUT',
        body: JSON.stringify({ content }),
      }),

    updatePresence: (status: Extract<PresenceStatus, 'online' | 'idle' | 'dnd' | 'invisible'>) =>
      apiFetch<{ status: PresenceStatus }>('/users/@me/presence', {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),

    updateCustomStatus: (data: { text: string | null; expiresAt: string | null; emoji?: string | null }) =>
      apiFetch<void>('/users/@me/status', { method: 'PATCH', body: JSON.stringify(data) }),

    // Activity
    setActivity: (data: { type: string; name: string }) =>
      apiFetch<void>('/users/@me/activity', { method: 'PATCH', body: JSON.stringify(data) }),

    clearActivity: () =>
      apiFetch<void>('/users/@me/activity', { method: 'DELETE' }),

    updateWidgets: (widgets: string[]) =>
      apiFetch<void>('/users/@me/widgets', { method: 'PATCH', body: JSON.stringify({ widgets }) }),

    changePassword: (currentPassword: string, newPassword: string) =>
      apiFetch<void>('/users/@me/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      }),

    deleteAccount: (password: string) =>
      apiFetch<void>('/users/@me', {
        method: 'DELETE',
        body: JSON.stringify({ password }),
      }),

    getSettings: () =>
      apiFetch<Record<string, unknown>>('/users/@me/settings'),

    // Guild folders
    getGuildFolders: () =>
      apiFetch<any[]>('/users/@me/guild-folders'),

    createGuildFolder: (data: { name: string; color: string; guildIds: string[] }) =>
      apiFetch<any>('/users/@me/guild-folders', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updateGuildFolder: (folderId: string, data: { name?: string; color?: string; guildIds?: string[] }) =>
      apiFetch<any>(`/users/@me/guild-folders/${folderId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    deleteGuildFolder: (folderId: string) =>
      apiFetch<void>(`/users/@me/guild-folders/${folderId}`, { method: 'DELETE' }),

    // Favorites
    getFavorites: () =>
      apiFetch<any[]>('/users/@me/favorites'),

    addFavorite: (channelId: string) =>
      apiFetch<any>(`/users/@me/favorites/${channelId}`, {
        method: 'PUT',
      }),

    removeFavorite: (channelId: string) =>
      apiFetch<void>(`/users/@me/favorites/${channelId}`, { method: 'DELETE' }),
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
      apiFetch<any>('/cosmetics', {
        method: 'POST',
        body: JSON.stringify({
          name: data.name,
          type: data.itemType,
          description: data.description,
          assetUrl: data.assetHash,
          price: (data.payload as any)?.proposedPrice ?? 0,
        }),
      }).then((r: any): CommunityShopItem => ({
        id: r.id,
        itemType: r.type,
        name: r.name,
        description: r.description,
        uploaderId: r.creatorId,
        payload: {},
        payloadSchemaVersion: 1,
        assetHash: r.assetUrl ?? null,
        tags: [],
        status: r.isPublished ? 'published' : 'draft',
        moderationNotes: null,
        rejectionCode: null,
        publishedAt: r.isPublished ? r.updatedAt : null,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        installCount: 0,
      })),

    submitForReview: (itemId: string) =>
      apiFetch<any>(`/cosmetics/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isPublished: true }),
      }).then((r: any): CommunityShopItem => ({
        id: r.id,
        itemType: r.type,
        name: r.name,
        description: r.description,
        uploaderId: r.creatorId,
        payload: {},
        payloadSchemaVersion: 1,
        assetHash: r.assetUrl ?? null,
        tags: [],
        status: 'published',
        moderationNotes: null,
        rejectionCode: null,
        publishedAt: r.updatedAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        installCount: 0,
      })),

    install: (itemId: string, _data: { scope?: 'global' | 'guild'; scopeId?: string } = {}) =>
      apiFetch<any>(`/cosmetics/${itemId}/purchase`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),

    uninstall: (_itemId: string, _data: { scope?: 'global' | 'guild'; scopeId?: string } = {}) =>
      Promise.resolve() as Promise<void>,

    getMyItems: async () => {
      const rows = await apiFetch<any[]>('/cosmetics/mine');
      return {
        created: rows.map((r: any): CommunityShopItem => ({
          id: r.id,
          itemType: r.type,
          name: r.name,
          description: r.description,
          uploaderId: r.creatorId,
          payload: {},
          payloadSchemaVersion: 1,
          assetHash: r.assetUrl ?? null,
          tags: [],
          status: r.isPublished ? 'published' : 'draft',
          moderationNotes: null,
          rejectionCode: null,
          publishedAt: r.isPublished ? r.updatedAt : null,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          installCount: 0,
        })),
        installed: [],
      };
    },
  },

  economy: {
    getWallet: () => {
      if (walletRequestPromise) return walletRequestPromise;
      walletRequestPromise = apiFetch<CurrencyWallet>('/economy/wallet').finally(() => {
        walletRequestPromise = null;
      });
      return walletRequestPromise;
    },

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
    callInvite: (channelId: string, withVideo: boolean) =>
      apiFetch<void>('/voice/call-invite', {
        method: 'POST',
        body: JSON.stringify({ channelId, withVideo }),
      }),
    callAnswer: (channelId: string) =>
      apiFetch<{ token: string; endpoint: string }>('/voice/call-answer', {
        method: 'POST',
        body: JSON.stringify({ channelId }),
      }),
    callReject: (channelId: string) =>
      apiFetch<void>('/voice/call-reject', {
        method: 'POST',
        body: JSON.stringify({ channelId }),
      }),
    callCancel: (channelId: string) =>
      apiFetch<void>('/voice/call-cancel', {
        method: 'POST',
        body: JSON.stringify({ channelId }),
      }),
  },

  guilds: {
    getMine: () => apiFetch<Guild[]>('/guilds/@me'),

    discover: (params?: { q?: string; hashtag?: string; featured?: boolean; limit?: number; offset?: number; category?: string; tag?: string; sort?: string }) => {
      const query = new URLSearchParams();
      if (params?.q) query.set('q', params.q);
      if (params?.hashtag) query.set('hashtag', params.hashtag);
      if (params?.featured !== undefined) query.set('featured', String(params.featured));
      if (params?.limit !== undefined) query.set('limit', String(params.limit));
      if (params?.offset !== undefined) query.set('offset', String(params.offset));
      if (params?.category) query.set('category', params.category);
      if (params?.tag) query.set('tag', params.tag);
      if (params?.sort) query.set('sort', params.sort);
      const suffix = query.toString() ? `?${query.toString()}` : '';
      return apiFetch<Array<{
      id: string;
      name: string;
      description: string | null;
      iconHash: string | null;
      bannerHash: string | null;
      memberCount: number;
      tags: string[];
      category: string | null;
      categories: string[];
      featured?: boolean;
      isFeatured?: boolean;
      discoverRank?: number;
      isPublic?: boolean;
      isPinned?: boolean;
      verified?: boolean;
    }>>(`/guilds/discover${suffix}`);
    },

    resolveGratoniteLounge: () =>
      apiFetch<{ id: string; name: string; slug: string; isDiscoverable: boolean; isPinned: boolean }>(
        '/guilds/lounge/gratonite',
      ),

    join: (guildId: string) =>
      apiFetch<{ id: string; name: string; memberCount: number; joined: boolean; alreadyMember: boolean }>(
        `/guilds/${guildId}/join`,
        { method: 'POST' },
      ),

    get: (guildId: string, options?: RequestInit) => apiFetch<Guild>(`/guilds/${guildId}`, options),

    getChannelsUnread: (guildId: string) =>
      apiFetch<Array<{ channelId: string; mentionCount: number; lastReadAt: string }>>(`/guilds/${guildId}/channels/unread`),

    getMembers: (
      guildId: string,
      params: { limit?: number; offset?: number; search?: string; status?: 'online' | 'offline'; groupId?: string } = {},
    ) => {
      const query = new URLSearchParams();
      if (params.limit !== undefined) query.set('limit', String(params.limit));
      if (params.offset !== undefined) query.set('offset', String(params.offset));
      if (params.search) query.set('search', params.search);
      if (params.status) query.set('status', params.status);
      if (params.groupId) query.set('groupId', params.groupId);
      const suffix = query.toString() ? `?${query.toString()}` : '';
      return apiFetch<GuildMember[]>(`/guilds/${guildId}/members${suffix}`);
    },

    getMemberGroups: (guildId: string) =>
      apiFetch<Array<{ id: string; guildId: string; name: string; color: string; position: number; memberIds: string[] }>>(
        `/guilds/${guildId}/member-groups`,
      ),

    createMemberGroup: (guildId: string, data: { name: string; color?: string; position?: number }) =>
      apiFetch<any>(`/guilds/${guildId}/member-groups`, { method: 'POST', body: JSON.stringify(data) }),

    updateMemberGroup: (guildId: string, groupId: string, data: { name?: string; color?: string; position?: number }) =>
      apiFetch<any>(`/guilds/${guildId}/member-groups/${groupId}`, { method: 'PATCH', body: JSON.stringify(data) }),

    deleteMemberGroup: (guildId: string, groupId: string) =>
      apiFetch<void>(`/guilds/${guildId}/member-groups/${groupId}`, { method: 'DELETE' }),

    assignMemberGroup: (guildId: string, groupId: string, userId: string) =>
      apiFetch<void>(`/guilds/${guildId}/member-groups/${groupId}/members/${userId}`, { method: 'PUT' }),

    removeMemberGroup: (guildId: string, groupId: string, userId: string) =>
      apiFetch<void>(`/guilds/${guildId}/member-groups/${groupId}/members/${userId}`, { method: 'DELETE' }),

    create: (data: { name: string; description?: string; isDiscoverable?: boolean; tags?: string[]; categories?: string[] }) =>
      apiFetch<Guild>('/guilds', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (guildId: string, data: { name?: string; description?: string; tags?: string[]; categories?: string[]; accentColor?: string | null }) =>
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

    createRole: (guildId: string, data: { name: string; color?: string; mentionable?: boolean; permissions?: string }) =>
      apiFetch<any>(`/guilds/${guildId}/roles`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    updateRole: (guildId: string, roleId: string, data: { name?: string; color?: string; mentionable?: boolean; permissions?: string }) =>
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

    ban: (guildId: string, userId: string, reason?: string, duration?: number) =>
      apiFetch<void>(`/guilds/${guildId}/bans/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ reason, ...(duration ? { duration } : {}) }),
      }),

    unban: (guildId: string, userId: string) =>
      apiFetch<void>(`/guilds/${guildId}/bans/${userId}`, { method: 'DELETE' }),

    kickMember: (guildId: string, userId: string) =>
      apiFetch<void>(`/guilds/${guildId}/members/${userId}`, { method: 'DELETE' }),

    timeoutMember: (guildId: string, userId: string, durationSeconds: number) =>
      apiFetch<{ success: boolean; timeoutUntil: string | null }>(`/guilds/${guildId}/members/${userId}/timeout`, {
        method: 'POST',
        body: JSON.stringify({ durationSeconds }),
      }),

    warnMember: (guildId: string, userId: string, reason: string) =>
      apiFetch<any>(`/guilds/${guildId}/members/${userId}/warnings`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),

    getMemberWarnings: (guildId: string, userId: string) =>
      apiFetch<any[]>(`/guilds/${guildId}/members/${userId}/warnings`),

    getVanityUrl: (guildId: string) =>
      apiFetch<{ code: string | null }>(`/guilds/${guildId}/vanity-url`),

    updateVanityUrl: (guildId: string, code: string) =>
      apiFetch<{ code: string }>(`/guilds/${guildId}/vanity-url`, {
        method: 'PATCH',
        body: JSON.stringify({ code }),
      }),

    getTemplates: (guildId: string) =>
      apiFetch<any[]>(`/guilds/${guildId}/templates`),

    createTemplate: (guildId: string, data: { name: string; description?: string }) =>
      apiFetch<any>(`/guilds/${guildId}/templates`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    syncTemplate: (guildId: string, templateId: string) =>
      apiFetch<any>(`/guilds/${guildId}/templates/${templateId}`, { method: 'PATCH' }),

    deleteTemplate: (guildId: string, templateId: string) =>
      apiFetch<void>(`/guilds/${guildId}/templates/${templateId}`, { method: 'DELETE' }),

    createFromTemplate: (code: string) =>
      apiFetch<any>(`/guilds/templates/${code}`, { method: 'POST' }),

    boost: (guildId: string) =>
      apiFetch<any>(`/guilds/${guildId}/boost`, { method: 'POST' }),

    removeBoost: (guildId: string) =>
      apiFetch<void>(`/guilds/${guildId}/boost`, { method: 'DELETE' }),

    getCommands: (guildId: string) =>
      apiFetch<any[]>(`/guilds/${guildId}/commands`),

    getAuditLog: (guildId: string, params?: { limit?: number; offset?: number; action?: string; userId?: string }) => {
      const q = new URLSearchParams();
      if (params?.limit) q.set('limit', String(params.limit));
      if (params?.offset) q.set('offset', String(params.offset));
      if (params?.action) q.set('action', params.action);
      if (params?.userId) q.set('userId', params.userId);
      return apiFetch<{ items: any[] }>(`/guilds/${guildId}/audit-log?${q}`);
    },

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

    rate: (guildId: string, rating: number) =>
      apiFetch<{ ok: boolean }>(`/guilds/${guildId}/rating`, {
        method: 'POST',
        body: JSON.stringify({ rating }),
      }),

    getRating: (guildId: string) =>
      apiFetch<{ averageRating: number; totalRatings: number; userRating: number | null }>(`/guilds/${guildId}/rating`),
  },

  channels: {
    getGuildChannels: (guildId: string, options?: RequestInit) =>
      apiFetch<Channel[]>(`/guilds/${guildId}/channels`, options),

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
    ) => {
      const normalizedType = (() => {
        const raw = String(data.type ?? 'GUILD_TEXT').trim().toUpperCase().replace(/-/g, '_');
        if (raw === 'TEXT' || raw === 'GUILD_TEXT') return 'GUILD_TEXT';
        if (raw === 'VOICE' || raw === 'GUILD_VOICE') return 'GUILD_VOICE';
        if (raw === 'CATEGORY' || raw === 'GUILD_CATEGORY') return 'GUILD_CATEGORY';
        return raw;
      })();

      const normalizedName = data.name
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 100);

      return apiFetch<Channel>(`/guilds/${guildId}/channels`, {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          name: normalizedName || 'channel',
          type: normalizedType,
        }),
      });
    },

    update: (channelId: string, data: { name?: string; topic?: string; nsfw?: boolean; rateLimitPerUser?: number; backgroundUrl?: string | null; backgroundType?: 'image' | 'video' | null; isAnnouncement?: boolean }) =>
      apiFetch<Channel>(`/channels/${channelId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    follow: (channelId: string, targetChannelId?: string) =>
      apiFetch<any>(`/channels/${channelId}/followers`, {
        method: 'POST',
        body: JSON.stringify({ targetChannelId }),
      }),

    crosspost: (channelId: string, messageId: string) =>
      apiFetch<any>(`/channels/${channelId}/messages/${messageId}/crosspost`, { method: 'POST' }),

    getCallHistory: (channelId: string) =>
      apiFetch<any[]>(`/channels/${channelId}/call-history`),

    delete: (channelId: string) =>
      apiFetch<void>(`/channels/${channelId}`, { method: 'DELETE' }),

    updatePositions: (guildId: string, positions: Array<{ id: string; position: number; parentId?: string | null }>) =>
      apiFetch<void>(`/guilds/${guildId}/channels/positions`, {
        method: 'PATCH',
        body: JSON.stringify(positions),
      }),

    getPermissionOverrides: (channelId: string) =>
      apiFetch<Array<{ id: string; channelId: string; targetId: string; targetType: 'role' | 'member'; allow: string; deny: string }>>(
        `/channels/${channelId}/permissions`,
      ),

    setPermissionOverride: (
      channelId: string,
      targetId: string,
      data: { targetType: 'role' | 'member'; allow: string; deny: string },
    ) =>
      apiFetch<{ id: string; channelId: string; targetId: string; targetType: 'role' | 'member'; allow: string; deny: string }>(
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

    duplicate: (channelId: string) =>
      apiFetch<Channel>(`/channels/${channelId}/duplicate`, { method: 'POST' }),

    getNotificationPrefs: (channelId: string) =>
      apiFetch<{ level: string; mutedUntil: string | null }>(`/channels/${channelId}/notification-prefs`),

    setNotificationPrefs: (channelId: string, data: { level: 'all' | 'mentions' | 'none' | 'default'; mutedUntil?: string | null }) =>
      apiFetch<any>(`/channels/${channelId}/notification-prefs`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },

  messages: {
    list: (channelId: string, params?: CursorPaginationParams) =>
      apiFetch<Message[]>(
        `/channels/${channelId}/messages${params ? '?' + buildQuery(params) : ''}`,
      ),

    send: (channelId: string, data: { content?: string | null; nonce?: string; messageReference?: { messageId: string }; attachmentIds?: string[]; replyToId?: string; threadId?: string; expiresIn?: number; isEncrypted?: boolean; encryptedContent?: string; keyVersion?: number }) =>
      apiFetch<Message>(`/channels/${channelId}/messages`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    edit: (channelId: string, messageId: string, data: { content?: string; encryptedContent?: string; isEncrypted?: boolean; keyVersion?: number }) =>
      apiFetch<Message>(`/channels/${channelId}/messages/${messageId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    delete: (channelId: string, messageId: string) =>
      apiFetch<void>(`/channels/${channelId}/messages/${messageId}`, {
        method: 'DELETE',
      }),

    bulkDelete: (channelId: string, ids: string[]) =>
      apiFetch<{ deleted: number }>(`/channels/${channelId}/messages/bulk`, {
        method: 'DELETE',
        body: JSON.stringify({ ids }),
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

    startTyping: (channelId: string) =>
      apiFetch<void>(`/channels/${channelId}/messages/typing`, { method: 'POST' }),

    markRead: (channelId: string, lastReadMessageId?: string) =>
      apiFetch<{ ok: boolean }>(`/channels/${channelId}/messages/read`, { method: 'POST', body: JSON.stringify(lastReadMessageId ? { lastReadMessageId } : {}) }),

    ack: (channelId: string, lastMessageId?: string) =>
      apiFetch<void>(`/channels/${channelId}/messages/ack`, { method: 'POST', body: JSON.stringify(lastMessageId ? { lastMessageId } : {}) }),

    getReadState: (channelId: string) =>
      apiFetch<{ userId: string; lastReadAt: string; lastReadMessageId: string | null }[]>(`/channels/${channelId}/messages/read-state`),

    setDisappearTimer: (channelId: string, seconds: number | null) =>
      apiFetch<{ disappearTimer: number | null }>(`/channels/${channelId}/messages/disappear-timer`, { method: 'PATCH', body: JSON.stringify({ seconds }) }),
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
    create: (channelId: string, data: { name: string; body?: string; type?: string; archiveAfter?: number; message?: string; messageId?: string }) =>
      apiFetch<Thread>(`/channels/${channelId}/threads`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    list: (channelId: string, sort?: string) =>
      apiFetch<Thread[]>(`/channels/${channelId}/threads${sort ? `?sort=${sort}` : ''}`),

    get: (threadId: string) =>
      apiFetch<Thread>(`/threads/${threadId}`),

    listMessages: (threadId: string, limit?: number) =>
      apiFetch<Message[]>(`/threads/${threadId}/messages${limit ? `?limit=${limit}` : ''}`),

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
      apiFetch<{ code: string; expiresAt: string | null }>(`/guilds/${guildId}/invites`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    list: (guildId: string) =>
      apiFetch<InviteInfo[]>(`/guilds/${guildId}/invites`),

    delete: (code: string) =>
      apiFetch<void>(`/invites/${code}`, { method: 'DELETE' }),
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

  groupDms: {
    create: (userIds: string[], name?: string) =>
      apiFetch<any>('/dms/group', {
        method: 'POST',
        body: JSON.stringify({ userIds, name }),
      }),

    addMember: (channelId: string, userId: string) =>
      apiFetch<any>(`/dms/group/${channelId}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId }),
      }),

    removeMember: (channelId: string, userId: string) =>
      apiFetch<any>(`/dms/group/${channelId}/members/${userId}`, {
        method: 'DELETE',
      }),

    update: (channelId: string, data: { groupName?: string; groupIcon?: string }) =>
      apiFetch<any>(`/dms/group/${channelId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },

  messageRequests: {
    list: (bucket: 'requests' | 'spam' = 'requests') =>
      apiFetch<Array<{
        id: string;
        user: {
          id: string;
          username: string;
          displayName: string;
          avatarHash: string | null;
        };
        isSpam: boolean;
        preview: string;
        createdAt: string;
        mutualServers: number;
      }>>(`/relationships/message-requests?bucket=${bucket}`),

    accept: (userId: string) =>
      apiFetch<{ code: string; message: string }>(`/relationships/message-requests/${userId}/accept`, {
        method: 'POST',
      }),

    ignore: (userId: string) =>
      apiFetch<{ code: string; message: string }>(`/relationships/message-requests/${userId}/ignore`, {
        method: 'POST',
      }),

    report: (userId: string) =>
      apiFetch<{ code: string; message: string }>(`/relationships/message-requests/${userId}/report`, {
        method: 'POST',
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
    getItems: () => apiFetch<ShopItem[]>('/shop/items'),
    getInventory: () => apiFetch<any[]>('/shop/inventory'),
    purchase: (itemId: string, idempotencyKey?: string) => apiFetch<any>('/shop/purchase', {
      method: 'POST',
      body: JSON.stringify({ itemId, idempotencyKey }),
    }),
    equipItem: async (itemId: string) => {
      let lastErr: unknown;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          return await apiFetch<any>(`/shop/items/${itemId}/equip`, { method: 'PATCH' });
        } catch (err: any) {
          lastErr = err;
          const retriable = err instanceof ApiRequestError && err.status >= 500;
          if (!retriable || attempt === 2) break;
          await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
        }
      }
      throw lastErr;
    },
    unequipItem: (itemId: string) => apiFetch<void>(`/shop/items/${itemId}/equip`, { method: 'DELETE' }),
  },

  inventory: {
    get: () => apiFetch<{ items: InventoryItem[] }>('/inventory'),
  },

  auctions: {
    list: (params?: { type?: string; sort?: string; search?: string; limit?: number; offset?: number }) => {
      const qs = new URLSearchParams();
      if (params?.type) qs.set('type', params.type);
      if (params?.sort) qs.set('sort', params.sort);
      if (params?.search) qs.set('search', params.search);
      if (params?.limit) qs.set('limit', String(params.limit));
      if (params?.offset) qs.set('offset', String(params.offset));
      const query = qs.toString();
      return apiFetch<any[]>(`/auctions${query ? `?${query}` : ''}`);
    },
    get: (auctionId: string) => apiFetch<any>(`/auctions/${auctionId}`),
    create: (data: { cosmeticId: string; startingPrice: number; reservePrice?: number; durationHours: number }) =>
      apiFetch<any>('/auctions', { method: 'POST', body: JSON.stringify(data) }),
    bid: (auctionId: string, amount: number) =>
      apiFetch<any>(`/auctions/${auctionId}/bid`, { method: 'POST', body: JSON.stringify({ amount }) }),
    cancel: (auctionId: string) =>
      apiFetch<void>(`/auctions/${auctionId}`, { method: 'DELETE' }),
  },

  marketplace: {
    listItem: (data: {
      name: string;
      description?: string;
      type: 'avatar_frame' | 'decoration' | 'profile_effect' | 'nameplate' | 'soundboard';
      price: number;
      previewImageUrl?: string;
      assetUrl?: string;
      category?: string;
      metadata?: Record<string, unknown>;
    }) => apiFetch<{ listingId: string; createdAt: string }>('/marketplace/listings', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  },

  botApplications: {
    create: (data: { name: string; description?: string; webhookUrl: string; avatarHash?: string }) =>
      apiFetch<any>('/bots/applications', { method: 'POST', body: JSON.stringify(data) }),
    listMine: () => apiFetch<any[]>('/bots/applications/mine'),
    get: (id: string) => apiFetch<any>(`/bots/applications/${id}`),
    update: (id: string, data: { name?: string; description?: string; webhookUrl?: string; isActive?: boolean }) =>
      apiFetch<any>(`/bots/applications/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch<void>(`/bots/applications/${id}`, { method: 'DELETE' }),
    rotate: (id: string) => apiFetch<{ apiToken: string }>(`/bots/applications/${id}/rotate`, { method: 'POST' }),
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
      apiFetch<any>(`/polls/${pollId}/answers`, {
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
        fameReceived: number;
        memberSince: string;
      }>>(`/leaderboard?period=${period}`),
    getGuild: (guildId: string, period: 'week' | 'month' | 'all' = 'week') =>
      apiFetch<Array<{
        rank: number;
        userId: string;
        username: string;
        displayName: string;
        avatarHash: string | null;
        fameReceived: number;
        memberSince: string;
      }>>(`/guilds/${guildId}/leaderboard?period=${period}`),
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
    // ── Submit for review ─────────────────────────────────────────────────
    submitForReview: (cosmeticId: string) =>
      apiFetch<any>(`/cosmetics/${cosmeticId}/submit`, { method: 'PATCH' }),
    // ── Upload asset ──────────────────────────────────────────────────────
    uploadAsset: (cosmeticId: string, file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiFetch<{ assetUrl: string }>(`/cosmetics/${cosmeticId}/upload`, {
        method: 'POST',
        body: formData,
      });
    },
    // ── Equip cosmetic (alias) ─────────────────────────────────────────────
    equipCosmetic: (cosmeticId: string) =>
      apiFetch<any>(`/cosmetics/${cosmeticId}/equip`, { method: 'PATCH' }),
  },

  // ── Bot Store ──────────────────────────────────────────────────────────
  botStore: {
    list: (params?: { category?: string; verified?: boolean; search?: string; limit?: number; offset?: number }) => {
      const q = new URLSearchParams();
      if (params?.category) q.set('category', params.category);
      if (params?.verified !== undefined) q.set('verified', String(params.verified));
      if (params?.search) q.set('search', params.search);
      if (params?.limit) q.set('limit', String(params.limit));
      if (params?.offset) q.set('offset', String(params.offset));
      return apiFetch<{ items: any[] }>(`/bot-store?${q}`);
    },
    get: (listingId: string) => apiFetch<any>(`/bot-store/${listingId}`),
    reviews: (listingId: string, limit = 25, offset = 0) =>
      apiFetch<{ items: any[] }>(`/bot-store/${listingId}/reviews?limit=${limit}&offset=${offset}`),
    postReview: (listingId: string, data: { rating: number; content: string }) =>
      apiFetch<any>(`/bot-store/${listingId}/reviews`, { method: 'POST', body: JSON.stringify(data) }),
    updateReview: (listingId: string, reviewId: string, data: { rating?: number; content?: string }) =>
      apiFetch<any>(`/bot-store/${listingId}/reviews/${reviewId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteReview: (listingId: string, reviewId: string) =>
      apiFetch<void>(`/bot-store/${listingId}/reviews/${reviewId}`, { method: 'DELETE' }),
    // Developer listing management
    createListing: (data: { applicationId?: string; name?: string; shortDescription: string; longDescription?: string; category: string; tags?: string[]; iconUrl?: string; bannerUrl?: string }) =>
      apiFetch<any>('/bot-store/listings', { method: 'POST', body: JSON.stringify(data) }),
    updateListing: (listingId: string, data: { shortDescription?: string; longDescription?: string; category?: string; tags?: string[]; listed?: boolean }) =>
      apiFetch<any>(`/bot-store/listings/${listingId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteListing: (listingId: string) =>
      apiFetch<void>(`/bot-store/listings/${listingId}`, { method: 'DELETE' }),
    developerListings: () => apiFetch<{ items: any[] }>('/bot-store/listings/mine'),
  },

  // ── Bot Installs ───────────────────────────────────────────────────────
  botInstalls: {
    list: (guildId: string) =>
      apiFetch<any[]>(`/bots/installs/${guildId}`),
    install: (guildId: string, applicationId: string) =>
      apiFetch<any>('/bots/installs', { method: 'POST', body: JSON.stringify({ guildId, applicationId }) }),
    uninstall: (guildId: string, appId: string) =>
      apiFetch<any>(`/bots/installs/${guildId}/${appId}`, { method: 'DELETE' }),
    listBotGuilds: (appId: string) =>
      apiFetch<any[]>(`/bots/${appId}/installs`),
  },

  // ── Webhooks ───────────────────────────────────────────────────────────
  webhooks: {
    listByGuild: (guildId: string) =>
      apiFetch<any[]>(`/guilds/${guildId}/webhooks`),
    listByChannel: (channelId: string) =>
      apiFetch<any[]>(`/webhooks/channel/${channelId}`),
    create: (data: { channelId: string; name: string; avatarUrl?: string }) =>
      apiFetch<any>(`/channels/${data.channelId}/webhooks`, { method: 'POST', body: JSON.stringify({ name: data.name, avatarUrl: data.avatarUrl }) }),
    delete: (webhookId: string) =>
      apiFetch<void>(`/webhooks/${webhookId}`, { method: 'DELETE' }),
  },

  // ── Admin: Team ────────────────────────────────────────────────────────
  adminTeam: {
    list: () => apiFetch<{ items: any[] }>('/admin/team'),
    invite: (data: { email: string; role: 'admin' | 'moderator' | 'support' }) =>
      apiFetch<any>('/admin/team/invite', { method: 'POST', body: JSON.stringify(data) }),
    acceptInvite: (token: string) =>
      apiFetch<any>('/admin/team/accept', { method: 'POST', body: JSON.stringify({ token }) }),
    updateRole: (userId: string, role: 'admin' | 'moderator' | 'support') =>
      apiFetch<any>(`/admin/team/${userId}`, { method: 'PATCH', body: JSON.stringify({ role }) }),
    remove: (userId: string) =>
      apiFetch<any>(`/admin/team/${userId}`, { method: 'DELETE' }),
  },

  // ── Admin: Audit Log ───────────────────────────────────────────────────
  adminAudit: {
    list: (params?: { limit?: number; offset?: number }) => {
      const q = new URLSearchParams();
      if (params?.limit) q.set('limit', String(params.limit));
      if (params?.offset) q.set('offset', String(params.offset));
      return apiFetch<{ items: any[] }>(`/admin/audit-log?${q}`);
    },
  },

  // ── Admin: Bot Store Moderation ────────────────────────────────────────
  adminBotStore: {
    list: (params?: { limit?: number; offset?: number }) => {
      const q = new URLSearchParams();
      if (params?.limit) q.set('limit', String(params.limit));
      if (params?.offset) q.set('offset', String(params.offset));
      return apiFetch<{ items: any[] }>(`/admin/bot-store?${q}`);
    },
    toggleVerified: (listingId: string) =>
      apiFetch<any>(`/admin/bot-store/${listingId}/verify`, { method: 'PATCH' }),
    forceDelist: (listingId: string) =>
      apiFetch<any>(`/admin/bot-store/${listingId}/delist`, { method: 'PATCH' }),
    deleteReview: (reviewId: string) =>
      apiFetch<void>(`/admin/bot-store/reviews/${reviewId}`, { method: 'DELETE' }),
  },

  // ── Feedback ───────────────────────────────────────────────────────────
  feedback: {
    submit: (data: { category: string; title: string; body: string }) =>
      apiFetch<any>('/feedback', { method: 'POST', body: JSON.stringify(data) }),
    mine: () => apiFetch<{ items: any[] }>('/feedback/mine'),
    // Admin
    list: (params?: { status?: string; category?: string; limit?: number; offset?: number }) => {
      const q = new URLSearchParams();
      if (params?.status) q.set('status', params.status);
      if (params?.category) q.set('category', params.category);
      if (params?.limit) q.set('limit', String(params.limit));
      if (params?.offset) q.set('offset', String(params.offset));
      return apiFetch<{ items: any[] }>(`/admin/feedback?${q}`);
    },
    updateStatus: (feedbackId: string, data: { status?: string; adminNotes?: string }) =>
      apiFetch<any>(`/admin/feedback/${feedbackId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },

  // ── Reports ────────────────────────────────────────────────────────────
  reports: {
    submit: (data: { targetType: 'message' | 'user' | 'guild' | 'bot' | 'channel'; targetId: string; reason: string; details?: string }) =>
      apiFetch<any>('/reports', { method: 'POST', body: JSON.stringify(data) }),
    // Admin
    list: (params?: { status?: string; targetType?: string; limit?: number; offset?: number }) => {
      const q = new URLSearchParams();
      if (params?.status) q.set('status', params.status);
      if (params?.targetType) q.set('targetType', params.targetType);
      if (params?.limit) q.set('limit', String(params.limit));
      if (params?.offset) q.set('offset', String(params.offset));
      return apiFetch<{ items: any[] }>(`/admin/reports?${q}`);
    },
    updateStatus: (reportId: string, data: { status?: string; adminNotes?: string }) =>
      apiFetch<any>(`/admin/reports/${reportId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },

  adminPortals: {
    list: () =>
      apiFetch<{ items: Array<{
        id: string;
        name: string;
        description: string | null;
        iconHash: string | null;
        memberCount: number;
        isDiscoverable: boolean;
        isFeatured: boolean;
        isPinned: boolean;
        discoverRank: number;
        createdAt: string;
      }> }>('/admin/portals'),
    update: (guildId: string, data: { isPinned?: boolean; isFeatured?: boolean; isPublic?: boolean }) =>
      apiFetch<any>(`/admin/portals/${guildId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },

  telemetry: {
    captureClientEvent: (payload: ClientTelemetryEvent) =>
      apiFetch<{ ok: true }>('/telemetry/client-events', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },

  notifications: {
    list: (limit = 50) =>
      apiFetch<{ id: string; type: string; senderId: string | null; senderName: string | null; channelId: string | null; guildId: string | null; content: string; preview: string | null; read: boolean; createdAt: string }[]>(`/notifications?limit=${limit}`),

    markRead: (notificationId: string) =>
      apiFetch<void>(`/notifications/${notificationId}/read`, { method: 'POST' }),

    markAllRead: () =>
      apiFetch<void>('/notifications/read-all', { method: 'POST' }),

    dismiss: (notificationId: string) =>
      apiFetch<void>(`/notifications/${notificationId}`, { method: 'DELETE' }),

    clearAll: () =>
      apiFetch<void>('/notifications', { method: 'DELETE' }),
  },

  workflows: {
    list: (guildId: string) =>
      apiFetch<any[]>(`/guilds/${guildId}/workflows`),

    create: (guildId: string, data: { name: string; triggers: Array<{ type: string; config?: Record<string, unknown> }>; actions: Array<{ order: number; type: string; config?: Record<string, unknown> }> }) =>
      apiFetch<any>(`/guilds/${guildId}/workflows`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    update: (guildId: string, workflowId: string, data: { name?: string; enabled?: boolean; triggers?: Array<{ type: string; config?: Record<string, unknown> }>; actions?: Array<{ order: number; type: string; config?: Record<string, unknown> }> }) =>
      apiFetch<any>(`/guilds/${guildId}/workflows/${workflowId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    delete: (guildId: string, workflowId: string) =>
      apiFetch<void>(`/guilds/${guildId}/workflows/${workflowId}`, { method: 'DELETE' }),
  },

  fame: {
    give: (userId: string, data: { messageId?: string; guildId: string; channelId?: string }) =>
      apiFetch<{ success: boolean; fameGiven: number; remaining: number }>(`/users/${userId}/fame`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    getStats: (userId: string) =>
      apiFetch<{ fameReceived: number; fameGiven: number }>(`/users/${userId}/fame`),
  },

  stage: {
    getSession: (channelId: string) =>
      apiFetch<{ session: { id: string; channelId: string; hostId: string | null; topic: string | null; startedAt: string; endedAt: string | null } | null; speakers: Array<{ id: string; sessionId: string; userId: string; invitedBy: string | null; joinedAt: string }> }>(
        `/channels/${channelId}/stage`,
      ),

    startSession: (channelId: string, data?: { topic?: string }) =>
      apiFetch<{ session: { id: string; channelId: string; hostId: string | null; topic: string | null; startedAt: string; endedAt: string | null }; speakers: Array<unknown> }>(
        `/channels/${channelId}/stage/start`,
        { method: 'POST', body: JSON.stringify(data ?? {}) },
      ),

    endSession: (channelId: string) =>
      apiFetch<{ session: { id: string; endedAt: string | null } }>(`/channels/${channelId}/stage`, { method: 'DELETE' }),

    inviteSpeaker: (channelId: string, userId: string) =>
      apiFetch<{ speaker: unknown }>(`/channels/${channelId}/stage/speakers`, {
        method: 'POST',
        body: JSON.stringify({ userId }),
      }),

    removeSpeaker: (channelId: string, userId: string) =>
      apiFetch<void>(`/channels/${channelId}/stage/speakers/${userId}`, { method: 'DELETE' }),

    raiseHand: (channelId: string) =>
      apiFetch<{ code: string }>(`/channels/${channelId}/stage/request-speak`, { method: 'POST', body: JSON.stringify({}) }),
  },

  stickers: {
    getDefault: () => apiFetch<any[]>('/stickers/default'),
    getGuildStickers: (guildId: string) => apiFetch<any[]>(`/guilds/${guildId}/stickers`),
  },

  push: {
    getVapidPublicKey: () => apiFetch<{ key: string }>('/push/vapid-public-key'),
    subscribe: (sub: any) => apiFetch<any>('/push/subscribe', { method: 'POST', body: JSON.stringify(sub) }),
    unsubscribe: (endpoint: string) => apiFetch<any>('/push/subscribe', { method: 'DELETE', body: JSON.stringify({ endpoint }) }),
  },

  // === Wave 25 Features ===

  reactionRoles: {
    list: (guildId: string) => apiFetch<any[]>(`/guilds/${guildId}/reaction-roles`),
    create: (guildId: string, data: { messageId: string; channelId: string; mode: string; mappings: Array<{ emoji: string; roleId: string }> }) =>
      apiFetch<any>(`/guilds/${guildId}/reaction-roles`, { method: 'POST', body: JSON.stringify(data) }),
    delete: (guildId: string, id: string) =>
      apiFetch<void>(`/guilds/${guildId}/reaction-roles/${id}`, { method: 'DELETE' }),
    apply: (guildId: string, id: string, data: { emoji: string; userId: string }) =>
      apiFetch<any>(`/guilds/${guildId}/reaction-roles/${id}/apply`, { method: 'POST', body: JSON.stringify(data) }),
  },

  stickyMessages: {
    get: (channelId: string) => apiFetch<any>(`/channels/${channelId}/sticky`),
    set: (channelId: string, data: { content: string }) =>
      apiFetch<any>(`/channels/${channelId}/sticky`, { method: 'POST', body: JSON.stringify(data) }),
    remove: (channelId: string) =>
      apiFetch<void>(`/channels/${channelId}/sticky`, { method: 'DELETE' }),
  },

  reminders: {
    create: (data: { messageId: string; channelId: string; guildId?: string; remindAt: string; note?: string }) =>
      apiFetch<any>('/reminders', { method: 'POST', body: JSON.stringify(data) }),
    list: () => apiFetch<any[]>('/reminders'),
    delete: (id: string) => apiFetch<void>(`/reminders/${id}`, { method: 'DELETE' }),
  },

  starboard: {
    getConfig: (guildId: string) => apiFetch<any>(`/guilds/${guildId}/starboard/config`),
    setConfig: (guildId: string, data: { targetChannelId: string; emoji?: string; threshold?: number; enabled?: boolean }) =>
      apiFetch<any>(`/guilds/${guildId}/starboard/config`, { method: 'PUT', body: JSON.stringify(data) }),
    list: (guildId: string) => apiFetch<any[]>(`/guilds/${guildId}/starboard`),
    check: (guildId: string, data: { messageId: string; reactionCount: number }) =>
      apiFetch<any>(`/guilds/${guildId}/starboard/check`, { method: 'POST', body: JSON.stringify(data) }),
  },

  autoRoles: {
    list: (guildId: string) => apiFetch<any[]>(`/guilds/${guildId}/auto-roles`),
    create: (guildId: string, data: { roleId: string; triggerType: string; triggerValue: number }) =>
      apiFetch<any>(`/guilds/${guildId}/auto-roles`, { method: 'POST', body: JSON.stringify(data) }),
    update: (guildId: string, id: string, data: any) =>
      apiFetch<any>(`/guilds/${guildId}/auto-roles/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (guildId: string, id: string) =>
      apiFetch<void>(`/guilds/${guildId}/auto-roles/${id}`, { method: 'DELETE' }),
  },

  showcase: {
    get: (userId: string) => apiFetch<any[]>(`/users/${userId}/showcase`),
    set: (items: Array<{ slot: number; itemType: string; referenceId: string }>) =>
      apiFetch<any>('/users/@me/showcase', { method: 'PUT', body: JSON.stringify({ items }) }),
    removeSlot: (slot: number) =>
      apiFetch<void>(`/users/@me/showcase/${slot}`, { method: 'DELETE' }),
  },

  friendshipStreaks: {
    getStreak: (friendId: string) => apiFetch<any>(`/relationships/${friendId}/streak`),
    listStreaks: () => apiFetch<any[]>('/relationships/streaks'),
    getMilestones: (friendId: string) => apiFetch<any[]>(`/relationships/${friendId}/milestones`),
    interact: (friendId: string) =>
      apiFetch<any>(`/relationships/${friendId}/interact`, { method: 'POST', body: '{}' }),
  },

  interestTags: {
    listTags: () => apiFetch<any[]>('/interest-tags'),
    getMyInterests: () => apiFetch<any[]>('/users/@me/interests'),
    setInterests: (tags: string[]) =>
      apiFetch<any>('/users/@me/interests', { method: 'PUT', body: JSON.stringify({ tags }) }),
    getMatches: (guildId: string) => apiFetch<any[]>(`/guilds/${guildId}/interest-matches`),
  },

  greetingCards: {
    getTemplates: () => apiFetch<any[]>('/greeting-cards/templates'),
    send: (data: { templateId: string; recipientId: string; message: string; stickers?: any[] }) =>
      apiFetch<any>('/greeting-cards', { method: 'POST', body: JSON.stringify(data) }),
    getInbox: () => apiFetch<any[]>('/greeting-cards/inbox'),
    markViewed: (id: string) =>
      apiFetch<any>(`/greeting-cards/${id}/view`, { method: 'PATCH' }),
  },

  textReactions: {
    add: (channelId: string, messageId: string, text: string) =>
      apiFetch<any>(`/channels/${channelId}/messages/${messageId}/text-reactions`, { method: 'POST', body: JSON.stringify({ text }) }),
    remove: (channelId: string, messageId: string, text: string) =>
      apiFetch<void>(`/channels/${channelId}/messages/${messageId}/text-reactions/${encodeURIComponent(text)}`, { method: 'DELETE' }),
    get: (channelId: string, messageId: string) =>
      apiFetch<any[]>(`/channels/${channelId}/messages/${messageId}/text-reactions`),
    popular: (guildId: string) => apiFetch<any[]>(`/guilds/${guildId}/text-reactions/popular`),
  },

  timeline: {
    get: (guildId: string, params?: { before?: string; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.before) qs.set('before', params.before);
      if (params?.limit) qs.set('limit', String(params.limit));
      return apiFetch<any[]>(`/guilds/${guildId}/timeline?${qs.toString()}`);
    },
    addEvent: (guildId: string, data: { title: string; description?: string; iconUrl?: string }) =>
      apiFetch<any>(`/guilds/${guildId}/timeline`, { method: 'POST', body: JSON.stringify(data) }),
    deleteEvent: (guildId: string, id: string) =>
      apiFetch<void>(`/guilds/${guildId}/timeline/${id}`, { method: 'DELETE' }),
  },

  tickets: {
    list: (guildId: string, params?: { status?: string; assignee?: string }) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set('status', params.status);
      if (params?.assignee) qs.set('assignee', params.assignee);
      return apiFetch<any[]>(`/guilds/${guildId}/tickets?${qs.toString()}`);
    },
    create: (guildId: string, data: { subject: string; priority?: string }) =>
      apiFetch<any>(`/guilds/${guildId}/tickets`, { method: 'POST', body: JSON.stringify(data) }),
    update: (guildId: string, id: string, data: any) =>
      apiFetch<any>(`/guilds/${guildId}/tickets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    close: (guildId: string, id: string) =>
      apiFetch<any>(`/guilds/${guildId}/tickets/${id}/close`, { method: 'POST', body: '{}' }),
    getConfig: (guildId: string) => apiFetch<any>(`/guilds/${guildId}/tickets/config`),
    setConfig: (guildId: string, data: any) =>
      apiFetch<any>(`/guilds/${guildId}/tickets/config`, { method: 'PUT', body: JSON.stringify(data) }),
  },

  giveaways: {
    list: (guildId: string, status?: string) =>
      apiFetch<any[]>(`/guilds/${guildId}/giveaways${status ? `?status=${status}` : ''}`),
    create: (guildId: string, data: { channelId: string; prize: string; description?: string; winnersCount: number; endsAt: string; requiredRoleId?: string }) =>
      apiFetch<any>(`/guilds/${guildId}/giveaways`, { method: 'POST', body: JSON.stringify(data) }),
    enter: (guildId: string, id: string) =>
      apiFetch<any>(`/guilds/${guildId}/giveaways/${id}/enter`, { method: 'POST', body: '{}' }),
    leave: (guildId: string, id: string) =>
      apiFetch<void>(`/guilds/${guildId}/giveaways/${id}/enter`, { method: 'DELETE' }),
    end: (guildId: string, id: string) =>
      apiFetch<any>(`/guilds/${guildId}/giveaways/${id}/end`, { method: 'POST', body: '{}' }),
    reroll: (guildId: string, id: string) =>
      apiFetch<any>(`/guilds/${guildId}/giveaways/${id}/reroll`, { method: 'POST', body: '{}' }),
    cancel: (guildId: string, id: string) =>
      apiFetch<void>(`/guilds/${guildId}/giveaways/${id}`, { method: 'DELETE' }),
  },

  onboarding: {
    getConfig: (guildId: string) => apiFetch<any>(`/guilds/${guildId}/onboarding/config`),
    setConfig: (guildId: string, data: any) =>
      apiFetch<any>(`/guilds/${guildId}/onboarding/config`, { method: 'PUT', body: JSON.stringify(data) }),
    complete: (guildId: string, selections: any) =>
      apiFetch<any>(`/guilds/${guildId}/onboarding/complete`, { method: 'POST', body: JSON.stringify({ selections }) }),
    getStatus: (guildId: string) => apiFetch<any>(`/guilds/${guildId}/onboarding/status`),
  },

  guildLog: {
    getConfig: (guildId: string) => apiFetch<any>(`/guilds/${guildId}/log-config`),
    setConfig: (guildId: string, data: { channelId: string; events: string[] }) =>
      apiFetch<any>(`/guilds/${guildId}/log-config`, { method: 'PUT', body: JSON.stringify(data) }),
  },

  guildDigest: {
    getConfig: (guildId: string) => apiFetch<any>(`/guilds/${guildId}/digest/config`),
    setConfig: (guildId: string, data: any) =>
      apiFetch<any>(`/guilds/${guildId}/digest/config`, { method: 'PUT', body: JSON.stringify(data) }),
    preview: (guildId: string) => apiFetch<any>(`/guilds/${guildId}/digest/preview`),
    list: (guildId: string) => apiFetch<any[]>(`/guilds/${guildId}/digest/history`),
  },

  musicRooms: {
    get: (channelId: string) => apiFetch<any>(`/channels/${channelId}/music`),
    updateSettings: (channelId: string, data: { mode?: string; volume?: number }) =>
      apiFetch<any>(`/channels/${channelId}/music/settings`, { method: 'PUT', body: JSON.stringify(data) }),
    addTrack: (channelId: string, data: { url: string; title: string; thumbnail?: string; duration?: number }) =>
      apiFetch<any>(`/channels/${channelId}/music/queue`, { method: 'POST', body: JSON.stringify(data) }),
    removeTrack: (channelId: string, id: string) =>
      apiFetch<void>(`/channels/${channelId}/music/queue/${id}`, { method: 'DELETE' }),
    skip: (channelId: string) =>
      apiFetch<any>(`/channels/${channelId}/music/skip`, { method: 'POST', body: '{}' }),
    next: (channelId: string) =>
      apiFetch<any>(`/channels/${channelId}/music/next`, { method: 'POST', body: '{}' }),
  },

  whiteboards: {
    list: (channelId: string) => apiFetch<any[]>(`/channels/${channelId}/whiteboards`),
    create: (channelId: string, data?: { name?: string }) =>
      apiFetch<any>(`/channels/${channelId}/whiteboards`, { method: 'POST', body: JSON.stringify(data ?? {}) }),
    get: (channelId: string, id: string) => apiFetch<any>(`/channels/${channelId}/whiteboards/${id}`),
    save: (channelId: string, id: string, data: { data: any; name?: string }) =>
      apiFetch<any>(`/channels/${channelId}/whiteboards/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (channelId: string, id: string) =>
      apiFetch<void>(`/channels/${channelId}/whiteboards/${id}`, { method: 'DELETE' }),
  },

  moodBoard: {
    get: (channelId: string) => apiFetch<any[]>(`/channels/${channelId}/mood-board`),
    addItem: (channelId: string, data: { itemType: string; content: string; position?: any }) =>
      apiFetch<any>(`/channels/${channelId}/mood-board`, { method: 'POST', body: JSON.stringify(data) }),
    updateItem: (channelId: string, id: string, data: any) =>
      apiFetch<any>(`/channels/${channelId}/mood-board/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    removeItem: (channelId: string, id: string) =>
      apiFetch<void>(`/channels/${channelId}/mood-board/${id}`, { method: 'DELETE' }),
  },

  photoAlbums: {
    list: (guildId: string) => apiFetch<any[]>(`/guilds/${guildId}/albums`),
    create: (guildId: string, data: { name: string; description?: string }) =>
      apiFetch<any>(`/guilds/${guildId}/albums`, { method: 'POST', body: JSON.stringify(data) }),
    get: (guildId: string, id: string) => apiFetch<any>(`/guilds/${guildId}/albums/${id}`),
    update: (guildId: string, id: string, data: any) =>
      apiFetch<any>(`/guilds/${guildId}/albums/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (guildId: string, id: string) =>
      apiFetch<void>(`/guilds/${guildId}/albums/${id}`, { method: 'DELETE' }),
    addPhoto: (guildId: string, albumId: string, data: { fileUrl: string; caption?: string; messageId?: string }) =>
      apiFetch<any>(`/guilds/${guildId}/albums/${albumId}/photos`, { method: 'POST', body: JSON.stringify(data) }),
    removePhoto: (guildId: string, albumId: string, photoId: string) =>
      apiFetch<void>(`/guilds/${guildId}/albums/${albumId}/photos/${photoId}`, { method: 'DELETE' }),
  },

  voiceEffects: {
    listEffects: () => apiFetch<any[]>('/voice/effects'),
    getSettings: () => apiFetch<any>('/users/@me/voice-settings'),
    setSettings: (data: { activeEffect: string | null; effectVolume?: number }) =>
      apiFetch<any>('/users/@me/voice-settings', { method: 'PUT', body: JSON.stringify(data) }),
  },

  studyRooms: {
    getSettings: (channelId: string) => apiFetch<any>(`/channels/${channelId}/study`),
    updateSettings: (channelId: string, data: any) =>
      apiFetch<any>(`/channels/${channelId}/study/settings`, { method: 'PUT', body: JSON.stringify(data) }),
    startSession: (channelId: string, data: { sessionType: string }) =>
      apiFetch<any>(`/channels/${channelId}/study/start`, { method: 'POST', body: JSON.stringify(data) }),
    endSession: (channelId: string) =>
      apiFetch<any>(`/channels/${channelId}/study/end`, { method: 'POST', body: '{}' }),
    getStats: (guildId: string, period?: string) =>
      apiFetch<any>(`/guilds/${guildId}/study/stats${period ? `?period=${period}` : ''}`),
    getLeaderboard: (guildId: string) => apiFetch<any[]>(`/guilds/${guildId}/study/leaderboard`),
  },

  quests: {
    list: (guildId: string, status?: string) =>
      apiFetch<any[]>(`/guilds/${guildId}/quests${status ? `?status=${status}` : ''}`),
    create: (guildId: string, data: any) =>
      apiFetch<any>(`/guilds/${guildId}/quests`, { method: 'POST', body: JSON.stringify(data) }),
    update: (guildId: string, id: string, data: any) =>
      apiFetch<any>(`/guilds/${guildId}/quests/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (guildId: string, id: string) =>
      apiFetch<void>(`/guilds/${guildId}/quests/${id}`, { method: 'DELETE' }),
    contribute: (guildId: string, id: string, value?: number) =>
      apiFetch<any>(`/guilds/${guildId}/quests/${id}/contribute`, { method: 'POST', body: JSON.stringify({ value }) }),
    contributions: (guildId: string, id: string) =>
      apiFetch<any[]>(`/guilds/${guildId}/quests/${id}/contributions`),
  },

  forms: {
    list: (guildId: string) => apiFetch<any[]>(`/guilds/${guildId}/forms`),
    create: (guildId: string, data: any) =>
      apiFetch<any>(`/guilds/${guildId}/forms`, { method: 'POST', body: JSON.stringify(data) }),
    get: (guildId: string, id: string) => apiFetch<any>(`/guilds/${guildId}/forms/${id}`),
    update: (guildId: string, id: string, data: any) =>
      apiFetch<any>(`/guilds/${guildId}/forms/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (guildId: string, id: string) =>
      apiFetch<void>(`/guilds/${guildId}/forms/${id}`, { method: 'DELETE' }),
    submitResponse: (guildId: string, formId: string, answers: any) =>
      apiFetch<any>(`/guilds/${guildId}/forms/${formId}/responses`, { method: 'POST', body: JSON.stringify({ answers }) }),
    listResponses: (guildId: string, formId: string) =>
      apiFetch<any[]>(`/guilds/${guildId}/forms/${formId}/responses`),
    reviewResponse: (guildId: string, formId: string, responseId: string, data: { status: string }) =>
      apiFetch<any>(`/guilds/${guildId}/forms/${formId}/responses/${responseId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },

  confessions: {
    designateChannel: (guildId: string, channelId: string) =>
      apiFetch<any>(`/guilds/${guildId}/confession-channels`, { method: 'POST', body: JSON.stringify({ channelId }) }),
    undesignateChannel: (guildId: string, channelId: string) =>
      apiFetch<void>(`/guilds/${guildId}/confession-channels/${channelId}`, { method: 'DELETE' }),
    list: (channelId: string) => apiFetch<any[]>(`/channels/${channelId}/confessions`),
    post: (channelId: string, content: string) =>
      apiFetch<any>(`/channels/${channelId}/confessions`, { method: 'POST', body: JSON.stringify({ content }) }),
    reveal: (guildId: string, id: string) =>
      apiFetch<any>(`/guilds/${guildId}/confessions/${id}/reveal`, { method: 'POST', body: '{}' }),
  },

  encryption: {
    getPublicKey: (userId: string) =>
      apiFetch<{ publicKeyJwk: string | null }>(`/users/${userId}/public-key`),

    uploadPublicKey: (publicKeyJwk: string) =>
      apiFetch<void>('/users/@me/public-key', {
        method: 'POST',
        body: JSON.stringify({ publicKeyJwk }),
      }),

    getGroupKey: (channelId: string) =>
      apiFetch<{ version: number | null; encryptedKey: string | null }>(`/channels/${channelId}/group-key`),

    postGroupKey: (channelId: string, data: { version: number; keyData: Record<string, string> }) =>
      apiFetch<void>(`/channels/${channelId}/group-key`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // Generic helpers for custom endpoints not covered by typed methods above
  get: <T = unknown>(path: string) => apiFetch<T>(path),
  post: <T = unknown>(path: string, data: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: JSON.stringify(data) }),
  patch: <T = unknown>(path: string, data: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: <T = unknown>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
  put: <T = unknown>(path: string, data: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(data) }),
};
