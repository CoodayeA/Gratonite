/**
 * routes/auth.ts — Express router for all authentication endpoints.
 *
 * Mounted at /api/v1/auth by src/routes/index.ts.
 *
 * Endpoints (all documented in docs/api/auth.md):
 *   POST   /register               — Create a new account
 *   GET    /username-available     — Check if a username is taken
 *   POST   /login                  — Issue access + refresh tokens
 *   POST   /refresh                — Exchange a valid refresh cookie for a new access token
 *   POST   /logout                 — Revoke the refresh token and clear the cookie
 *   POST   /verify-email/request   — (Re)send a verification email
 *   POST   /verify-email/confirm   — Confirm a verification token from an email link
 *
 * Security decisions:
 *   - Passwords are hashed with argon2id (memory-hard, recommended by OWASP).
 *   - Refresh tokens are stored as SHA-256 hashes — the raw token lives only
 *     in the httpOnly cookie on the client and is never persisted to the DB.
 *   - Access tokens are short-lived (15 min) JWTs sent in the response body;
 *     the client stores them in memory (not localStorage) to prevent XSS theft.
 *   - The refresh cookie uses httpOnly + sameSite: lax to prevent CSRF.
 *     In production it is also marked Secure (HTTPS only).
 *   - Username availability checks are case-insensitive (lowercased before query).
 *   - All error messages are intentionally vague for login to prevent user
 *     enumeration (one message covers "user not found" and "wrong password").
 */

