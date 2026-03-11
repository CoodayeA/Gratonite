/**
 * routes/relationships.ts — Express router for social graph endpoints.
 *
 * Mounted at /api/v1/relationships in src/routes/index.ts.
 *
 * Handles all relationship types stored in the `relationships` table:
 *   FRIEND           — Mutual friendship (two rows: A→B and B→A, both FRIEND)
 *   PENDING_OUTGOING — Sent friend request, awaiting response
 *   PENDING_INCOMING — Received friend request, awaiting action
 *   BLOCKED          — One-way block
 *
 * Also handles DM channel management:
 *   GET    /channels     — List all DM channels for the current user
 *   POST   /channels     — Open a DM with a friend (or return existing DM)
 *
 * Endpoints:
 *   GET    /                    — List all relationships for current user
 *   GET    /channels            — List all DM channels with last message preview
 *   POST   /channels            — Open or return a DM channel with a friend
 *   POST   /friends             — Send a friend request
 *   PUT    /friends/:userId     — Accept a pending friend request
 *   DELETE /friends/:userId     — Remove friend or cancel outgoing request
 *   PUT    /blocks/:userId      — Block a user (clears any existing relationship)
 *   DELETE /blocks/:userId      — Unblock a user
 *
 * @module routes/relationships
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, or, desc } from 'drizzle-orm';

import { db } from '../db/index';
import { relationships } from '../db/schema/relationships';
import { users } from '../db/schema/users';
import { channels } from '../db/schema/channels';
import { dmChannelMembers } from '../db/schema/channels';
import { messages } from '../db/schema/messages';
import { reports } from '../db/schema/reports';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createNotification } from '../lib/notifications';
import { getIO } from '../lib/socket-io';
import { AppError, handleAppError } from '../lib/errors.js';

export const relationshipsRouter = Router();

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

/**
 * Schema for POST /channels — open a DM.
 */
const openDmSchema = z.object({
  userId: z.string().uuid(),
});

/**
 * Schema for POST /friends — send friend request.
 */
const sendFriendRequestSchema = z.object({
  userId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// GET /
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/relationships
 *
 * Return all relationships for the authenticated user — both as requester and
 * as addressee. The "other person" in each relationship is determined by which
 * side the current user is on. Basic user info for the other person is
 * included inline.
 *
 * @auth    requireAuth
 * @returns 200 Array of {
 *   id, type, user: { id, username, displayName, avatarHash, status }
 * }
 */
relationshipsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    // Fetch relationships where current user is the requester.
    const asRequester = await db
      .select({
        id: relationships.id,
        type: relationships.type,
        createdAt: relationships.createdAt,
        otherId: relationships.addresseeId,
        otherUsername: users.username,
        otherDisplayName: users.displayName,
        otherAvatarHash: users.avatarHash,
        otherStatus: users.status,
      })
      .from(relationships)
      .innerJoin(users, eq(users.id, relationships.addresseeId))
      .where(eq(relationships.requesterId, userId));

    const all = [...asRequester].map((row) => ({
      id: row.id,
      type: row.type,
      createdAt: row.createdAt,
      user: {
        id: row.otherId,
        username: row.otherUsername,
        displayName: row.otherDisplayName,
        avatarHash: row.otherAvatarHash,
        status: row.otherStatus,
      },
    }));

    res.status(200).json(all);
  } catch (err) {
    handleAppError(res, err, 'relationships');
  }
});

// ---------------------------------------------------------------------------
// Message requests (friend-request backed)
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/relationships/message-requests?bucket=requests|spam
 *
 * Returns pending incoming requests for the current user. "Spam" is derived
 * from existing user reports with reason "message_request_spam".
 */
