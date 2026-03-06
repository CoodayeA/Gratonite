/**
 * routes/stage.ts — Express router for stage channel management.
 *
 * Mounted at /api/v1/ in src/routes/index.ts.
 *
 * Endpoints:
 *   GET    /channels/:channelId/stage                 — Get active session + speakers
 *   POST   /channels/:channelId/stage/start           — Start a stage session
 *   DELETE /channels/:channelId/stage                 — End the active stage session
 *   POST   /channels/:channelId/stage/speakers        — Invite a speaker
 *   DELETE /channels/:channelId/stage/speakers/:userId — Remove a speaker
 *   POST   /channels/:channelId/stage/request-speak   — Raise hand (audience → speaker request)
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, isNull } from 'drizzle-orm';

import { db } from '../db/index';
import { channels } from '../db/schema/channels';
import { stageSessions, stageSpeakers } from '../db/schema/stage';
import { requireAuth } from '../middleware/auth';
import { getIO } from '../lib/socket-io';

export const stageRouter = Router();

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code: string = 'UNKNOWN_ERROR',
  ) {
    super(message);
    this.name = 'AppError';
  }
}

function handleAppError(res: Response, err: unknown): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ code: err.code, message: err.message });
  } else {
    console.error('[stage] unexpected error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
}

/** Fetch the active (not yet ended) session for a channel, or null. */
async function getActiveSession(channelId: string) {
  const [session] = await db
    .select()
    .from(stageSessions)
    .where(and(eq(stageSessions.channelId, channelId), isNull(stageSessions.endedAt)))
    .limit(1);
  return session ?? null;
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const startSessionSchema = z.object({
  topic: z.string().max(500).optional(),
});

const inviteSpeakerSchema = z.object({
  userId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// GET /channels/:channelId/stage
// ---------------------------------------------------------------------------

stageRouter.get(
  '/channels/:channelId/stage',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { channelId } = req.params as Record<string, string>;

      const [channel] = await db
        .select({ id: channels.id, type: channels.type })
        .from(channels)
        .where(eq(channels.id, channelId))
        .limit(1);

      if (!channel) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Channel not found' });
        return;
      }

      const session = await getActiveSession(channelId);

      if (!session) {
        res.status(200).json({ session: null, speakers: [] });
        return;
      }

      const speakers = await db
        .select()
        .from(stageSpeakers)
        .where(eq(stageSpeakers.sessionId, session.id));

      res.status(200).json({ session, speakers });
    } catch (err) {
      handleAppError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /channels/:channelId/stage/start
// ---------------------------------------------------------------------------

stageRouter.post(
  '/channels/:channelId/stage/start',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { channelId } = req.params as Record<string, string>;

      const parsed = startSessionSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ code: 'VALIDATION_ERROR', message: parsed.error.message });
        return;
      }

      const { topic } = parsed.data;

      const [channel] = await db
        .select({ id: channels.id, type: channels.type })
        .from(channels)
        .where(eq(channels.id, channelId))
        .limit(1);

      if (!channel) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Channel not found' });
        return;
      }

      // End any existing active session first
      const existing = await getActiveSession(channelId);
      if (existing) {
        await db
          .update(stageSessions)
          .set({ endedAt: new Date() })
          .where(eq(stageSessions.id, existing.id));
      }

      const [session] = await db
        .insert(stageSessions)
        .values({
          channelId,
          hostId: req.userId!,
          topic: topic ?? null,
        })
        .returning();

      try {
        getIO().to(`channel:${channelId}`).emit('STAGE_START', {
          channelId,
          sessionId: session.id,
          hostId: session.hostId,
          topic: session.topic ?? null,
        });
      } catch { /* socket may not be initialised in tests */ }

      res.status(201).json({ session, speakers: [] });
    } catch (err) {
      handleAppError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /channels/:channelId/stage
// ---------------------------------------------------------------------------

stageRouter.delete(
  '/channels/:channelId/stage',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { channelId } = req.params as Record<string, string>;

      const session = await getActiveSession(channelId);
      if (!session) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'No active stage session' });
        return;
      }

      // Only the host can end the session
      if (session.hostId !== req.userId) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'Only the host can end the stage' });
        return;
      }

      const [ended] = await db
        .update(stageSessions)
        .set({ endedAt: new Date() })
        .where(eq(stageSessions.id, session.id))
        .returning();

      try {
        getIO().to(`channel:${channelId}`).emit('STAGE_END', {
          channelId,
          sessionId: session.id,
        });
      } catch { /* socket may not be initialised in tests */ }

      res.status(200).json({ session: ended });
    } catch (err) {
      handleAppError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /channels/:channelId/stage/speakers
// ---------------------------------------------------------------------------

stageRouter.post(
  '/channels/:channelId/stage/speakers',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { channelId } = req.params as Record<string, string>;

      const parsed = inviteSpeakerSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ code: 'VALIDATION_ERROR', message: parsed.error.message });
        return;
      }

      const { userId } = parsed.data;

      const session = await getActiveSession(channelId);
      if (!session) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'No active stage session' });
        return;
      }

      const [speaker] = await db
        .insert(stageSpeakers)
        .values({
          sessionId: session.id,
          userId,
          invitedBy: req.userId!,
        })
        .onConflictDoNothing()
        .returning();

      try {
        getIO().to(`channel:${channelId}`).emit('STAGE_SPEAKER_ADD', {
          channelId,
          sessionId: session.id,
          userId,
          invitedBy: req.userId!,
        });
      } catch { /* socket may not be initialised in tests */ }

      res.status(201).json({ speaker: speaker ?? null });
    } catch (err) {
      handleAppError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /channels/:channelId/stage/speakers/:userId
// ---------------------------------------------------------------------------

stageRouter.delete(
  '/channels/:channelId/stage/speakers/:userId',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { channelId, userId } = req.params as Record<string, string>;

      const session = await getActiveSession(channelId);
      if (!session) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'No active stage session' });
        return;
      }

      await db
        .delete(stageSpeakers)
        .where(
          and(
            eq(stageSpeakers.sessionId, session.id),
            eq(stageSpeakers.userId, userId),
          ),
        );

      try {
        getIO().to(`channel:${channelId}`).emit('STAGE_SPEAKER_REMOVE', {
          channelId,
          sessionId: session.id,
          userId,
        });
      } catch { /* socket may not be initialised in tests */ }

      res.status(200).json({ code: 'OK', message: 'Speaker removed' });
    } catch (err) {
      handleAppError(res, err);
    }
  },
);

// ---------------------------------------------------------------------------
// POST /channels/:channelId/stage/request-speak
// ---------------------------------------------------------------------------

stageRouter.post(
  '/channels/:channelId/stage/request-speak',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { channelId } = req.params as Record<string, string>;

      const session = await getActiveSession(channelId);
      if (!session) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'No active stage session' });
        return;
      }

      try {
        getIO().to(`channel:${channelId}`).emit('STAGE_HAND_RAISE', {
          channelId,
          sessionId: session.id,
          userId: req.userId!,
        });
      } catch { /* socket may not be initialised in tests */ }

      res.status(200).json({ code: 'OK', message: 'Hand raised' });
    } catch (err) {
      handleAppError(res, err);
    }
  },
);
