/// <reference types="node" />

/**
 * services/auth.service.ts — Business logic for authentication operations.
 *
 * Extracted from routes/auth.ts to separate HTTP concerns from domain logic.
 * Route handlers validate input and translate service errors to HTTP responses.
 *
 * @module services/auth.service
 */

import * as argon2 from 'argon2';
import crypto from 'crypto';
import { eq, sql } from 'drizzle-orm';

import { db } from '../db/index';
import { users } from '../db/schema/users';
import { refreshTokens, emailVerificationTokens } from '../db/schema/auth';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt';
import { sendVerificationEmail, sendNewDeviceLoginAlert } from '../lib/mailer';
import { logger } from '../lib/logger';
import { redis } from '../lib/redis';
import { referrals as referralsTable } from '../db/schema/referrals';
import { userDevices } from '../db/schema/user-devices';
import { ServiceError } from './guild.service';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Helpers (private to service)
// ---------------------------------------------------------------------------

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function generateRawToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

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

function getClientIp(req: { headers: Record<string, string | string[] | undefined>; ip?: string; socket: { remoteAddress?: string } }): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.ip || req.socket.remoteAddress || '';
}

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

// MFA helpers needed by login — these stay in auth.ts but we need them here too
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const MFA_TOTP_STEP_SECONDS = 30;
const MFA_TOTP_DIGITS = 6;
const MFA_BACKUP_KEY_PREFIX = 'auth:mfa:backup:';

type MfaBackupCodesCache = {
  hashes: string[];
  updatedAt: number;
};

function getMfaEncryptionKey(): Buffer {
  const keyMaterial = process.env.MFA_ENCRYPTION_KEY || (process.env.NODE_ENV === 'production' ? (() => { throw new Error('MFA_ENCRYPTION_KEY is required in production'); })() : 'gratonite-dev-mfa-key');
  return crypto.createHash('sha256').update(keyMaterial).digest();
}

function fromBase64Url(input: string): Buffer {
  return Buffer.from(input, 'base64url');
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

function getMfaBackupKey(userId: string): string {
  return `${MFA_BACKUP_KEY_PREFIX}${userId}`;
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  displayName?: string;
  referralCode?: string;
}

export interface RegisterResult {
  email: string;
}

export interface LoginData {
  login: string;
  password: string;
  mfaCode?: string;
  userAgent?: string;
  clientIp: string;
}

export interface LoginResult {
  accessToken: string;
  rawRefreshToken: string;
  user: ReturnType<typeof safeUserResponse>;
}

export interface RefreshResult {
  accessToken: string;
}

export interface ConfirmEmailResult {
  accessToken: string;
}

// Re-export for route handler
export { safeUserResponse };

// ---------------------------------------------------------------------------
// Service methods
// ---------------------------------------------------------------------------

/**
 * Register a new user account.
 *
 * @throws ServiceError('CONFLICT') if username or email is taken
 * @throws ServiceError('VALIDATION_ERROR') if email domain is blocked
 */
export async function register(data: RegisterData): Promise<RegisterResult> {
  const { username, email, password, displayName, referralCode } = data;

  // Block internal email domains
  const emailDomain = email.split('@')[1]?.toLowerCase();
  if (emailDomain === 'gratonite.internal') {
    throw new ServiceError('VALIDATION_ERROR', 'This email domain is not allowed for registration');
  }

  // Check username availability (case-insensitive)
  const existingByUsername = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.username}) = lower(${username})`)
    .limit(1);

  if (existingByUsername.length > 0) {
    throw new ServiceError('CONFLICT', 'Username is already taken');
  }

  // Check email availability (case-insensitive)
  const existingByEmail = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`)
    .limit(1);

  if (existingByEmail.length > 0) {
    throw new ServiceError('CONFLICT', 'Email is already registered');
  }

  // Hash password with argon2id
  const passwordHash = await argon2.hash(password);

  // Insert user
  const [newUser] = await db
    .insert(users)
    .values({
      username,
      email: email.toLowerCase(),
      passwordHash,
      displayName: displayName ?? username,
      emailVerified: false,
    })
    .returning();

  // Handle referral code if provided
  if (referralCode) {
    try {
      const [referral] = await db.select().from(referralsTable).where(eq(referralsTable.code, String(referralCode))).limit(1);
      if (referral && !referral.referredId) {
        await db.update(referralsTable).set({ referredId: newUser.id, redeemedAt: new Date() }).where(eq(referralsTable.id, referral.id));
      }
    } catch { /* non-fatal */ }
  }

  // Generate and store email verification token
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFY_TTL_MS);

  await db.insert(emailVerificationTokens).values({
    userId: newUser.id,
    token: tokenHash,
    email: email.toLowerCase(),
    expiresAt,
  });

  // Send verification email (non-fatal on failure)
  if (!process.env.APP_URL) {
    console.warn('[auth] WARNING: APP_URL is not set, falling back to http://localhost:5173. Set APP_URL in production.');
  }
  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  try {
    await sendVerificationEmail(email, rawToken, appUrl);
  } catch (err) {
    logger.error('Failed to send verification email:', err);
  }

  return { email: email.toLowerCase() };
}