relationshipsRouter.get(
  '/message-requests',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.userId!;
      const bucket = req.query.bucket === 'spam' ? 'spam' : 'requests';

      const incoming = await db
        .select({
          id: relationships.id,
          createdAt: relationships.createdAt,
          senderId: relationships.addresseeId,
          senderUsername: users.username,
          senderDisplayName: users.displayName,
          senderAvatarHash: users.avatarHash,
        })
        .from(relationships)
        .innerJoin(users, eq(users.id, relationships.addresseeId))
        .where(
          and(
            eq(relationships.requesterId, userId),
            eq(relationships.type, 'PENDING_INCOMING'),
          ),
        )
        .orderBy(desc(relationships.createdAt))
        .limit(200);

      const spamRows = incoming.length
        ? await db
          .select({ targetId: reports.targetId })
          .from(reports)
          .where(
            and(
              eq(reports.reporterId, userId),
              eq(reports.targetType, 'user'),
              eq(reports.reason, 'message_request_spam'),
            ),
          )
        : [];

      const spamSet = new Set(spamRows.map((row) => row.targetId));

      const items = incoming
        .map((row) => ({
          id: row.id,
          user: {
            id: row.senderId,
            username: row.senderUsername,
            displayName: row.senderDisplayName,
            avatarHash: row.senderAvatarHash,
          },
          isSpam: spamSet.has(row.senderId),
          preview: 'Sent you a friend request',
          createdAt: row.createdAt,
          mutualServers: 0,
        }))
        .filter((row) => (bucket === 'spam' ? row.isSpam : !row.isSpam));

      res.status(200).json(items);
    } catch (err) {
      handleAppError(res, err, 'relationships');
    }
  },
);

/**
 * POST /api/v1/relationships/message-requests/:userId/accept
 *
 * Idempotent accept of a pending incoming request.
 */
relationshipsRouter.post(
  '/message-requests/:userId/accept',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.userId!;
      const { userId: senderId } = req.params as Record<string, string>;

      const [alreadyFriend] = await db
        .select({ id: relationships.id })
        .from(relationships)
        .where(
          and(
            eq(relationships.requesterId, userId),
            eq(relationships.addresseeId, senderId),
            eq(relationships.type, 'FRIEND'),
          ),
        )
        .limit(1);

      if (alreadyFriend) {
        res.status(200).json({ code: 'OK', message: 'Message request already accepted' });
        return;
      }

      const [incoming] = await db
        .select({ id: relationships.id })
        .from(relationships)
        .where(
          and(
            eq(relationships.requesterId, userId),
            eq(relationships.addresseeId, senderId),
            eq(relationships.type, 'PENDING_INCOMING'),
          ),
        )
        .limit(1);

      if (!incoming) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'No pending message request from this user' });
        return;
      }

      await db
        .update(relationships)
        .set({ type: 'FRIEND' })
        .where(
          and(
            eq(relationships.requesterId, userId),
            eq(relationships.addresseeId, senderId),
          ),
        );

      await db
        .update(relationships)
        .set({ type: 'FRIEND' })
        .where(
          and(
            eq(relationships.requesterId, senderId),
            eq(relationships.addresseeId, userId),
          ),
        );

      res.status(200).json({ code: 'OK', message: 'Message request accepted' });
    } catch (err) {
      handleAppError(res, err, 'relationships');
    }
  },
);

/**
 * POST /api/v1/relationships/message-requests/:userId/ignore
 *
 * Idempotent dismissal of pending request rows for the pair.
 */
relationshipsRouter.post(
  '/message-requests/:userId/ignore',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.userId!;
      const { userId: senderId } = req.params as Record<string, string>;

      await db
        .delete(relationships)
        .where(
          and(
            or(
              and(eq(relationships.requesterId, userId), eq(relationships.addresseeId, senderId)),
              and(eq(relationships.requesterId, senderId), eq(relationships.addresseeId, userId)),
            ),
            or(
              eq(relationships.type, 'PENDING_INCOMING'),
              eq(relationships.type, 'PENDING_OUTGOING'),
            ),
          ),
        );

      res.status(200).json({ code: 'OK', message: 'Message request ignored' });
    } catch (err) {
      handleAppError(res, err, 'relationships');
    }
  },
);

/**
 * POST /api/v1/relationships/message-requests/:userId/report
 *
 * Creates (or reuses) a spam report and ignores the request pair.
 */
