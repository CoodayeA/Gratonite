/**
 * routes/group-dms.ts — Express router for Group DM endpoints.
 *
 * Mounted at /api/v1/dms/group in src/routes/index.ts.
 *
 * Endpoints:
 *   POST   /                          — Create a group DM
 *   POST   /:channelId/members        — Add a member to a group DM
 *   DELETE /:channelId/members/:userId — Leave or remove a member
 *   PATCH  /:channelId                — Rename or update group icon
 *
 * @module routes/group-dms
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, inArray } from 'drizzle-orm';

import { db } from '../db/index';
import { channels } from '../db/schema/channels';
import { dmChannelMembers } from '../db/schema/channels';
import { users } from '../db/schema/users';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { getIO } from '../lib/socket-io';
import { AppError, handleAppError } from '../lib/errors.js';
import { logger } from '../lib/logger';

export const groupDmsRouter = Router();

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const createGroupDmSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(9),
  name: z.string().min(1).max(100).optional(),
});

const addMemberSchema = z.object({
  userId: z.string().uuid(),
});

const updateGroupDmSchema = z.object({
  groupName: z.string().min(1).max(100).optional(),
  groupIcon: z.string().max(255).optional(),
});

// ---------------------------------------------------------------------------
// POST / — Create a group DM
// ---------------------------------------------------------------------------

groupDmsRouter.post(
  '/',
  requireAuth,
  validate(createGroupDmSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.userId!;
      const { userIds, name } = req.body as z.infer<typeof createGroupDmSchema>;

      // Validate all target users exist
      const targetUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(inArray(users.id, userIds));

      if (targetUsers.length !== userIds.length) {
        throw new AppError(400, 'One or more user IDs are invalid', 'VALIDATION_ERROR');
      }

      // Ensure creator is not in the userIds list
      const allParticipantIds = [...new Set([userId, ...userIds])];
      if (allParticipantIds.length > 10) {
        throw new AppError(400, 'Group DMs can have at most 10 participants', 'VALIDATION_ERROR');
      }

      // Create the group DM channel
      const [channel] = await db
        .insert(channels)
        .values({
          name: name || 'Group DM',
          type: 'GROUP_DM',
          guildId: null,
          isGroup: true,
          groupName: name || null,
          ownerId: userId,
        })
        .returning();

      // Insert all participants
      await db.insert(dmChannelMembers).values(
        allParticipantIds.map((uid) => ({
          channelId: channel.id,
          userId: uid,
        })),
      );

      // Fetch participant info to return
      const participantInfo = await db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarHash: users.avatarHash,
          status: users.status,
        })
        .from(users)
        .where(inArray(users.id, allParticipantIds));

      res.status(201).json({
        ...channel,
        participants: participantInfo,
      });
    } catch (err) {
      handleAppError(res, err, 'group-dms');
    }
  },
);

// ---------------------------------------------------------------------------
// POST /:channelId/members — Add a member
// ---------------------------------------------------------------------------

groupDmsRouter.post(
  '/:channelId/members',
  requireAuth,
  validate(addMemberSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.userId!;
      const { channelId } = req.params as Record<string, string>;
      const { userId: newUserId } = req.body as z.infer<typeof addMemberSchema>;

      // Fetch channel
      const [channel] = await db
        .select()
        .from(channels)
        .where(and(eq(channels.id, channelId), eq(channels.isGroup, true)))
        .limit(1);

      if (!channel) {
        throw new AppError(404, 'Group DM not found', 'NOT_FOUND');
      }

      // Verify requester is a member
      const [membership] = await db
        .select({ id: dmChannelMembers.id })
        .from(dmChannelMembers)
        .where(
          and(
            eq(dmChannelMembers.channelId, channelId),
            eq(dmChannelMembers.userId, userId),
          ),
        )
        .limit(1);

      if (!membership) {
        throw new AppError(403, 'You are not a member of this group DM', 'FORBIDDEN');
      }

      // Check max participants
      const existingMembers = await db
        .select({ userId: dmChannelMembers.userId })
        .from(dmChannelMembers)
        .where(eq(dmChannelMembers.channelId, channelId));

      if (existingMembers.length >= 10) {
        throw new AppError(400, 'Group DMs can have at most 10 participants', 'VALIDATION_ERROR');
      }

      // Check if already a member
      if (existingMembers.some((m) => m.userId === newUserId)) {
        throw new AppError(400, 'User is already a member of this group DM', 'CONFLICT');
      }

      // Verify target user exists
      const [targetUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, newUserId))
        .limit(1);

      if (!targetUser) {
        throw new AppError(404, 'User not found', 'NOT_FOUND');
      }

      await db.insert(dmChannelMembers).values({
        channelId,
        userId: newUserId,
      });

      // Return updated member list
      const allMemberIds = [...existingMembers.map((m) => m.userId), newUserId];
      const memberInfo = await db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarHash: users.avatarHash,
          status: users.status,
        })
        .from(users)
        .where(inArray(users.id, allMemberIds));

      res.status(200).json({ members: memberInfo });

      // Emit key rotation event so the group owner can re-wrap the group key
      try {
        getIO().to(`channel:${channelId}`).emit('GROUP_KEY_ROTATION_NEEDED', {
          channelId,
          reason: 'member_added',
        });
      } catch (err) {
        logger.debug({ msg: 'socket emit failed', event: 'GROUP_KEY_ROTATION_NEEDED', err });
      }
    } catch (err) {
      handleAppError(res, err, 'group-dms');
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /:channelId/members/:userId — Leave or remove a member
// ---------------------------------------------------------------------------

groupDmsRouter.delete(
  '/:channelId/members/:userId',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const currentUserId = req.userId!;
      const { channelId, userId: targetUserId } = req.params as Record<string, string>;

      // Fetch channel
      const [channel] = await db
        .select()
        .from(channels)
        .where(and(eq(channels.id, channelId), eq(channels.isGroup, true)))
        .limit(1);

      if (!channel) {
        throw new AppError(404, 'Group DM not found', 'NOT_FOUND');
      }

      if (currentUserId === targetUserId) {
        // Leaving — always allowed
      } else {
        // Removing another — only owner
        if (channel.ownerId !== currentUserId) {
          throw new AppError(403, 'Only the group owner can remove members', 'FORBIDDEN');
        }
      }

      // Remove the member
      await db
        .delete(dmChannelMembers)
        .where(
          and(
            eq(dmChannelMembers.channelId, channelId),
            eq(dmChannelMembers.userId, targetUserId),
          ),
        );

      // Check remaining participants
      const remaining = await db
        .select({ userId: dmChannelMembers.userId })
        .from(dmChannelMembers)
        .where(eq(dmChannelMembers.channelId, channelId));

      if (remaining.length === 0) {
        // No participants left — delete the channel
        await db.delete(channels).where(eq(channels.id, channelId));
        res.status(200).json({ code: 'OK', message: 'Group DM deleted (no members remaining)' });
        return;
      }

      // If the owner left, transfer ownership to the first remaining member
      if (currentUserId === targetUserId && channel.ownerId === currentUserId) {
        await db
          .update(channels)
          .set({ ownerId: remaining[0].userId, updatedAt: new Date() })
          .where(eq(channels.id, channelId));
      }

      res.status(200).json({ code: 'OK', message: 'Member removed' });

      // Emit key rotation event so the group owner can re-wrap with a new key
      if (remaining.length > 0) {
        try {
          getIO().to(`channel:${channelId}`).emit('GROUP_KEY_ROTATION_NEEDED', {
            channelId,
            reason: 'member_removed',
          });
        } catch {
          // Non-fatal if Socket.io not initialised.
        }
      }
    } catch (err) {
      handleAppError(res, err, 'group-dms');
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /:channelId — Rename or update icon
// ---------------------------------------------------------------------------

groupDmsRouter.patch(
  '/:channelId',
  requireAuth,
  validate(updateGroupDmSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.userId!;
      const { channelId } = req.params as Record<string, string>;

      const [channel] = await db
        .select()
        .from(channels)
        .where(and(eq(channels.id, channelId), eq(channels.isGroup, true)))
        .limit(1);

      if (!channel) {
        throw new AppError(404, 'Group DM not found', 'NOT_FOUND');
      }

      if (channel.ownerId !== userId) {
        throw new AppError(403, 'Only the group owner can update this group DM', 'FORBIDDEN');
      }

      const { groupName, groupIcon } = req.body as z.infer<typeof updateGroupDmSchema>;

      const updateData: Partial<typeof channels.$inferInsert> = { updatedAt: new Date() };
      if (groupName !== undefined) {
        updateData.groupName = groupName;
        updateData.name = groupName;
      }
      if (groupIcon !== undefined) updateData.groupIcon = groupIcon;

      const [updated] = await db
        .update(channels)
        .set(updateData)
        .where(eq(channels.id, channelId))
        .returning();

      res.status(200).json(updated);
    } catch (err) {
      handleAppError(res, err, 'group-dms');
    }
  },
);
