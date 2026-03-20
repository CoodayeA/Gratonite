/**
 * Core API infrastructure: types, token management, apiFetch wrapper.
 * Internal module -- consumers should import from the barrel (../api).
 */
import { isAuthGuardEnabled, isAuthRuntimeExpired, setAuthRuntimeState, transitionAuthExpired } from '../authRuntime';
import type {
  Guild as SharedGuild,
  Channel as SharedChannel,
  Message as SharedMessage,
  GuildMember as SharedGuildMember,
  Thread as SharedThread,
  Role,
  Invite,
  Notification,
  UserSummary,
  UserStatus,
  ReactionGroup,
} from '@gratonite/types';

// ---------------------------------------------------------------------------
// Re-export shared types for downstream consumers
// ---------------------------------------------------------------------------
export type { Role, Invite, Notification, UserSummary, UserStatus, ReactionGroup } from '@gratonite/types';

// ---------------------------------------------------------------------------
// API-layer types (extend shared types with runtime/index-signature flexibility)
// ---------------------------------------------------------------------------

export interface AuthResponse {
  accessToken: string;
  user: { id: string; username: string; email: string; emailVerified: boolean; isAdmin: boolean };
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  login: string;
  password: string;
  mfaCode?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

export interface CursorPaginationParams {
  before?: string;
  after?: string;
  around?: string;
  limit?: number;
}

/** Guild — extends the shared type with an index signature for extra runtime fields. */
export interface Guild extends SharedGuild {
  [key: string]: any;
}

/** Channel — extends the shared type with an index signature for extra runtime fields. */
export interface Channel extends SharedChannel {
  [key: string]: any;
}

/** Message — extends the shared type with extra fields used by the frontend. */
export interface Message extends SharedMessage {
  /** Numeric message type (system, default, reply, etc.) */
  type?: number;
  [key: string]: any;
}

/** GuildMember — extends the shared type with flattened user fields used by the member list. */
export interface GuildMember extends SharedGuildMember {
  username?: string;
  displayName?: string;
  avatarHash?: string | null;
  roleIds?: string[];
  groupIds?: string[];
  status?: PresenceStatus;
  [key: string]: any;
}

/** Thread — extends the shared type with an index signature for extra runtime fields. */
export interface Thread extends SharedThread {
  [key: string]: any;
}

export interface GuildEmoji {
  id: string;
  guildId: string;
  name: string;
  [key: string]: any;
}

export type AvatarDecoration = unknown;
export type ProfileEffect = unknown;
export type Nameplate = unknown;
export type PresenceStatus = 'online' | 'idle' | 'dnd' | 'invisible' | 'offline';

export interface ShopItem {
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

export interface InventoryItem {
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

export interface InviteInfo {
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

export interface SearchMessagesResponse {
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
  lastDailyClaimAt: string | null;
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

// ---------------------------------------------------------------------------
// Token management (module-scoped, not reactive)
// ---------------------------------------------------------------------------

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

// Deduplication caches for getMe/getWallet
export let meRequestPromise: Promise<{
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  isAdmin: boolean;
  status?: string;
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

export function setMeRequestPromise(p: typeof meRequestPromise) {
  meRequestPromise = p;
}

export let walletRequestPromise: Promise<CurrencyWallet> | null = null;
export function setWalletRequestPromise(p: typeof walletRequestPromise) {
  walletRequestPromise = p;
}

if (typeof window !== 'undefined') {
  accessToken = window.localStorage.getItem('gratonite_access_token');
  if (isAuthGuardEnabled()) {
    setAuthRuntimeState(accessToken ? 'active' : 'expired');
  }
}

// ---------------------------------------------------------------------------
// Proactive token refresh
// ---------------------------------------------------------------------------

let proactiveRefreshTimer: ReturnType<typeof setTimeout> | null = null;

function decodeJwtExp(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof decoded.exp === 'number' ? decoded.exp : null;
  } catch {
    return null;
  }
}

function scheduleProactiveRefresh(token: string | null) {
  if (proactiveRefreshTimer) {
    clearTimeout(proactiveRefreshTimer);
    proactiveRefreshTimer = null;
  }
  if (!token) return;

  const exp = decodeJwtExp(token);
  if (!exp) return;

  const nowSec = Math.floor(Date.now() / 1000);
  const refreshInMs = Math.max((exp - nowSec - 60) * 1000, 0);

  proactiveRefreshTimer = setTimeout(async () => {
    await refreshAccessToken();
  }, refreshInMs);
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
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'STORE_AUTH_TOKEN', token });
    }
  }
  scheduleProactiveRefresh(token);
}

export function getAccessToken(): string | null {
  return accessToken;
}

// Schedule proactive refresh on initial load
if (accessToken) {
  scheduleProactiveRefresh(accessToken);
}

// ---------------------------------------------------------------------------
// Base URL
// ---------------------------------------------------------------------------

const rawApiBase = import.meta.env.VITE_API_URL ?? '/api/v1';
export const API_BASE = rawApiBase.endsWith('/api/v1')
  ? rawApiBase
  : `${rawApiBase.replace(/\/$/, '')}/api/v1`;

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
  // Sanitize: strip undefined/null-ish guildId that isn't a valid UUID, ensure timestamp
  const clean: Record<string, unknown> = { ...payload };
  if (clean.guildId && typeof clean.guildId === 'string' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean.guildId)) {
    delete clean.guildId;
  }
  if (!clean.timestamp) {
    clean.timestamp = new Date().toISOString();
  }
  void fetch(`${API_BASE}/telemetry/client-events`, {
    method: 'POST',
    headers,
    credentials: 'include',
    keepalive: true,
    body: JSON.stringify(clean),
  }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

export async function refreshAccessToken(): Promise<string | null> {
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
        credentials: 'include',
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

export async function apiFetch<T = any>(
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

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const isUpload = options.body instanceof FormData;
  if (options.body && !isUpload && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const timeoutMs = isUpload ? 120_000 : 15_000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: 'include',
      signal: options.signal || controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      window.dispatchEvent(new CustomEvent('gratonite:request-timeout', { detail: { path } }));
      window.Sentry?.addBreadcrumb?.({ category: 'api', message: `Timeout: ${options.method || 'GET'} ${path} (${timeoutMs / 1000}s)`, level: 'error' });
      throw new Error(`Request timed out after ${timeoutMs / 1000}s`);
    }
    throw err;
  }
  clearTimeout(timeoutId);

  if (res.status === 429) {
    const retryAfter = Number(res.headers.get('Retry-After') ?? 5000);
    window.dispatchEvent(new CustomEvent('gratonite:rate-limited', { detail: { retryAfter } }));
    window.Sentry?.addBreadcrumb?.({ category: 'api', message: `Rate limited: ${options.method || 'GET'} ${path}`, level: 'warning' });
    throw new RateLimitError(retryAfter);
  }

  const requestId = res.headers.get('x-request-id') ?? res.headers.get('x-correlation-id');

  if (res.status === 401 && !retried && !shouldBypassAuthGate(path)) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return apiFetch<T>(path, options, true);
    }
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

  if (res.status === 401 && shouldBypassAuthGate(path)) {
    const body = await res.json().catch(() => ({ code: 'UNAUTHORIZED', message: 'Unauthorized' }));
    throw new ApiRequestError(401, body as ApiError, requestId);
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
    } as ApiError);
  }

  if (!res.ok) {
    const apiErr = body as ApiError;
    window.Sentry?.addBreadcrumb?.({ category: 'api', message: `${options.method || 'GET'} ${path} → ${res.status} ${apiErr.code}`, level: res.status >= 500 ? 'error' : 'warning', data: { status: res.status, code: apiErr.code, requestId } });
    throw new ApiRequestError(res.status, apiErr, requestId);
  }

  return body as T;
}

// ---------------------------------------------------------------------------
// Query string helper
// ---------------------------------------------------------------------------

export function buildQuery(params?: CursorPaginationParams): string {
  if (!params) return '';
  const parts: string[] = [];
  if (params.before) parts.push(`before=${params.before}`);
  if (params.after) parts.push(`after=${params.after}`);
  if (params.around) parts.push(`around=${params.around}`);
  if (params.limit) parts.push(`limit=${params.limit}`);
  return parts.join('&');
}