relationshipsRouter.post(
  '/message-requests/:userId/report',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.userId!;
      const { userId: senderId } = req.params as Record<string, string>;

      const [existingReport] = await db
        .select({ id: reports.id })
        .from(reports)
        .where(
          and(
            eq(reports.reporterId, userId),
            eq(reports.targetType, 'user'),
            eq(reports.targetId, senderId),
            eq(reports.reason, 'message_request_spam'),
          ),
        )
        .limit(1);

      if (!existingReport) {
        await db.insert(reports).values({
          reporterId: userId,
          targetType: 'user',
          targetId: senderId,
          reason: 'message_request_spam',
        });
      }

      await db
        .delete(relationships)
        .where(
          and(
            or(
              and(eq(relationships.requesterId, userId), eq(relationships.addresseeId, senderId)),
              and(eq(relationships.requesterId, senderId), eq(relationships.addresseeId, userId)),
            ),
            or(
              eq(relationships.type, 'PENDING_INCOMING'),
              eq(relationships.type, 'PENDING_OUTGOING'),
            ),
          ),
        );

      res.status(200).json({ code: 'OK', message: 'Message request reported and removed' });
    } catch (err) {
      handleAppError(res, err, 'relationships');
    }
  },
);

// ---------------------------------------------------------------------------
// GET /channels
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/relationships/channels
 *
 * Return all DM channels the current user participates in. Each entry
 * includes the other participant's info and a preview of the last message.
 * Ordered by the most recent message (newest first).
 *
 * @auth    requireAuth
 * @returns 200 Array of {
 *   id, name, type, createdAt,
 *   otherUser: { id, username, displayName, avatarHash, status },
 *   lastMessage: { content, createdAt } | null
 * }
 */
relationshipsRouter.get(
  '/channels',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.userId!;

      // Get all DM channel IDs this user participates in.
      const participations = await db
        .select({ channelId: dmChannelMembers.channelId })
        .from(dmChannelMembers)
        .where(eq(dmChannelMembers.userId, userId));

      if (participations.length === 0) {
        res.status(200).json([]);
        return;
      }

      const channelIds = participations.map((p) => p.channelId);

      // For each DM channel, get channel info + other participant + last message.
      const result = await Promise.all(
        channelIds.map(async (channelId) => {
          // Channel row.
          const [channel] = await db
            .select()
            .from(channels)
            .where(eq(channels.id, channelId))
            .limit(1);

          if (!channel) return null;

          // Get all participants.
          const allParticipants = await db
            .select({
              id: users.id,
              username: users.username,
              displayName: users.displayName,
              avatarHash: users.avatarHash,
              status: users.status,
            })
            .from(dmChannelMembers)
            .innerJoin(users, eq(users.id, dmChannelMembers.userId))
            .where(eq(dmChannelMembers.channelId, channelId))
            .limit(10);
          const other = allParticipants.find((r) => r.id !== userId) ?? null;

          // Last message.
          const [lastMsg] = await db
            .select({ content: messages.content, createdAt: messages.createdAt })
            .from(messages)
            .where(eq(messages.channelId, channelId))
            .orderBy(desc(messages.createdAt))
            .limit(1);

          return {
            id: channel.id,
            name: channel.name,
            type: channel.type,
            createdAt: channel.createdAt,
            isGroup: channel.isGroup,
            groupName: channel.groupName,
            groupIcon: channel.groupIcon,
            ownerId: channel.ownerId,
            otherUser: other,
            participants: channel.isGroup ? allParticipants : undefined,
            lastMessage: lastMsg ?? null,
          };
        }),
      );

      // Filter nulls and sort by lastMessage.createdAt desc.
      const filtered = result
        .filter((r): r is NonNullable<typeof r> => r !== null)
        .sort((a, b) => {
          const aTime = a.lastMessage?.createdAt?.getTime() ?? 0;
          const bTime = b.lastMessage?.createdAt?.getTime() ?? 0;
          return bTime - aTime;
        });

      res.status(200).json(filtered);
    } catch (err) {
      handleAppError(res, err, 'relationships');
    }
  },
);