import { Router, Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';
import { z } from 'zod';
import * as argon2 from 'argon2';
import crypto from 'crypto';
import { eq, or, and, ne, sql } from 'drizzle-orm';

import { db } from '../db/index';
import { users } from '../db/schema/users';
import { refreshTokens, emailVerificationTokens, passwordResetTokens } from '../db/schema/auth';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt';
import { sendVerificationEmail, sendPasswordResetEmail, sendNewDeviceLoginAlert } from '../lib/mailer';
import { requireAuth } from '../middleware/auth';
import { redis } from '../lib/redis';
import { usernameCheckRateLimit, emailVerifyRateLimit, mfaSetupRateLimit } from '../middleware/rateLimit';
import { referrals as referralsTable } from '../db/schema/referrals';
import { userDevices } from '../db/schema/user-devices';
import { ServiceError } from '../services/guild.service';
import * as authService from '../services/auth.service';

export const authRouter = Router();

// ---------------------------------------------------------------------------
// Async error handler wrapper for Express 4
// ---------------------------------------------------------------------------

/**
 * asyncHandler — Wraps an async route handler so that rejected promises are
 * forwarded to Express's error middleware via next(err) instead of causing
 * unhandled promise rejections that crash the process.
 */
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Name of the httpOnly cookie used to store the refresh token JWT.
 * Must match everywhere the cookie is set, read, or cleared.
 */
const REFRESH_COOKIE = 'gratonite_refresh';

/**
 * Refresh token lifetime: 30 days expressed in milliseconds.
 * Used to calculate both the cookie maxAge and the DB expiresAt timestamp.
 */
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Email verification token lifetime: 24 hours in milliseconds.
 */
const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const MFA_SETUP_TTL_SECONDS = 10 * 60;
const MFA_BACKUP_CODES_COUNT = 10;
const MFA_TOTP_STEP_SECONDS = 30;
const MFA_TOTP_DIGITS = 6;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * hashToken — SHA-256 hash of a raw token string, returned as a hex string.
 *
 * Used to derive the value stored in the database from the raw token that
 * lives only in the client cookie or the verification email link. This way
 * a database dump never contains usable tokens.
 *
 * @param raw - The raw token string (JWT or hex blob).
 * @returns   - 64-character lowercase hex string.
 */
function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * parseDevice — Extract a human-readable device description from the User-Agent.
 */
function parseDevice(ua: string | undefined): string {
  if (!ua) return 'Unknown Device';
  if (ua.includes('Gratonite')) {
    if (ua.includes('iOS')) return 'Gratonite Mobile on iOS';
    if (ua.includes('Android')) return 'Gratonite Mobile on Android';
    return 'Gratonite Mobile';
  }
  let browser = 'Browser';
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';
  let os = '';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS X') || ua.includes('macOS')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  return os ? `${browser} on ${os}` : browser;
}

/**
 * getClientIp — Extract client IP, respecting X-Forwarded-For behind a proxy.
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip || req.socket.remoteAddress || '';
}

/**
 * generateRawToken — Generates a cryptographically random hex token.
 *
 * Used for email verification links. 32 bytes = 256 bits of entropy, which
 * is sufficient to make brute-force guessing infeasible.
 *
 * @param bytes - Number of random bytes (default 32 → 64 hex chars).
 * @returns     - Lowercase hex string of length `bytes * 2`.
 */
function generateRawToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const MFA_SETUP_KEY_PREFIX = 'auth:mfa:setup:';
const MFA_BACKUP_KEY_PREFIX = 'auth:mfa:backup:';

type MfaSetupCache = {
  encryptedSecret: string;
  createdAt: number;
};

type MfaBackupCodesCache = {
  hashes: string[];
  updatedAt: number;
};

function getMfaEncryptionKey(): Buffer {
  const keyMaterial = process.env.MFA_ENCRYPTION_KEY || (process.env.NODE_ENV === 'production' ? (() => { throw new Error('MFA_ENCRYPTION_KEY is required in production'); })() : 'gratonite-dev-mfa-key');
  return crypto.createHash('sha256').update(keyMaterial).digest();
}

function toBase64Url(input: Buffer): string {
  return input.toString('base64url');
}

function fromBase64Url(input: string): Buffer {
  return Buffer.from(input, 'base64url');
}

function encryptMfaSecret(secret: string): string {
  const key = getMfaEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return toBase64Url(Buffer.concat([iv, authTag, ciphertext]));
}

function decryptMfaSecret(payload: string): string {
  const decoded = fromBase64Url(payload);
  if (decoded.length < 28) throw new Error('Invalid encrypted MFA secret');
  const iv = decoded.subarray(0, 12);
  const authTag = decoded.subarray(12, 28);
  const ciphertext = decoded.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', getMfaEncryptionKey(), iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(input: string): Buffer {
  const normalized = input.toUpperCase().replace(/=+$/g, '').replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of normalized) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function generateMfaSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

function generateTotpCode(secret: string, timeMs = Date.now()): string {
  const key = base32Decode(secret);
  const counter = Math.floor(timeMs / 1000 / MFA_TOTP_STEP_SECONDS);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter), 0);
  const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const code = binary % (10 ** MFA_TOTP_DIGITS);
  return String(code).padStart(MFA_TOTP_DIGITS, '0');
}

function verifyTotpCode(secret: string, code: string): boolean {
  const normalized = code.replace(/\D/g, '');
  if (normalized.length !== MFA_TOTP_DIGITS) return false;
  const now = Date.now();
  for (const drift of [-1, 0, 1]) {
    const candidate = generateTotpCode(secret, now + drift * MFA_TOTP_STEP_SECONDS * 1000);
    if (candidate === normalized) return true;
  }
  return false;
}

function generateBackupCodes(): string[] {
  return Array.from({ length: MFA_BACKUP_CODES_COUNT }, () => {
    const raw = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
  });
}

function normalizeBackupCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function hashBackupCode(code: string, userId?: string): string {
  const normalized = normalizeBackupCode(code);
  if (userId) {
    return crypto.createHash('sha256').update(userId + ':' + normalized).digest('hex');
  }
  return hashToken(normalized);
}

function getMfaSetupKey(userId: string): string {
  return `${MFA_SETUP_KEY_PREFIX}${userId}`;
}

function getMfaBackupKey(userId: string): string {
  return `${MFA_BACKUP_KEY_PREFIX}${userId}`;
}

function buildOtpAuthUrl(email: string, secret: string): string {
  const issuer = 'Gratonite';
  const label = `${issuer}:${email}`;
  return `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${MFA_TOTP_DIGITS}&period=${MFA_TOTP_STEP_SECONDS}`;
}

