/**
 * routes/focus-sessions.ts — Shared Focus Timers (Pomodoro-style).
 * Mounted at /channels/:channelId/focus-sessions
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/index';
import { focusSessions, focusSessionParticipants } from '../db/schema/focus-sessions';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { getIO } from '../lib/socket-io';
import { logger } from '../lib/logger';

export const focusSessionsRouter = Router({ mergeParams: true });

const createSessionSchema = z.object({
  name: z.string().max(100).optional().default('Focus Session'),
  workDuration: z.number().int().min(60).max(7200).optional().default(1500),
  breakDuration: z.number().int().min(60).max(3600).optional().default(300),
});

const updateSessionSchema = z.object({
  currentPhase: z.enum(['work', 'break', 'paused']).optional(),
  roundNumber: z.number().int().min(1).optional(),
});

// POST /channels/:channelId/focus-sessions — create new session
focusSessionsRouter.post('/', requireAuth, validate(createSessionSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const channelId = req.params.channelId as string;
    const { name, workDuration, breakDuration } = req.body;

    const [session] = await db.insert(focusSessions).values({
      channelId,
      creatorId: req.userId!,
      name,
      workDuration,
      breakDuration,
      phaseStartedAt: new Date(),
    }).returning();

    // Auto-join creator
    await db.insert(focusSessionParticipants).values({
      sessionId: session.id,
      userId: req.userId!,
    });

    getIO().to(`channel:${channelId}`).emit('FOCUS_SESSION_CREATE', session);
    res.status(201).json(session);
  } catch (err) {
    logger.error('[focus-sessions] POST create error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// GET /channels/:channelId/focus-sessions — list active sessions
focusSessionsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const channelId = req.params.channelId as string;
    const sessions = await db.select()
      .from(focusSessions)
      .where(and(eq(focusSessions.channelId, channelId), eq(focusSessions.isActive, true)))
      .orderBy(desc(focusSessions.createdAt));

    res.json(sessions);
  } catch (err) {
    logger.error('[focus-sessions] GET list error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// GET /channels/:channelId/focus-sessions/:sessionId — get session with participants
focusSessionsRouter.get('/:sessionId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionId = req.params.sessionId as string;

    const [session] = await db.select()
      .from(focusSessions)
      .where(eq(focusSessions.id, sessionId))
      .limit(1);

    if (!session) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Focus session not found' });
      return;
    }

    const participants = await db.select()
      .from(focusSessionParticipants)
      .where(eq(focusSessionParticipants.sessionId, sessionId));

    res.json({ ...session, participants });
  } catch (err) {
    logger.error('[focus-sessions] GET detail error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// POST /channels/:channelId/focus-sessions/:sessionId/join — join session
focusSessionsRouter.post('/:sessionId/join', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const channelId = req.params.channelId as string;
    const sessionId = req.params.sessionId as string;

    const [session] = await db.select()
      .from(focusSessions)
      .where(and(eq(focusSessions.id, sessionId), eq(focusSessions.isActive, true)))
      .limit(1);

    if (!session) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Active focus session not found' });
      return;
    }

    const [participant] = await db.insert(focusSessionParticipants).values({
      sessionId,
      userId: req.userId!,
    }).onConflictDoNothing().returning();

    if (!participant) {
      res.status(409).json({ code: 'ALREADY_JOINED', message: 'Already participating in this session' });
      return;
    }

    getIO().to(`channel:${channelId}`).emit('FOCUS_SESSION_JOIN', { sessionId, userId: req.userId, participant });
    res.status(201).json(participant);
  } catch (err) {
    logger.error('[focus-sessions] POST join error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// POST /channels/:channelId/focus-sessions/:sessionId/leave — leave session
focusSessionsRouter.post('/:sessionId/leave', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const channelId = req.params.channelId as string;
    const sessionId = req.params.sessionId as string;

    const deleted = await db.delete(focusSessionParticipants)
      .where(and(
        eq(focusSessionParticipants.sessionId, sessionId),
        eq(focusSessionParticipants.userId, req.userId!),
      ))
      .returning();

    if (deleted.length === 0) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Not a participant in this session' });
      return;
    }

    getIO().to(`channel:${channelId}`).emit('FOCUS_SESSION_LEAVE', { sessionId, userId: req.userId });
    res.json({ success: true });
  } catch (err) {
    logger.error('[focus-sessions] POST leave error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// PATCH /channels/:channelId/focus-sessions/:sessionId — update phase / advance round
focusSessionsRouter.patch('/:sessionId', requireAuth, validate(updateSessionSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const channelId = req.params.channelId as string;
    const sessionId = req.params.sessionId as string;

    const [session] = await db.select()
      .from(focusSessions)
      .where(and(eq(focusSessions.id, sessionId), eq(focusSessions.isActive, true)))
      .limit(1);

    if (!session) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Active focus session not found' });
      return;
    }

    if (session.creatorId !== req.userId) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Only the session creator can update the session' });
      return;
    }

    const updates: Record<string, unknown> = {};
    if (req.body.currentPhase !== undefined) {
      updates.currentPhase = req.body.currentPhase;
      updates.phaseStartedAt = req.body.currentPhase === 'paused' ? null : new Date();
    }
    if (req.body.roundNumber !== undefined) {
      updates.roundNumber = req.body.roundNumber;
    }

    const [updated] = await db.update(focusSessions)
      .set(updates)
      .where(eq(focusSessions.id, sessionId))
      .returning();

    // If advancing to a new round after break, increment completedRounds for all participants
    if (req.body.currentPhase === 'work' && req.body.roundNumber && req.body.roundNumber > session.roundNumber) {
      await db.update(focusSessionParticipants)
        .set({ completedRounds: req.body.roundNumber - 1 })
        .where(eq(focusSessionParticipants.sessionId, sessionId));
    }

    getIO().to(`channel:${channelId}`).emit('FOCUS_SESSION_UPDATE', updated);
    res.json(updated);
  } catch (err) {
    logger.error('[focus-sessions] PATCH update error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// DELETE /channels/:channelId/focus-sessions/:sessionId — end session
focusSessionsRouter.delete('/:sessionId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const channelId = req.params.channelId as string;
    const sessionId = req.params.sessionId as string;

    const [session] = await db.select()
      .from(focusSessions)
      .where(and(eq(focusSessions.id, sessionId), eq(focusSessions.isActive, true)))
      .limit(1);

    if (!session) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Active focus session not found' });
      return;
    }

    if (session.creatorId !== req.userId) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Only the session creator can end the session' });
      return;
    }

    const [ended] = await db.update(focusSessions)
      .set({ isActive: false, endedAt: new Date(), currentPhase: 'paused' })
      .where(eq(focusSessions.id, sessionId))
      .returning();

    getIO().to(`channel:${channelId}`).emit('FOCUS_SESSION_END', ended);
    res.json(ended);
  } catch (err) {
    logger.error('[focus-sessions] DELETE end error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});
