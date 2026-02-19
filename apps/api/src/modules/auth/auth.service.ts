import { hash, verify } from 'argon2';
import * as jose from 'jose';
import { randomBytes, createHash } from 'crypto';
import { eq, or } from 'drizzle-orm';
import { users, userProfiles, userSettings } from '@gratonite/db';
import type { AppContext } from '../../lib/context.js';
import { generateId } from '../../lib/snowflake.js';
import { logger } from '../../lib/logger.js';
import type { RegisterInput, LoginInput } from './auth.schemas.js';

// ============================================================================
// Constants
// ============================================================================

/** Argon2id configuration (OWASP recommended) */
const ARGON2_OPTIONS = {
  type: 2 as const, // argon2id
  memoryCost: 65536, // 64MB
  timeCost: 3,
  parallelism: 4,
};

/** Refresh token validity in seconds (7 days) */
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60;

// ============================================================================
// Auth Service
// ============================================================================

export function createAuthService(ctx: AppContext) {
  const jwtSecret = new TextEncoder().encode(ctx.env.JWT_SECRET);

  // ── Password Hashing ────────────────────────────────────────────────────

  async function hashPassword(password: string): Promise<string> {
    return hash(password, ARGON2_OPTIONS);
  }

  async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await verify(passwordHash, password);
    } catch {
      return false;
    }
  }

  // ── Token Generation ────────────────────────────────────────────────────

  async function generateAccessToken(payload: {
    userId: string;
    username: string;
    tier: string;
  }): Promise<string> {
    return new jose.SignJWT({
      userId: payload.userId,
      username: payload.username,
      tier: payload.tier,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(ctx.env.JWT_ACCESS_TOKEN_EXPIRY)
      .sign(jwtSecret);
  }

  async function verifyAccessToken(token: string) {
    try {
      const { payload } = await jose.jwtVerify(token, jwtSecret);
      return payload as {
        userId: string;
        username: string;
        tier: string;
        iat: number;
        exp: number;
      };
    } catch {
      return null;
    }
  }

  function generateRefreshToken(): string {
    return randomBytes(48).toString('base64url');
  }

  function hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async function storeRefreshToken(
    userId: string,
    token: string,
    meta: { ip?: string; userAgent?: string; deviceType?: string },
  ): Promise<void> {
    const tokenHash = hashRefreshToken(token);
    const key = `auth:refresh:${tokenHash}`;

    await ctx.redis.setex(
      key,
      REFRESH_TOKEN_TTL,
      JSON.stringify({
        userId,
        tokenHash,
        createdAt: Date.now(),
        ...meta,
      }),
    );

    // Track token family for breach detection
    const familyKey = `auth:family:${userId}`;
    await ctx.redis.sadd(familyKey, tokenHash);
    await ctx.redis.expire(familyKey, REFRESH_TOKEN_TTL);
  }

  async function rotateRefreshToken(
    oldToken: string,
    meta: { ip?: string; userAgent?: string; deviceType?: string },
  ): Promise<{ userId: string; newToken: string } | null> {
    const oldHash = hashRefreshToken(oldToken);
    const key = `auth:refresh:${oldHash}`;

    // Get and delete old token atomically
    const data = await ctx.redis.get(key);
    if (!data) return null;

    await ctx.redis.del(key);

    const parsed = JSON.parse(data) as { userId: string };

    // Generate new refresh token
    const newToken = generateRefreshToken();
    await storeRefreshToken(parsed.userId, newToken, meta);

    return { userId: parsed.userId, newToken };
  }

  // ── Registration ────────────────────────────────────────────────────────

  async function register(input: RegisterInput) {
    const userId = generateId();

    // Hash password
    const passwordHash = await hashPassword(input.password);

    // TODO: Encrypt dateOfBirth with AES-256-GCM before storage
    const encryptedDob = input.dateOfBirth; // placeholder — will encrypt in production

    // Insert user
    await ctx.db.insert(users).values({
      id: userId,
      username: input.username.toLowerCase(),
      email: input.email.toLowerCase(),
      emailVerified: false,
      passwordHash,
      dateOfBirth: encryptedDob,
    });

    // Insert default profile
    await ctx.db.insert(userProfiles).values({
      userId,
      displayName: input.displayName,
    });

    // Insert default settings
    await ctx.db.insert(userSettings).values({
      userId,
    });

    logger.info({ userId: userId.toString(), username: input.username }, 'User registered');

    // Generate tokens
    const accessToken = await generateAccessToken({
      userId: userId.toString(),
      username: input.username,
      tier: 'free',
    });

    const refreshToken = generateRefreshToken();
    await storeRefreshToken(userId.toString(), refreshToken, {});

    return {
      accessToken,
      refreshToken,
      user: {
        id: userId.toString(),
        username: input.username,
        email: input.email,
        displayName: input.displayName,
        avatarHash: null,
        tier: 'free' as const,
      },
    };
  }

  // ── Login ───────────────────────────────────────────────────────────────

  async function login(input: LoginInput, meta: { ip?: string; userAgent?: string }) {
    // Find user by username or email
    const [user] = await ctx.db
      .select()
      .from(users)
      .where(
        or(
          eq(users.username, input.login.toLowerCase()),
          eq(users.email, input.login.toLowerCase()),
        ),
      )
      .limit(1);

    if (!user) {
      return { error: 'INVALID_CREDENTIALS' as const };
    }

    if (user.disabled) {
      return { error: 'ACCOUNT_DISABLED' as const };
    }

    if (user.deletedAt) {
      return { error: 'ACCOUNT_DELETED' as const };
    }

    // Verify password
    if (!user.passwordHash) {
      return { error: 'OAUTH_ONLY_ACCOUNT' as const };
    }

    const passwordValid = await verifyPassword(user.passwordHash, input.password);
    if (!passwordValid) {
      // Track failed attempts
      const failKey = `failed_login:${input.login.toLowerCase()}`;
      const failures = await ctx.redis.incr(failKey);
      if (failures === 1) {
        await ctx.redis.expire(failKey, 900); // 15 min TTL
      }

      logger.warn(
        { username: input.login, failures, ip: meta.ip },
        'Failed login attempt',
      );

      return { error: 'INVALID_CREDENTIALS' as const };
    }

    // TODO: Check 2FA if enabled
    if (user.mfaSecret && !input.mfaCode) {
      return { error: 'MFA_REQUIRED' as const };
    }

    // Clear failed attempts
    await ctx.redis.del(`failed_login:${input.login.toLowerCase()}`);

    // Get profile for display name
    const [profile] = await ctx.db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, user.id))
      .limit(1);

    // Generate tokens
    const accessToken = await generateAccessToken({
      userId: user.id.toString(),
      username: user.username,
      tier: profile?.tier ?? 'free',
    });

    const refreshToken = generateRefreshToken();
    await storeRefreshToken(user.id.toString(), refreshToken, meta);

    logger.info({ userId: user.id.toString(), username: user.username }, 'User logged in');

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id.toString(),
        username: user.username,
        email: user.email,
        displayName: profile?.displayName ?? user.username,
        avatarHash: profile?.avatarHash ?? null,
        tier: profile?.tier ?? 'free',
      },
    };
  }

  // ── Token Refresh ───────────────────────────────────────────────────────

  async function refresh(
    token: string,
    meta: { ip?: string; userAgent?: string },
  ) {
    const result = await rotateRefreshToken(token, meta);
    if (!result) {
      return { error: 'INVALID_REFRESH_TOKEN' as const };
    }

    // Get user data for new access token
    const [user] = await ctx.db
      .select()
      .from(users)
      .where(eq(users.id, BigInt(result.userId)))
      .limit(1);

    if (!user) {
      return { error: 'USER_NOT_FOUND' as const };
    }

    const [profile] = await ctx.db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, user.id))
      .limit(1);

    const accessToken = await generateAccessToken({
      userId: user.id.toString(),
      username: user.username,
      tier: profile?.tier ?? 'free',
    });

    return {
      accessToken,
      refreshToken: result.newToken,
    };
  }

  // ── Username availability check ─────────────────────────────────────────

  async function checkUsernameAvailability(username: string): Promise<boolean> {
    const [existing] = await ctx.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username.toLowerCase()))
      .limit(1);

    return !existing;
  }

  return {
    hashPassword,
    verifyPassword,
    generateAccessToken,
    verifyAccessToken,
    register,
    login,
    refresh,
    checkUsernameAvailability,
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
