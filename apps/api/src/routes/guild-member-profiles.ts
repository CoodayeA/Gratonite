/**
 * routes/guild-member-profiles.ts — Per-server member profile endpoints.
 *
 * Mounted at /api/v1/guilds/:guildId/members in src/routes/index.ts.
 *
 * Endpoints:
 *   GET    /:userId/server-profile  — Get server profile (falls back to global)
 *   PUT    /@me/server-profile      — Set own server profile (upsert)
 *   DELETE /@me/server-profile      — Remove server profile (revert to global)
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index';
import { guildMemberProfiles } from '../db/schema/guild-member-profiles';
import { guildMembers, guilds } from '../db/schema/guilds';
import { users } from '../db/schema/users';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { getIO } from '../lib/socket-io';
import { logger } from '../lib/logger';

export const guildMemberProfilesRouter = Router({ mergeParams: true });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireMembership(guildId: string, userId: string): Promise<void> {
  const [membership] = await db
    .select({ id: guildMembers.id })
    .from(guildMembers)
    .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, userId)))
    .limit(1);

  if (!membership) {
    throw { status: 403, code: 'FORBIDDEN', message: 'You are not a member of this guild' };
  }
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const upsertServerProfileSchema = z.object({
  displayName: z.string().max(64).nullable().optional(),
  avatarUrl: z.string().max(2000).nullable().optional(),
  bio: z.string().max(190).nullable().optional(),
});

// ---------------------------------------------------------------------------
// GET /:userId/server-profile — Get server profile (falls back to global)
// ---------------------------------------------------------------------------

guildMemberProfilesRouter.get(
  '/:userId/server-profile',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const guildId = req.params.guildId as string;
      const userId = req.params.userId as string;
      await requireMembership(guildId, req.userId!);

      const targetUserId = userId === '@me' ? req.userId! : userId;

      // Fetch the server profile if it exists
      const [serverProfile] = await db
        .select()
        .from(guildMemberProfiles)
        .where(and(eq(guildMemberProfiles.guildId, guildId), eq(guildMemberProfiles.userId, targetUserId)))
        .limit(1);

      // Always fetch global user + guild member info for fallback
      const [memberInfo] = await db
        .select({
          userId: guildMembers.userId,
          guildId: guildMembers.guildId,
          nickname: guildMembers.nickname,
          joinedAt: guildMembers.joinedAt,
          username: users.username,
          globalDisplayName: users.displayName,
          globalAvatarHash: users.avatarHash,
          globalBannerHash: users.bannerHash,
        })
        .from(guildMembers)
        .innerJoin(users, eq(users.id, guildMembers.userId))
        .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, targetUserId)))
        .limit(1);

      if (!memberInfo) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Member not found' });
        return;
      }

      res.status(200).json({
        userId: memberInfo.userId,
        guildId: memberInfo.guildId,
        username: memberInfo.username,
        // Server profile fields take precedence when set
        displayName: serverProfile?.displayName ?? memberInfo.nickname ?? memberInfo.globalDisplayName,
        avatarUrl: serverProfile?.avatarUrl ?? null,
        avatarHash: memberInfo.globalAvatarHash,
        bio: serverProfile?.bio ?? null,
        nickname: memberInfo.nickname,
        bannerHash: memberInfo.globalBannerHash,
        joinedAt: memberInfo.joinedAt,
        hasServerProfile: !!serverProfile,
        serverProfile: serverProfile
          ? {
              displayName: serverProfile.displayName,
              avatarUrl: serverProfile.avatarUrl,
              bio: serverProfile.bio,
            }
          : null,
      });
    } catch (err: any) {
      if (err?.status) {
        res.status(err.status).json({ code: err.code, message: err.message });
        return;
      }
      logger.error({ msg: 'Failed to get server profile', err });
      res.status(500).json({ code: 'INTERNAL', message: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// PUT /@me/server-profile — Set own server profile (upsert)
// ---------------------------------------------------------------------------

guildMemberProfilesRouter.put(
  '/@me/server-profile',
  requireAuth,
  validate(upsertServerProfileSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const guildId = req.params.guildId as string;
      await requireMembership(guildId, req.userId!);

      const { displayName, avatarUrl, bio } = req.body as z.infer<typeof upsertServerProfileSchema>;

      // Check if profile already exists
      const [existing] = await db
        .select({ id: guildMemberProfiles.id })
        .from(guildMemberProfiles)
        .where(and(eq(guildMemberProfiles.guildId, guildId), eq(guildMemberProfiles.userId, req.userId!)))
        .limit(1);

      let profile;
      if (existing) {
        // Update existing profile
        const updateFields: Record<string, any> = { updatedAt: new Date() };
        if (displayName !== undefined) updateFields.displayName = displayName;
        if (avatarUrl !== undefined) updateFields.avatarUrl = avatarUrl;
        if (bio !== undefined) updateFields.bio = bio;

        [profile] = await db
          .update(guildMemberProfiles)
          .set(updateFields)
          .where(eq(guildMemberProfiles.id, existing.id))
          .returning();
      } else {
        // Insert new profile
        [profile] = await db
          .insert(guildMemberProfiles)
          .values({
            userId: req.userId!,
            guildId,
            displayName: displayName ?? null,
            avatarUrl: avatarUrl ?? null,
            bio: bio ?? null,
          })
          .returning();
      }

      // Emit socket event so other clients can update
      try {
        getIO().to(`guild:${guildId}`).emit('GUILD_MEMBER_PROFILE_UPDATE', {
          userId: req.userId,
          guildId,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          bio: profile.bio,
        });
      } catch (err) {
        logger.debug({ msg: 'socket emit failed', event: 'GUILD_MEMBER_PROFILE_UPDATE', err });
      }

      res.status(200).json(profile);
    } catch (err: any) {
      if (err?.status) {
        res.status(err.status).json({ code: err.code, message: err.message });
        return;
      }
      logger.error({ msg: 'Failed to update server profile', err });
      res.status(500).json({ code: 'INTERNAL', message: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /@me/server-profile — Remove server profile (revert to global)
// ---------------------------------------------------------------------------

guildMemberProfilesRouter.delete(
  '/@me/server-profile',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const guildId = req.params.guildId as string;
      await requireMembership(guildId, req.userId!);

      const deleted = await db
        .delete(guildMemberProfiles)
        .where(and(eq(guildMemberProfiles.guildId, guildId), eq(guildMemberProfiles.userId, req.userId!)))
        .returning();

      if (deleted.length === 0) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'No server profile to delete' });
        return;
      }

      // Emit socket event so other clients can revert to global
      try {
        getIO().to(`guild:${guildId}`).emit('GUILD_MEMBER_PROFILE_UPDATE', {
          userId: req.userId,
          guildId,
          displayName: null,
          avatarUrl: null,
          bio: null,
          deleted: true,
        });
      } catch (err) {
        logger.debug({ msg: 'socket emit failed', event: 'GUILD_MEMBER_PROFILE_UPDATE', err });
      }

      res.status(200).json({ success: true });
    } catch (err: any) {
      if (err?.status) {
        res.status(err.status).json({ code: err.code, message: err.message });
        return;
      }
      logger.error({ msg: 'Failed to delete server profile', err });
      res.status(500).json({ code: 'INTERNAL', message: 'Internal server error' });
    }
  },
);