/**
 * Authenticate a user and generate tokens.
 *
 * @throws ServiceError('UNAUTHORIZED') if credentials are invalid
 * @throws ServiceError('FORBIDDEN') if bot account
 * @throws ServiceError('MFA_REQUIRED') if MFA enabled but no code provided
 * @throws ServiceError('INVALID_MFA_CODE') if MFA code is wrong
 */
export async function login(data: LoginData): Promise<LoginResult> {
  const { login: loginValue, password, mfaCode, userAgent, clientIp } = data;

  // Look up user by username OR email
  const isEmail = loginValue.includes('@');
  const [user] = await db
    .select()
    .from(users)
    .where(
      isEmail
        ? sql`lower(${users.email}) = lower(${loginValue})`
        : sql`lower(${users.username}) = lower(${loginValue})`
    )
    .limit(1);

  // Verify password with timing-safe fallback
  const DUMMY_HASH =
    '$argon2id$v=19$m=65536,t=3,p=4$dGVzdHNhbHQ$LJVWzabEFHFa1lJwE0XFtGrn9H3wBlJEY6rElBm7Lhk';

  const passwordValid = user
    ? await argon2.verify(user.passwordHash, password)
    : await argon2.verify(DUMMY_HASH, password).then(() => false).catch(() => false);

  if (!user || !passwordValid) {
    throw new ServiceError('UNAUTHORIZED', 'Invalid credentials');
  }

  // Block bot accounts
  if (user.isBot) {
    throw new ServiceError('FORBIDDEN', 'Bot accounts cannot log in via this endpoint');
  }

  // Enforce MFA if enabled
  if (user.mfaEnabled) {
    if (!mfaCode) {
      throw new ServiceError('MFA_REQUIRED', 'Two-factor authentication code required');
    }

    let mfaVerified = false;
    try {
      if (user.mfaSecret) {
        const decryptedSecret = decryptMfaSecret(user.mfaSecret);
        mfaVerified = verifyTotpCode(decryptedSecret, mfaCode);
      }
    } catch {
      mfaVerified = false;
    }

    // Allow one-time backup codes as fallback
    if (!mfaVerified) {
      const backupHashes = await getMfaBackupHashes(user.id);
      const codeHash = hashBackupCode(mfaCode, user.id);
      let idx = backupHashes.indexOf(codeHash);
      // Fallback: check legacy unsalted hash
      if (idx < 0) {
        const legacyHash = hashToken(normalizeBackupCode(mfaCode));
        idx = backupHashes.indexOf(legacyHash);
      }
      if (idx >= 0) {
        backupHashes.splice(idx, 1);
        await setMfaBackupHashes(user.id, backupHashes);
        mfaVerified = true;
      }
    }

    if (!mfaVerified) {
      throw new ServiceError('VALIDATION_ERROR', 'Invalid authentication code');
    }
  }

  // Sign tokens
  const accessToken = signAccessToken(user.id);
  const rawRefreshToken = signRefreshToken(user.id);

  // Store refresh token hash
  const tokenHash = hashToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  const device = parseDevice(userAgent);

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash,
    expiresAt,
    device,
    ip: clientIp,
    lastActiveAt: new Date(),
  });

  // New-device login alert (non-blocking)
  try {
    const uaHash = crypto
      .createHash('sha256')
      .update(userAgent || '')
      .digest('hex');

    const [inserted] = await db
      .insert(userDevices)
      .values({
        userId: user.id,
        ip: clientIp,
        userAgentHash: uaHash,
        deviceLabel: device,
      })
      .onConflictDoUpdate({
        target: [userDevices.userId, userDevices.ip, userDevices.userAgentHash],
        set: { lastSeenAt: new Date() },
      })
      .returning({ firstSeenAt: userDevices.firstSeenAt });

    const isNewDevice = inserted && (Date.now() - new Date(inserted.firstSeenAt).getTime()) < 5000;

    if (isNewDevice && user.email) {
      const appUrl = process.env.APP_URL || 'https://gratonite.chat';
      sendNewDeviceLoginAlert({
        to: user.email,
        ip: clientIp,
        device,
        timestamp: new Date(),
        appUrl,
      }).catch(() => { /* email delivery failure is non-critical */ });
    }
  } catch {
    // Device tracking is non-critical
  }

  // Streak logic (non-critical)
  try {
    const today = new Date().toISOString().split('T')[0];
    const lastStreak = user.lastStreakAt;
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    let streakUpdate: Record<string, unknown> = {};
    let coinsGrant = 0;

    if (!lastStreak) {
      streakUpdate = { currentStreak: 1, longestStreak: 1, lastStreakAt: today };
      coinsGrant = 10;
    } else if (lastStreak === yesterday) {
      const newStreak = (user.currentStreak ?? 0) + 1;
      const longestStreak = Math.max(newStreak, user.longestStreak ?? 0);
      coinsGrant = Math.min(newStreak * 10, 200);
      streakUpdate = { currentStreak: newStreak, longestStreak, lastStreakAt: today };

      if (newStreak >= 7) {
        const { checkAchievements } = await import('../routes/achievements');
        await checkAchievements(user.id, 'streak_7');
      }
      if (newStreak >= 30) {
        const { checkAchievements } = await import('../routes/achievements');
        await checkAchievements(user.id, 'streak_30');
      }
    } else if (lastStreak === today) {
      streakUpdate = {};
      coinsGrant = 0;
    } else {
      streakUpdate = { currentStreak: 1, lastStreakAt: today };
      coinsGrant = 10;
    }

    if (Object.keys(streakUpdate).length > 0) {
      if (coinsGrant > 0) streakUpdate.coins = sql`coins + ${coinsGrant}`;
      await db.update(users).set(streakUpdate as any).where(eq(users.id, user.id));
    }
  } catch {
    // Non-critical
  }

  return {
    accessToken,
    rawRefreshToken,
    user: safeUserResponse(user),
  };
}