// ---------------------------------------------------------------------------
// POST /channels
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/relationships/channels
 *
 * Open a DM channel with another user. The target user must be a friend of
 * the current user (type = FRIEND in relationships). If a DM channel already
 * exists between the two users, the existing channel is returned instead of
 * creating a duplicate.
 *
 * @auth    requireAuth
 * @body    { userId: string } — UUID of the friend to open a DM with
 * @returns 201 Newly created DM channel row
 * @returns 200 Existing DM channel row (if already exists)
 * @returns 400 Not friends with this user
 * @returns 404 Target user not found
 *
 * Side effects:
 *   - May insert a row in `channels` (type = DM).
 *   - May insert two rows in `dm_channel_members`.
 */
relationshipsRouter.post(
  '/channels',
  requireAuth,
  validate(openDmSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.userId!;
      const { userId: targetUserId } = req.body as z.infer<typeof openDmSchema>;

      // Verify target user exists.
      const [targetUser] = await db
        .select({ id: users.id, username: users.username })
        .from(users)
        .where(eq(users.id, targetUserId))
        .limit(1);

      if (!targetUser) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'User not found' });
        return;
      }

      // Verify friendship (check both directions).
      const [friendship] = await db
        .select({ id: relationships.id })
        .from(relationships)
        .where(
          and(
            or(
              and(eq(relationships.requesterId, userId), eq(relationships.addresseeId, targetUserId)),
              and(eq(relationships.requesterId, targetUserId), eq(relationships.addresseeId, userId)),
            ),
            eq(relationships.type, 'FRIEND'),
          ),
        )
        .limit(1);

      if (!friendship) {
        res.status(400).json({ code: 'VALIDATION_ERROR', message: 'You must be friends to open a DM' });
        return;
      }

      // Check for an existing DM channel between the two users.
      // Strategy: find all DM channels the current user is in, then check
      // if the target user is also in one of those channels.
      const myDmChannels = await db
        .select({ channelId: dmChannelMembers.channelId })
        .from(dmChannelMembers)
        .where(eq(dmChannelMembers.userId, userId));

      for (const { channelId } of myDmChannels) {
        const [channel] = await db
          .select()
          .from(channels)
          .where(and(eq(channels.id, channelId), eq(channels.type, 'DM')))
          .limit(1);

        if (!channel) continue;

        const [targetMembership] = await db
          .select({ id: dmChannelMembers.id })
          .from(dmChannelMembers)
          .where(
            and(
              eq(dmChannelMembers.channelId, channelId),
              eq(dmChannelMembers.userId, targetUserId),
            ),
          )
          .limit(1);

        if (targetMembership) {
          // Existing DM channel found — return it.
          res.status(200).json(channel);
          return;
        }
      }

      // Create a new DM channel.
      const [newChannel] = await db
        .insert(channels)
        .values({
          name: `dm-${userId}-${targetUserId}`,
          type: 'DM',
          guildId: null,
        })
        .returning();

      // Add both users as participants.
      await db.insert(dmChannelMembers).values([
        { channelId: newChannel.id, userId },
        { channelId: newChannel.id, userId: targetUserId },
      ]);

      res.status(201).json(newChannel);
    } catch (err) {
      handleAppError(res, err, 'relationships');
    }
  },
);

// ---------------------------------------------------------------------------
// POST /friends
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/relationships/friends
 *
 * Send a friend request to another user. Creates two relationship rows
 * atomically:
 *   (requester=userId,  addressee=targetId, type=PENDING_OUTGOING)
 *   (requester=targetId, addressee=userId,  type=PENDING_INCOMING)
 *
 * @auth    requireAuth
 * @body    { userId: string } — UUID of the user to send a request to
 * @returns 201 { message: 'Friend request sent' }
 * @returns 400 Cannot add yourself / already friends or blocked
 * @returns 404 Target user not found
 *
 * Side effects:
 *   - Inserts two rows in `relationships`.
 */