function buildQrCodeDataUrl(otpauthUrl: string): string {
  // Keep QR generation dependency-free by delegating rendering to a stable HTTPS endpoint.
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(otpauthUrl)}`;
  return url;
}

async function getMfaBackupHashes(userId: string): Promise<string[]> {
  const raw = await redis.get(getMfaBackupKey(userId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as MfaBackupCodesCache;
    return Array.isArray(parsed.hashes) ? parsed.hashes : [];
  } catch {
    return [];
  }
}

async function setMfaBackupHashes(userId: string, hashes: string[]): Promise<void> {
  const payload: MfaBackupCodesCache = { hashes, updatedAt: Date.now() };
  await redis.set(getMfaBackupKey(userId), JSON.stringify(payload));
}

/**
 * safeUserResponse — Strips sensitive fields from a user row before sending
 * it to the client.
 *
 * Never send passwordHash or internal DB timestamps we don't want to expose.
 * This function defines the canonical "public user" shape returned by /login.
 *
 * @param user - A full user row from the DB.
 * @returns    - Safe subset of user fields.
 */
function safeUserResponse(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    avatarHash: user.avatarHash,
    bannerHash: user.bannerHash,
    bio: user.bio,
    pronouns: user.pronouns,
    customStatus: user.customStatus,
    status: user.status,
    isAdmin: user.isAdmin,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Zod validation schemas
// ---------------------------------------------------------------------------

/**
 * Schema for POST /register request body.
 *
 * username: 3–32 characters, only letters, digits, and underscores.
 *           This matches what most chat platforms allow and keeps display simple.
 * email:    Must be a valid email format.
 * password: Minimum 8 characters (NIST SP 800-63B guideline).
 * displayName: Optional; defaults to username in the handler if omitted.
 */
const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(32, 'Username must be at most 32 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores'),
  email: z.string().email('Must be a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(1).max(64).optional(),
});

/**
 * Schema for POST /login request body.
 *
 * `login` accepts either a username or an email — the handler detects which
 * by checking if the value contains an "@" symbol.
 */
const loginSchema = z.object({
  login: z.string().min(1, 'Login is required'),
  password: z.string().min(1, 'Password is required'),
  mfaCode: z.string().regex(/^\d{6}$/, 'MFA code must be 6 digits').optional(),
});

/**
 * Schema for POST /verify-email/request request body.
 */
const verifyEmailRequestSchema = z.object({
  email: z.string().email('Must be a valid email address'),
});

/**
 * Schema for POST /verify-email/confirm request body.
 */
const verifyEmailConfirmSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  email: z.string().email('Must be a valid email address').optional(),
});

const mfaEnableSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
});

// ---------------------------------------------------------------------------
// POST /register
// ---------------------------------------------------------------------------

/**
 * Register a new Gratonite account.
 *
 * @input  body { username, email, password, displayName? }
 * @output 201  { message: 'Check your email to verify your account' }
 * @error  400  Zod validation failure
 * @error  409  Username or email already taken
 *
 * Side effects:
 *   - Inserts a row in `users` (emailVerified = false).
 *   - Inserts a row in `email_verification_tokens`.
 *   - Sends a verification email via the mailer.
 */
authRouter.post('/register', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parseResult = registerSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Validation failed', details: parseResult.error.issues });
    return;
  }

  const { username, email, password, displayName } = parseResult.data;
  const referralCode = (req.query.ref || req.body.referralCode) as string | undefined;

  try {
    const result = await authService.register({ username, email, password, displayName, referralCode });
    res.status(201).json({ email: result.email });
  } catch (err) {
    if (err instanceof ServiceError) {
      const status = err.code === 'CONFLICT' ? 409 : 400;
      // Preserve original error codes for conflict types
      const code = err.message === 'Username is already taken' ? 'USERNAME_TAKEN'
        : err.message === 'Email is already registered' ? 'EMAIL_TAKEN'
        : err.code === 'VALIDATION_ERROR' ? 'INVALID_EMAIL_DOMAIN'
        : err.code;
      res.status(status).json({ code, message: err.message });
      return;
    }
    throw err;
  }
}));

// ---------------------------------------------------------------------------
// GET /username-available
// ---------------------------------------------------------------------------

/**
 * Check whether a username is available.
 *
 * @input  query ?username=xxx
 * @output 200   { available: boolean }
 * @error  400   Missing or empty username query param
 *
 * This endpoint is intentionally unauthenticated so the registration form
 * can do real-time availability checks.  Rate limiting should be applied at
 * the infrastructure level (nginx / reverse proxy) to prevent enumeration.
 */
authRouter.get('/username-available', usernameCheckRateLimit, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { username } = req.query;

  if (typeof username !== 'string' || username.trim() === '') {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'username query parameter is required' });
    return;
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.username}) = lower(${username.trim()})`)
    .limit(1);

  res.status(200).json({ available: existing.length === 0 });
}));

