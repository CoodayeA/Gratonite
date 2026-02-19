import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../../lib/context.js';
import { requireAuth } from '../../middleware/auth.js';
import { createRelationshipsService } from './relationships.service.js';

const sendRequestSchema = z.object({
  userId: z.string(),
});

const createGroupDmSchema = z.object({
  recipientIds: z.array(z.string()).min(1).max(9),
  name: z.string().min(1).max(100).optional(),
});

export function relationshipsRouter(ctx: AppContext): Router {
  const router = Router();
  const relService = createRelationshipsService(ctx);
  const auth = requireAuth(ctx);

  // ── Relationships ────────────────────────────────────────────────────────

  // Get all relationships (friends, pending, blocked)
  router.get('/', auth, async (req, res) => {
    const rels = await relService.getRelationships(req.user!.userId);
    res.json(rels);
  });

  // Send friend request
  router.post('/friends', auth, async (req, res) => {
    const parsed = sendRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', errors: parsed.error.flatten().fieldErrors });
    }

    const result = await relService.sendFriendRequest(
      req.user!.userId,
      parsed.data.userId,
    );

    if ('error' in result) {
      const statusMap: Record<string, number> = {
        CANNOT_SELF_FRIEND: 400,
        ALREADY_FRIENDS: 400,
        USER_BLOCKED: 403,
        ALREADY_PENDING: 400,
        FRIEND_LIMIT_REACHED: 400,
      };
      return res.status(statusMap[result.error] ?? 400).json({ code: result.error });
    }

    if ('accepted' in result) {
      // Notify both users of new friendship
      ctx.io.to(`user:${req.user!.userId}`).emit('USER_UPDATE', { userId: req.user!.userId, friendAdded: parsed.data.userId } as any);
      ctx.io.to(`user:${parsed.data.userId}`).emit('USER_UPDATE', { userId: parsed.data.userId, friendAdded: req.user!.userId } as any);
    }

    res.status(201).json(result);
  });

  // Accept friend request
  router.put('/friends/:userId', auth, async (req, res) => {
    const result = await relService.acceptFriendRequest(
      req.user!.userId,
      req.params.userId,
    );

    if ('error' in result) {
      return res.status(404).json({ code: result.error });
    }

    res.json(result);
  });

  // Remove friend / decline request
  router.delete('/friends/:userId', auth, async (req, res) => {
    await relService.removeFriend(req.user!.userId, req.params.userId);
    res.status(204).send();
  });

  // Block user
  router.put('/blocks/:userId', auth, async (req, res) => {
    await relService.blockUser(req.user!.userId, req.params.userId);
    res.status(204).send();
  });

  // Unblock user
  router.delete('/blocks/:userId', auth, async (req, res) => {
    await relService.unblockUser(req.user!.userId, req.params.userId);
    res.status(204).send();
  });

  // ── DM channels ──────────────────────────────────────────────────────────

  // Get user's DM channels
  router.get('/channels', auth, async (req, res) => {
    const dmChans = await relService.getUserDmChannels(req.user!.userId);
    res.json(dmChans);
  });

  // Open DM with user (or get existing)
  router.post('/channels', auth, async (req, res) => {
    const parsed = sendRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', errors: parsed.error.flatten().fieldErrors });
    }

    const targetId = parsed.data.userId;

    // Check if blocked
    if (await relService.isBlocked(req.user!.userId, targetId)) {
      return res.status(403).json({ code: 'BLOCKED', message: 'This user has blocked you' });
    }

    const channel = await relService.getOrCreateDmChannel(
      req.user!.userId,
      targetId,
    );

    res.json(channel);
  });

  // Create group DM
  router.post('/group-dms', auth, async (req, res) => {
    const parsed = createGroupDmSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', errors: parsed.error.flatten().fieldErrors });
    }

    const result = await relService.createGroupDm(
      req.user!.userId,
      parsed.data.recipientIds,
      parsed.data.name,
    );

    if ('error' in result) {
      return res.status(400).json({ code: result.error });
    }

    res.status(201).json(result);
  });

  return router;
}
