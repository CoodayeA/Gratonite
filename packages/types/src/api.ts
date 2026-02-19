// ============================================================================
// API types — Request/response shapes for REST + tRPC endpoints
// ============================================================================

import type { Snowflake } from './snowflake';
import type { UserTier } from './user';

/** JWT access token payload */
export interface AccessTokenPayload {
  userId: Snowflake;
  username: string;
  tier: UserTier;
  iat: number;
  exp: number;
}

/** Registration request */
export interface RegisterRequest {
  email: string;
  username: string;
  displayName: string;
  password: string;
  dateOfBirth: string; // YYYY-MM-DD
}

/** Login request */
export interface LoginRequest {
  login: string; // username or email
  password: string;
  mfaCode?: string; // TOTP code
}

/** Auth response (successful login/register) */
export interface AuthResponse {
  accessToken: string;
  user: {
    id: Snowflake;
    username: string;
    email: string;
    displayName: string;
    avatarHash: string | null;
    tier: UserTier;
  };
}

/** Google OAuth callback data */
export interface GoogleOAuthCallbackData {
  code: string;
  redirectUri: string;
}

/** Paginated response wrapper */
export interface PaginatedResponse<T> {
  items: T[];
  hasMore: boolean;
}

/** Cursor-based pagination params */
export interface CursorPaginationParams {
  before?: Snowflake;
  after?: Snowflake;
  around?: Snowflake;
  limit?: number; // default 50, max 100
}

/** API error response */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>; // field-level errors
}

/** Rate limit info (returned in headers + body on 429) */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp
  retryAfter: number; // milliseconds
  bucket: string;
}

/** Upload response */
export interface UploadResponse {
  hash: string;
  url: string;
  proxyUrl: string;
  width: number | null;
  height: number | null;
  size: number;
  contentType: string;
}

/** Server analytics (daily aggregate) */
export interface ServerAnalyticsDaily {
  guildId: Snowflake;
  date: string; // YYYY-MM-DD
  totalMembers: number;
  newMembers: number;
  leftMembers: number;
  messagesSent: number;
  activeMembers: number;
  voiceMinutes: number;
  reactionsAdded: number;
}