// ---------------------------------------------------------------------------
// POST /login
// ---------------------------------------------------------------------------

/**
 * Authenticate a user and issue access + refresh tokens.
 *
 * @input  body { login, password } — `login` is username or email
 * @output 200  { accessToken: string, user: SafeUser }
 *              Sets httpOnly cookie `gratonite_refresh`
 * @error  400  Validation failure
 * @error  401  Invalid credentials (intentionally vague to prevent enumeration)
 * @error  403  { code: 'EMAIL_NOT_VERIFIED' }
 *
 * Side effects:
 *   - Inserts a refresh token hash row in `refresh_tokens`.
 *   - Sets `gratonite_refresh` httpOnly cookie.
 */
authRouter.post('/login', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parseResult = loginSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Validation failed', details: parseResult.error.issues });
    return;
  }

  const { login, password, mfaCode } = parseResult.data;

  try {
    const result = await authService.login({
      login,
      password,
      mfaCode,
      userAgent: req.headers['user-agent'],
      clientIp: getClientIp(req),
    });

    // Set the refresh token as an httpOnly cookie
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie(REFRESH_COOKIE, result.rawRefreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: REFRESH_TTL_MS,
      path: '/',
    });

    res.status(200).json({
      accessToken: result.accessToken,
      user: result.user,
    });
  } catch (err) {
    if (err instanceof ServiceError) {
      const codeMap: Record<string, { status: number; code: string }> = {
        'Invalid credentials': { status: 401, code: 'INVALID_CREDENTIALS' },
        'Bot accounts cannot log in via this endpoint': { status: 403, code: 'BOT_LOGIN_DENIED' },
        'Two-factor authentication code required': { status: 401, code: 'MFA_REQUIRED' },
        'Invalid authentication code': { status: 401, code: 'INVALID_MFA_CODE' },
      };
      const mapped = codeMap[err.message] || { status: 401, code: err.code };
      res.status(mapped.status).json({ code: mapped.code, message: err.message });
      return;
    }
    throw err;
  }
}));

// ---------------------------------------------------------------------------
// POST /refresh
// ---------------------------------------------------------------------------

/**
 * Exchange a valid refresh cookie for a new access token.
 *
 * This is the standard "silent refresh" flow — the SPA calls this on startup
 * and when an API request returns 401, without requiring the user to log in
 * again as long as their refresh token is valid.
 *
 * @input  cookie `gratonite_refresh`
 * @output 200    { accessToken: string }
 * @error  401    Missing, invalid, or expired refresh token
 *
 * Security note: We verify BOTH the JWT signature AND the DB hash. This gives
 * us revocation capability — a logged-out token won't exist in the DB even if
 * the JWT hasn't expired yet.
 */
authRouter.post('/refresh', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const rawToken: string | undefined = req.cookies[REFRESH_COOKIE];

  if (!rawToken) {
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'No refresh token provided' });
    return;
  }

  try {
    const result = await authService.refreshToken(rawToken);
    res.status(200).json({ accessToken: result.accessToken });
  } catch (err) {
    if (err instanceof ServiceError) {
      res.clearCookie(REFRESH_COOKIE, { path: '/' });
      res.status(401).json({ code: 'UNAUTHORIZED', message: err.message });
      return;
    }
    throw err;
  }
}));

