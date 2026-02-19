import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { users, userProfiles, userSettings } from '@gratonite/db';
import type { AppContext } from '../../lib/context.js';
import { requireAuth } from '../../middleware/auth.js';
import { logger } from '../../lib/logger.js';

export function usersRouter(ctx: AppContext): Router {
  const router = Router();

  // ── GET /api/v1/users/@me ──────────────────────────────────────────────
  // Returns the current authenticated user's profile
  router.get('/@me', requireAuth(ctx), async (req, res) => {
    try {
      const userId = BigInt(req.user!.userId);

      const [user] = await ctx.db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        res.status(404).json({
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        });
        return;
      }

      const [profile] = await ctx.db
        .select()
        .from(userProfiles)
        .where(eq(userProfiles.userId, userId))
        .limit(1);

      const [settings] = await ctx.db
        .select()
        .from(userSettings)
        .where(eq(userSettings.userId, userId))
        .limit(1);

      res.json({
        id: user.id.toString(),
        username: user.username,
        email: user.email,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt.toISOString(),
        profile: profile
          ? {
              displayName: profile.displayName,
              avatarHash: profile.avatarHash,
              avatarAnimated: profile.avatarAnimated,
              bannerHash: profile.bannerHash,
              bannerAnimated: profile.bannerAnimated,
              accentColor: profile.accentColor,
              bio: profile.bio,
              pronouns: profile.pronouns,
              themePreference: profile.themePreference,
              tier: profile.tier,
            }
          : null,
        settings: settings
          ? {
              locale: settings.locale,
              theme: settings.theme,
              messageDisplay: settings.messageDisplay,
              reducedMotion: settings.reducedMotion,
              highContrast: settings.highContrast,
              fontScale: settings.fontScale,
              calmMode: settings.calmMode,
              developerMode: settings.developerMode,
            }
          : null,
      });
    } catch (err) {
      logger.error({ err }, 'Error fetching user profile');
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'An error occurred',
      });
    }
  });

  // ── PATCH /api/v1/users/@me ────────────────────────────────────────────
  // Update current user's profile
  router.patch('/@me', requireAuth(ctx), async (req, res) => {
    try {
      const userId = BigInt(req.user!.userId);
      const { displayName, bio, pronouns, accentColor } = req.body;

      const updateData: Record<string, unknown> = {};
      if (displayName !== undefined) updateData.displayName = displayName;
      if (bio !== undefined) updateData.bio = bio;
      if (pronouns !== undefined) updateData.pronouns = pronouns;
      if (accentColor !== undefined) updateData.accentColor = accentColor;

      if (Object.keys(updateData).length === 0) {
        res.status(400).json({
          code: 'NO_CHANGES',
          message: 'No valid fields to update',
        });
        return;
      }

      await ctx.db
        .update(userProfiles)
        .set(updateData)
        .where(eq(userProfiles.userId, userId));

      res.json({ success: true });
    } catch (err) {
      logger.error({ err }, 'Error updating user profile');
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'An error occurred',
      });
    }
  });

  // ── PATCH /api/v1/users/@me/settings ───────────────────────────────────
  // Update current user's settings
  router.patch('/@me/settings', requireAuth(ctx), async (req, res) => {
    try {
      const userId = BigInt(req.user!.userId);
      const allowedFields = [
        'locale',
        'theme',
        'messageDisplay',
        'reducedMotion',
        'highContrast',
        'fontScale',
        'saturation',
        'developerMode',
        'streamerMode',
        'calmMode',
        'allowDmsFrom',
        'allowGroupDmInvitesFrom',
        'allowFriendRequestsFrom',
      ];

      const updateData: Record<string, unknown> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }

      if (Object.keys(updateData).length === 0) {
        res.status(400).json({
          code: 'NO_CHANGES',
          message: 'No valid fields to update',
        });
        return;
      }

      await ctx.db
        .update(userSettings)
        .set(updateData)
        .where(eq(userSettings.userId, userId));

      res.json({ success: true });
    } catch (err) {
      logger.error({ err }, 'Error updating user settings');
      res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'An error occurred',
      });
    }
  });

  return router;
}