relationshipsRouter.post(
  '/friends',
  requireAuth,
  validate(sendFriendRequestSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.userId!;
      const { userId: targetUserId } = req.body as z.infer<typeof sendFriendRequestSchema>;

      if (userId === targetUserId) {
        res.status(400).json({ code: 'VALIDATION_ERROR', message: 'You cannot send a friend request to yourself' });
        return;
      }

      // Verify target user exists.
      const [targetUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, targetUserId))
        .limit(1);

      if (!targetUser) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'User not found' });
        return;
      }

      // Check for any existing relationship between the two in either direction.
      const [existing] = await db
        .select({ id: relationships.id, type: relationships.type })
        .from(relationships)
        .where(
          or(
            and(eq(relationships.requesterId, userId), eq(relationships.addresseeId, targetUserId)),
            and(eq(relationships.requesterId, targetUserId), eq(relationships.addresseeId, userId)),
          ),
        )
        .limit(1);

      if (existing) {
        if (existing.type === 'FRIEND') {
          res.status(400).json({ code: 'CONFLICT', message: 'You are already friends with this user' });
        } else if (existing.type === 'BLOCKED') {
          res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Cannot send a friend request to a blocked user' });
        } else {
          res.status(400).json({ code: 'CONFLICT', message: 'A friend request already exists between you two' });
        }
        return;
      }

      // Insert both sides of the pending request atomically.
      await db.insert(relationships).values([
        {
          requesterId: userId,
          addresseeId: targetUserId,
          type: 'PENDING_OUTGOING',
        },
        {
          requesterId: targetUserId,
          addresseeId: userId,
          type: 'PENDING_INCOMING',
        },
      ]);

      // Look up requester's display name for the notification
      const [requester] = await db
        .select({ username: users.username, displayName: users.displayName })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const senderName = requester?.displayName || requester?.username || 'Someone';

      // Notify the target user about the friend request (non-fatal)
      try {
        await createNotification({
          userId: targetUserId,
          type: 'friend_request',
          title: 'New Friend Request',
          body: `${senderName} sent you a friend request.`,
          data: { senderId: userId, senderName },
        });
      } catch {
        console.warn('[relationships] failed to create notification for friend request, continuing');
      }

      // Emit real-time socket event so the target's Friends page updates instantly
      try {
        getIO().to(`user:${targetUserId}`).emit('FRIEND_REQUEST_RECEIVED', {
          from: { userId, username: requester?.username || '', displayName: requester?.displayName || '' },
        });
      } catch { /* socket may not be initialised in tests */ }

      res.status(201).json({ code: 'OK', message: 'Friend request sent' });
    } catch (err) {
      handleAppError(res, err, 'relationships');
    }
  },
);

// ---------------------------------------------------------------------------
// PUT /friends/:userId
// ---------------------------------------------------------------------------

/**
 * PUT /api/v1/relationships/friends/:userId
 *
 * Accept a pending friend request from the specified user. Looks for a
 * PENDING_INCOMING row where the current user is the addressee and the
 * target user is the requester. Updates both rows (outgoing and incoming) to
 * FRIEND.
 *
 * @auth    requireAuth
 * @param   userId {string} — UUID of the user whose request is being accepted
 * @returns 200 { message: 'Friend request accepted' }
 * @returns 404 No pending request found from this user
 *
 * Side effects:
 *   - Updates two `relationships` rows from PENDING_* to FRIEND.
 */