// ---------------------------------------------------------------------------
// POST /logout
// ---------------------------------------------------------------------------

/**
 * Revoke the current session's refresh token and clear the cookie.
 *
 * @input  cookie `gratonite_refresh`
 * @output 200    { message: 'Logged out' }
 *
 * This endpoint is intentionally forgiving: if the cookie is missing or the
 * token isn't in the DB (already logged out), we still return 200 and clear
 * the cookie. This makes the logout flow idempotent and avoids confusing the
 * client with errors it can't recover from.
 */
authRouter.post('/logout', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const rawToken: string | undefined = req.cookies[REFRESH_COOKIE];

  await authService.logout(rawToken);

  // Always clear the cookie, regardless of whether a token was found.
  res.clearCookie(REFRESH_COOKIE, { path: '/' });
  res.status(200).json({ message: 'Logged out' });
}));

// ---------------------------------------------------------------------------
// Session management routes
// ---------------------------------------------------------------------------

/**
 * GET /sessions — List all active sessions for the authenticated user.
 */
authRouter.get('/sessions', requireAuth, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const now = new Date();
  const rows = await db
    .select({
      id: refreshTokens.id,
      tokenHash: refreshTokens.tokenHash,
      device: refreshTokens.device,
      ip: refreshTokens.ip,
      lastActive: refreshTokens.lastActiveAt,
      createdAt: refreshTokens.createdAt,
      expiresAt: refreshTokens.expiresAt,
    })
    .from(refreshTokens)
    .where(eq(refreshTokens.userId, req.userId!));

  // Determine which session is the current one by matching the cookie or header.
  const rawToken: string | undefined = req.cookies[REFRESH_COOKIE]
    || (req.headers['x-refresh-token'] as string | undefined);
  const currentHash = rawToken ? hashToken(rawToken) : null;

  const sessions = rows
    .filter((r) => r.expiresAt > now)
    .map((r) => ({
      id: r.id,
      device: r.device || 'Unknown Device',
      ip: r.ip || '',
      lastActive: (r.lastActive || r.createdAt).toISOString(),
      current: r.tokenHash === currentHash,
    }));

  res.json(sessions);
}));

/**
 * DELETE /sessions/:id — Revoke a specific session (by refresh token row id).
 */
authRouter.delete('/sessions/:id', requireAuth, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const sessionId = req.params.id as string;

  // Only allow deleting your own sessions.
  const [row] = await db
    .select({ id: refreshTokens.id, tokenHash: refreshTokens.tokenHash })
    .from(refreshTokens)
    .where(and(eq(refreshTokens.id, sessionId), eq(refreshTokens.userId, req.userId!)))
    .limit(1);

  if (!row) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Session not found' });
    return;
  }

  // Don't allow revoking the current session via this endpoint (use /logout).
  const rawToken: string | undefined = req.cookies[REFRESH_COOKIE]
    || (req.headers['x-refresh-token'] as string | undefined);
  if (rawToken && hashToken(rawToken) === row.tokenHash) {
    res.status(400).json({ code: 'CANNOT_REVOKE_CURRENT', message: 'Use /logout to end the current session' });
    return;
  }

  await db.delete(refreshTokens).where(eq(refreshTokens.id, sessionId));
  res.json({ message: 'Session revoked' });
}));

/**
 * DELETE /sessions — Revoke all sessions except the current one.
 */
authRouter.delete('/sessions', requireAuth, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const rawToken: string | undefined = req.cookies[REFRESH_COOKIE]
    || (req.headers['x-refresh-token'] as string | undefined);
  const currentHash = rawToken ? hashToken(rawToken) : null;

  if (currentHash) {
    await db.delete(refreshTokens)
      .where(and(eq(refreshTokens.userId, req.userId!), ne(refreshTokens.tokenHash, currentHash)));
  } else {
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, req.userId!));
  }

  res.json({ message: 'All other sessions revoked' });
}));