/**
 * Exchange a valid refresh token for a new access token.
 *
 * @throws ServiceError('UNAUTHORIZED') if token is invalid, expired, or mismatched
 */
export async function refreshToken(rawToken: string): Promise<RefreshResult> {
  // Verify JWT signature
  let userId: string;
  try {
    ({ userId } = verifyRefreshToken(rawToken));
  } catch {
    throw new ServiceError('UNAUTHORIZED', 'Invalid or expired refresh token');
  }

  // Verify token hash exists in DB
  const tokenHash = hashToken(rawToken);
  const [storedToken] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash))
    .limit(1);

  if (!storedToken || storedToken.expiresAt < new Date()) {
    throw new ServiceError('UNAUTHORIZED', 'Refresh token is invalid or has expired');
  }

  // Confirm token belongs to the right user
  if (storedToken.userId !== userId) {
    throw new ServiceError('UNAUTHORIZED', 'Refresh token mismatch');
  }

  // Update last-active timestamp
  await db.update(refreshTokens)
    .set({ lastActiveAt: new Date() })
    .where(eq(refreshTokens.tokenHash, tokenHash));

  // Issue new access token
  const accessToken = signAccessToken(userId);

  return { accessToken };
}

/**
 * Revoke a refresh token (logout).
 */
export async function logout(rawToken: string | undefined): Promise<void> {
  if (rawToken) {
    const tokenHash = hashToken(rawToken);
    await db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));
  }
}

/**
 * Request (re)sending a verification email.
 * Always succeeds to prevent email enumeration.
 *
 * @returns message string
 */
export async function requestEmailVerification(email: string): Promise<string> {
  const emailLower = email.toLowerCase();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, emailLower))
    .limit(1);

  // Return success whether the email is registered or not (prevent enumeration)
  if (!user) {
    return 'Verification email sent';
  }

  if (user.emailVerified) {
    return 'Email is already verified';
  }

  // Delete existing verification tokens for this user
  await db
    .delete(emailVerificationTokens)
    .where(eq(emailVerificationTokens.userId, user.id));

  // Create new token and send email
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFY_TTL_MS);

  await db.insert(emailVerificationTokens).values({
    userId: user.id,
    token: tokenHash,
    email: emailLower,
    expiresAt,
  });

  if (!process.env.APP_URL) {
    console.warn('[auth] WARNING: APP_URL is not set, falling back to http://localhost:5173. Set APP_URL in production.');
  }
  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  try {
    await sendVerificationEmail(email, rawToken, appUrl);
  } catch (err) {
    logger.error('Failed to send verification email:', err);
  }

  return 'Verification email sent';
}

/**
 * Confirm email verification token.
 *
 * @throws ServiceError('VALIDATION_ERROR') if token is invalid or expired
 */
export async function confirmEmailVerification(token: string): Promise<ConfirmEmailResult> {
  const providedHash = hashToken(token);
  const [tokenRecord] = await db
    .select()
    .from(emailVerificationTokens)
    .where(eq(emailVerificationTokens.token, providedHash))
    .limit(1);

  if (!tokenRecord) {
    throw new ServiceError('VALIDATION_ERROR', 'Invalid or expired verification token');
  }

  if (tokenRecord.expiresAt < new Date()) {
    await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.id, tokenRecord.id));
    throw new ServiceError('VALIDATION_ERROR', 'Verification token has expired. Please request a new one.');
  }

  // Mark user as verified
  await db
    .update(users)
    .set({ emailVerified: true, updatedAt: new Date() })
    .where(eq(users.id, tokenRecord.userId));

  // Delete used token
  await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.id, tokenRecord.id));

  // Issue access token for auto-login
  const accessToken = signAccessToken(tokenRecord.userId);

  return { accessToken };
}
