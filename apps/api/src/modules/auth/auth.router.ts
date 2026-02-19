import { Router } from 'express';
import type { AppContext } from '../../lib/context.js';
import { createAuthService } from './auth.service.js';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  usernameAvailabilitySchema,
} from './auth.schemas.js';
import { authRateLimiter, registerRateLimiter } from '../../middleware/rate-limiter.js';
import { logger } from '../../lib/logger.js';

export function authRouter(ctx: AppContext): Router {
  const router = Router();
  const authService = createAuthService(ctx);

  // ── POST /api/v1/auth/register ─────────────────────────────────────────
  router.post('/register', registerRateLimiter, async (req, res) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: 'Invalid registration data',
          details: parsed.error.flatten().fieldErrors,
        });
        return;
      }

      // Check username availability
      const isAvailable = await authService.checkUsernameAvailability(parsed.data.username);
      if (!isAvailable) {
        res.status(409).json({
          code: 'USERNAME_TAKEN',
          message: 'This username is already taken',
        });
        return;
      }

      const result = await authService.register(parsed.data);

      // Set refresh token as HttpOnly cookie
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: ctx.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/api/v1/auth',
      });

      res.status(201).json({
        accessToken: result.accessToken,
        user: result.user,
      });
    } catch (err: unknown) {
      // Handle unique constraint violations
      if (err instanceof Error && err.message.includes('unique')) {
        if (err.message.includes('username')) {
          res.status(409).json({
            code: 'USERNAME_TAKEN',
            message: 'This username is already taken',
          });
          return;
        }
        if (err.message.includes('email')) {
          res.status(409).json({
            code: 'EMAIL_TAKEN',
            message: 'An account with this email already exists',
          });
          return;
        }
      }
      logger.error({ err }, 'Registration error');
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'An error occurred during registration',
      });
    }
  });

  // ── POST /api/v1/auth/login ────────────────────────────────────────────
  router.post('/login', authRateLimiter, async (req, res) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: 'Invalid login data',
          details: parsed.error.flatten().fieldErrors,
        });
        return;
      }

      const result = await authService.login(parsed.data, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      if ('error' in result) {
        const statusMap = {
          INVALID_CREDENTIALS: 401,
          ACCOUNT_DISABLED: 403,
          ACCOUNT_DELETED: 410,
          OAUTH_ONLY_ACCOUNT: 400,
          MFA_REQUIRED: 403,
        } as const;

        const messageMap = {
          INVALID_CREDENTIALS: 'Invalid username/email or password',
          ACCOUNT_DISABLED: 'This account has been disabled',
          ACCOUNT_DELETED: 'This account has been deleted',
          OAUTH_ONLY_ACCOUNT: 'This account uses Google sign-in. Please use that method.',
          MFA_REQUIRED: 'Two-factor authentication code required',
        } as const;

        res.status(statusMap[result.error]).json({
          code: result.error,
          message: messageMap[result.error],
        });
        return;
      }

      // Set refresh token as HttpOnly cookie
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: ctx.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/api/v1/auth',
      });

      res.json({
        accessToken: result.accessToken,
        user: result.user,
      });
    } catch (err) {
      logger.error({ err }, 'Login error');
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'An error occurred during login',
      });
    }
  });

  // ── POST /api/v1/auth/refresh ──────────────────────────────────────────
  router.post('/refresh', async (req, res) => {
    try {
      const token = req.cookies?.refreshToken ?? req.body?.refreshToken;
      if (!token) {
        res.status(401).json({
          code: 'NO_REFRESH_TOKEN',
          message: 'Refresh token is required',
        });
        return;
      }

      const result = await authService.refresh(token, {
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      if ('error' in result) {
        res.status(401).json({
          code: result.error,
          message: 'Invalid or expired refresh token',
        });
        return;
      }

      // Rotate cookie
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: ctx.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/api/v1/auth',
      });

      res.json({ accessToken: result.accessToken });
    } catch (err) {
      logger.error({ err }, 'Token refresh error');
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'An error occurred during token refresh',
      });
    }
  });

  // ── GET /api/v1/auth/username-available?username=xxx ───────────────────
  router.get('/username-available', async (req, res) => {
    try {
      const parsed = usernameAvailabilitySchema.safeParse({ username: req.query['username'] });
      if (!parsed.success) {
        res.status(400).json({
          code: 'VALIDATION_ERROR',
          message: 'Invalid username format',
        });
        return;
      }

      const available = await authService.checkUsernameAvailability(parsed.data.username);
      res.json({ available });
    } catch (err) {
      logger.error({ err }, 'Username check error');
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'An error occurred',
      });
    }
  });

  // ── POST /api/v1/auth/logout ───────────────────────────────────────────
  router.post('/logout', (_req, res) => {
    res.clearCookie('refreshToken', { path: '/api/v1/auth' });
    res.json({ success: true });
  });

  return router;
}