// ---------------------------------------------------------------------------
// MFA routes
// ---------------------------------------------------------------------------

authRouter.get('/mfa/status', requireAuth, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const [user] = await db
    .select({ mfaEnabled: users.mfaEnabled })
    .from(users)
    .where(eq(users.id, req.userId!))
    .limit(1);

  if (!user) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'User not found' });
    return;
  }

  const pendingSetup = Boolean(await redis.get(getMfaSetupKey(req.userId!)));
  const backupCodeCount = (await getMfaBackupHashes(req.userId!)).length;
  res.status(200).json({
    enabled: user.mfaEnabled,
    pendingSetup,
    backupCodeCount,
  });
}));

const startMfaSetupHandler = async (req: Request, res: Response): Promise<void> => {
  const [user] = await db
    .select({ id: users.id, email: users.email, mfaEnabled: users.mfaEnabled })
    .from(users)
    .where(eq(users.id, req.userId!))
    .limit(1);

  if (!user) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'User not found' });
    return;
  }

  if (user.mfaEnabled) {
    res.status(409).json({ code: 'MFA_ALREADY_ENABLED', message: 'MFA is already enabled' });
    return;
  }

  const secret = generateMfaSecret();
  const encryptedSecret = encryptMfaSecret(secret);
  const cachePayload: MfaSetupCache = {
    encryptedSecret,
    createdAt: Date.now(),
  };
  await redis.setex(getMfaSetupKey(user.id), MFA_SETUP_TTL_SECONDS, JSON.stringify(cachePayload));

  const otpauthUrl = buildOtpAuthUrl(user.email, secret);
  res.status(200).json({
    secret,
    otpauthUrl,
    qrCodeDataUrl: buildQrCodeDataUrl(otpauthUrl),
    expiresInSeconds: MFA_SETUP_TTL_SECONDS,
  });
};

authRouter.post('/mfa/setup/start', requireAuth, mfaSetupRateLimit, asyncHandler(startMfaSetupHandler));
// Alias used by some clients/docs.
authRouter.post('/mfa/setup', requireAuth, mfaSetupRateLimit, asyncHandler(startMfaSetupHandler));

const enableMfaHandler = async (req: Request, res: Response): Promise<void> => {
  const parse = mfaEnableSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Validation failed', details: parse.error.issues });
    return;
  }

  const { code } = parse.data;
  const setupRaw = await redis.get(getMfaSetupKey(req.userId!));
  if (!setupRaw) {
    res.status(400).json({ code: 'MFA_SETUP_EXPIRED', message: 'MFA setup session expired. Start setup again.' });
    return;
  }

  let encryptedSecret: string | null = null;
  try {
    const setup = JSON.parse(setupRaw) as MfaSetupCache;
    encryptedSecret = setup.encryptedSecret;
  } catch {
    encryptedSecret = null;
  }

  if (!encryptedSecret) {
    res.status(400).json({ code: 'MFA_SETUP_INVALID', message: 'Invalid MFA setup state. Start setup again.' });
    return;
  }

  let plainSecret: string;
  try {
    plainSecret = decryptMfaSecret(encryptedSecret);
  } catch {
    res.status(500).json({ code: 'MFA_SECRET_ERROR', message: 'Could not process MFA secret' });
    return;
  }

  if (!verifyTotpCode(plainSecret, code)) {
    res.status(400).json({ code: 'INVALID_MFA_CODE', message: 'Invalid authenticator code' });
    return;
  }

  await db
    .update(users)
    .set({
      mfaSecret: encryptedSecret,
      mfaEnabled: true,
      updatedAt: new Date(),
    })
    .where(eq(users.id, req.userId!));

  const backupCodes = generateBackupCodes();
  await setMfaBackupHashes(req.userId!, backupCodes.map(c => hashBackupCode(c, req.userId!)));
  await redis.del(getMfaSetupKey(req.userId!));

  res.status(200).json({ ok: true, backupCodes });
};