relationshipsRouter.put(
  '/friends/:userId',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.userId!;
      const { userId: requesterId } = req.params as Record<string, string>;

      // Find the PENDING_OUTGOING row where the requester sent the request to current user.
      const [incomingRow] = await db
        .select()
        .from(relationships)
        .where(
          and(
            eq(relationships.requesterId, requesterId),
            eq(relationships.addresseeId, userId),
            eq(relationships.type, 'PENDING_OUTGOING'),
          ),
        )
        .limit(1);

      if (!incomingRow) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'No pending friend request from this user' });
        return;
      }

      // Update both rows to FRIEND.
      await db
        .update(relationships)
        .set({ type: 'FRIEND' })
        .where(
          and(
            eq(relationships.requesterId, userId),
            eq(relationships.addresseeId, requesterId),
          ),
        );

      await db
        .update(relationships)
        .set({ type: 'FRIEND' })
        .where(
          and(
            eq(relationships.requesterId, requesterId),
            eq(relationships.addresseeId, userId),
          ),
        );

      res.status(200).json({ code: 'OK', message: 'Friend request accepted' });
    } catch (err) {
      handleAppError(res, err, 'relationships');
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /friends/:userId
// ---------------------------------------------------------------------------

/**
 * DELETE /api/v1/relationships/friends/:userId
 *
 * Remove a friend or cancel an outgoing friend request. Deletes all
 * relationship rows between the two users in either direction.
 *
 * @auth    requireAuth
 * @param   userId {string} — UUID of the friend to remove or request to cancel
 * @returns 200 { message: 'Relationship removed' }
 *
 * Side effects:
 *   - Deletes all `relationships` rows between the two users.
 */
relationshipsRouter.delete(
  '/friends/:userId',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.userId!;
      const { userId: targetId } = req.params as Record<string, string>;

      await db
        .delete(relationships)
        .where(
          or(
            and(eq(relationships.requesterId, userId), eq(relationships.addresseeId, targetId)),
            and(eq(relationships.requesterId, targetId), eq(relationships.addresseeId, userId)),
          ),
        );

      res.status(200).json({ code: 'OK', message: 'Relationship removed' });
    } catch (err) {
      handleAppError(res, err, 'relationships');
    }
  },
);

// ---------------------------------------------------------------------------
// PUT /blocks/:userId
// ---------------------------------------------------------------------------

/**
 * PUT /api/v1/relationships/blocks/:userId
 *
 * Block a user. Removes any existing friend/pending relationship rows between
 * the two users in either direction, then inserts a BLOCKED row from the
 * current user toward the target.
 *
 * @auth    requireAuth
 * @param   userId {string} — UUID of the user to block
 * @returns 200 { message: 'User blocked' }
 * @returns 400 Cannot block yourself
 * @returns 404 Target user not found
 *
 * Side effects:
 *   - Deletes any existing relationship rows between the two users.
 *   - Inserts a BLOCKED row: (requesterId=userId, addresseeId=targetId).
 */
relationshipsRouter.put(
  '/blocks/:userId',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.userId!;
      const { userId: targetId } = req.params as Record<string, string>;

      if (userId === targetId) {
        res.status(400).json({ code: 'VALIDATION_ERROR', message: 'You cannot block yourself' });
        return;
      }

      // Verify target user exists.
      const [targetUser] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, targetId))
        .limit(1);

      if (!targetUser) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'User not found' });
        return;
      }

      // Remove any existing relationship rows between the two users.
      await db
        .delete(relationships)
        .where(
          or(
            and(eq(relationships.requesterId, userId), eq(relationships.addresseeId, targetId)),
            and(eq(relationships.requesterId, targetId), eq(relationships.addresseeId, userId)),
          ),
        );

      // Insert the BLOCKED row.
      await db.insert(relationships).values({
        requesterId: userId,
        addresseeId: targetId,
        type: 'BLOCKED',
      });

      res.status(200).json({ code: 'OK', message: 'User blocked' });
    } catch (err) {
      handleAppError(res, err, 'relationships');
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /blocks/:userId
// ---------------------------------------------------------------------------

/**
 * DELETE /api/v1/relationships/blocks/:userId
 *
 * Unblock a user. Deletes the BLOCKED relationship row from the current user
 * toward the target. Does nothing if the block doesn't exist.
 *
 * @auth    requireAuth
 * @param   userId {string} — UUID of the user to unblock
 * @returns 200 { message: 'User unblocked' }
 *
 * Side effects:
 *   - Deletes the BLOCKED `relationships` row if it exists.
 */
relationshipsRouter.delete(
  '/blocks/:userId',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.userId!;
      const { userId: targetId } = req.params as Record<string, string>;

      await db
        .delete(relationships)
        .where(
          and(
            eq(relationships.requesterId, userId),
            eq(relationships.addresseeId, targetId),
            eq(relationships.type, 'BLOCKED'),
          ),
        );

      res.status(200).json({ code: 'OK', message: 'User unblocked' });
    } catch (err) {
      handleAppError(res, err, 'relationships');
    }
  },
);