authRouter.post('/mfa/setup/enable', requireAuth, mfaSetupRateLimit, asyncHandler(enableMfaHandler));
// Alias used by plan/docs.
authRouter.post('/mfa/verify/enable', requireAuth, mfaSetupRateLimit, asyncHandler(enableMfaHandler));

authRouter.post('/mfa/disable', requireAuth, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parse = mfaEnableSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Validation failed', details: parse.error.issues });
    return;
  }
  const { code } = parse.data;

  const [user] = await db
    .select({ mfaSecret: users.mfaSecret, mfaEnabled: users.mfaEnabled })
    .from(users)
    .where(eq(users.id, req.userId!))
    .limit(1);

  if (!user) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'User not found' });
    return;
  }

  if (!user.mfaEnabled || !user.mfaSecret) {
    res.status(200).json({ ok: true });
    return;
  }

  let verified = false;
  try {
    const secret = decryptMfaSecret(user.mfaSecret);
    verified = verifyTotpCode(secret, code);
  } catch {
    verified = false;
  }

  if (!verified) {
    const hashes = await getMfaBackupHashes(req.userId!);
    verified = hashes.includes(hashBackupCode(code, req.userId!));
  }

  if (!verified) {
    res.status(400).json({ code: 'INVALID_MFA_CODE', message: 'Invalid authenticator code' });
    return;
  }

  await db
    .update(users)
    .set({
      mfaEnabled: false,
      mfaSecret: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, req.userId!));

  await redis.del(getMfaSetupKey(req.userId!));
  await redis.del(getMfaBackupKey(req.userId!));

  res.status(200).json({ ok: true });
}));

authRouter.post('/mfa/backup-codes/regenerate', requireAuth, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parse = mfaEnableSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Validation failed', details: parse.error.issues });
    return;
  }
  const { code } = parse.data;

  const [user] = await db
    .select({ mfaSecret: users.mfaSecret, mfaEnabled: users.mfaEnabled })
    .from(users)
    .where(eq(users.id, req.userId!))
    .limit(1);

  if (!user || !user.mfaEnabled || !user.mfaSecret) {
    res.status(400).json({ code: 'MFA_NOT_ENABLED', message: 'Enable MFA before regenerating backup codes' });
    return;
  }

  let verified = false;
  try {
    const secret = decryptMfaSecret(user.mfaSecret);
    verified = verifyTotpCode(secret, code);
  } catch {
    verified = false;
  }

  if (!verified) {
    res.status(400).json({ code: 'INVALID_MFA_CODE', message: 'Invalid authenticator code' });
    return;
  }

  const backupCodes = generateBackupCodes();
  await setMfaBackupHashes(req.userId!, backupCodes.map(c => hashBackupCode(c, req.userId!)));
  res.status(200).json({ ok: true, backupCodes });
}));

// ---------------------------------------------------------------------------
// POST /verify-email/request
// ---------------------------------------------------------------------------

/**
 * (Re)send a verification email to the given address.
 *
 * This is idempotent: if the user is already verified it returns 200
 * immediately without sending an email. If a previous token exists it is
 * deleted before creating a new one (avoids stale token accumulation).
 *
 * @input  body { email }
 * @output 200  { message: 'Verification email sent' }
 * @error  400  Validation failure
 *
 * Security note: We always return 200 even if the email isn't registered.
 * This prevents email enumeration attacks — an attacker cannot distinguish
 * "this email is registered but unverified" from "this email isn't registered".
 */
authRouter.post('/verify-email/request', emailVerifyRateLimit, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parseResult = verifyEmailRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Validation failed', details: parseResult.error.issues });
    return;
  }

  const { email } = parseResult.data;
  const message = await authService.requestEmailVerification(email);
  res.status(200).json({ message });
}));

// ---------------------------------------------------------------------------
// POST /verify-email/confirm
// ---------------------------------------------------------------------------

/**
 * Confirm an email verification token received via a link in the email.
 *
 * The frontend navigates the user to /app/verify?token=xxx&email=yyy, extracts
 * those query params, and POSTs them here.
 *
 * @input  body { token, email }
 * @output 200  { message: 'Email verified' }
 * @error  400  Validation failure or invalid/expired token
 *
 * Side effects:
 *   - Sets user.emailVerified = true and user.updatedAt = now().
 *   - Deletes the used token record (one-time use).
 */
authRouter.post('/verify-email/confirm', emailVerifyRateLimit, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parseResult = verifyEmailConfirmSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Validation failed', details: parseResult.error.issues });
    return;
  }

  const { token } = parseResult.data;

  try {
    const result = await authService.confirmEmailVerification(token);
    res.status(200).json({ ok: true, message: 'Email verified', accessToken: result.accessToken });
  } catch (err) {
    if (err instanceof ServiceError) {
      const code = err.message.includes('expired') ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
      res.status(400).json({ code, message: err.message });
      return;
    }
    throw err;
  }
}));

// ---------------------------------------------------------------------------
// POST /forgot-password
// ---------------------------------------------------------------------------

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

authRouter.post('/forgot-password', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parse = forgotPasswordSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Valid email required' });
    return;
  }

  const emailLower = parse.data.email.toLowerCase();

  // Always return 200 to prevent email enumeration
  const [user] = await db.select().from(users).where(eq(users.email, emailLower)).limit(1);
  if (!user) {
    res.status(200).json({ message: 'If that email is registered, a reset link has been sent.' });
    return;
  }

  // Delete any existing reset tokens for this user
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));

  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.insert(passwordResetTokens).values({ userId: user.id, token: tokenHash, expiresAt });

  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  try {
    await sendPasswordResetEmail(user.email, rawToken, appUrl);
  } catch (err) {
    logger.error('Failed to send password reset email:', err);
  }

  res.status(200).json({ message: 'If that email is registered, a reset link has been sent.' });
}));

// ---------------------------------------------------------------------------
// POST /reset-password
// ---------------------------------------------------------------------------

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

authRouter.post('/reset-password', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parse = resetPasswordSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Validation failed', details: parse.error.issues });
    return;
  }

  const { token, password } = parse.data;
  const tokenHash = hashToken(token);

  const [record] = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.token, tokenHash))
    .limit(1);

  if (!record || record.expiresAt < new Date()) {
    if (record) await db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, record.id));
    res.status(400).json({ code: 'INVALID_TOKEN', message: 'Reset link is invalid or has expired.' });
    return;
  }

  const passwordHash = await argon2.hash(password);
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, record.userId));
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, record.id));
  // Invalidate all existing sessions
  await db.delete(refreshTokens).where(eq(refreshTokens.userId, record.userId));

  res.status(200).json({ ok: true, message: 'Password updated successfully.' });
}));

// ---------------------------------------------------------------------------
// Known devices management (Login Alerts)
// ---------------------------------------------------------------------------

/**
 * GET /devices — List all known devices for the authenticated user.
 */
authRouter.get('/devices', requireAuth, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const rows = await db
    .select({
      id: userDevices.id,
      ip: userDevices.ip,
      deviceLabel: userDevices.deviceLabel,
      firstSeenAt: userDevices.firstSeenAt,
      lastSeenAt: userDevices.lastSeenAt,
    })
    .from(userDevices)
    .where(eq(userDevices.userId, req.userId!));

  res.json(rows.map(r => ({
    id: r.id,
    ip: r.ip,
    device: r.deviceLabel,
    firstSeenAt: r.firstSeenAt.toISOString(),
    lastSeenAt: r.lastSeenAt.toISOString(),
  })));
}));

/**
 * DELETE /devices/:id — Remove a known device (will trigger alert on next login from it).
 */
authRouter.delete('/devices/:id', requireAuth, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const deviceId = req.params.id as string;
  const result = await db.delete(userDevices)
    .where(and(eq(userDevices.id, deviceId), eq(userDevices.userId, req.userId!)));
  res.json({ message: 'Device removed' });
}));

/**
 * DELETE /devices — Remove all known devices (will trigger alerts on next logins).
 */
authRouter.delete('/devices', requireAuth, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  await db.delete(userDevices).where(eq(userDevices.userId, req.userId!));
  res.json({ message: 'All known devices cleared' });
}));
