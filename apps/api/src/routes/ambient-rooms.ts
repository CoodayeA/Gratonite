import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { eq, and, count } from 'drizzle-orm';
import { db } from '../db/index';
import { ambientRooms, ambientRoomParticipants } from '../db/schema/ambient-rooms';
import { users } from '../db/schema/users';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { getIO } from '../lib/socket-io';
import { z } from 'zod';

export const ambientRoomsRouter = Router({ mergeParams: true });

const updateRoomSchema = z.object({
  theme: z.enum(['coffee_shop', 'library', 'campfire', 'rain', 'ocean', 'forest', 'night', 'lofi']).optional(),
  musicEnabled: z.boolean().optional(),
  musicVolume: z.number().min(0).max(1).optional(),
  maxParticipants: z.number().int().min(1).max(100).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['working', 'break', 'away']),
});

// GET /channels/:channelId/ambient-room — get room config + participants
ambientRoomsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const channelId = req.params.channelId as string;

    const [room] = await db.select()
      .from(ambientRooms)
      .where(eq(ambientRooms.channelId, channelId))
      .limit(1);

    if (!room) {
      res.json(null);
      return;
    }

    const participants = await db.select({
      id: ambientRoomParticipants.id,
      userId: ambientRoomParticipants.userId,
      joinedAt: ambientRoomParticipants.joinedAt,
      status: ambientRoomParticipants.status,
      username: users.username,
      displayName: users.displayName,
      avatarHash: users.avatarHash,
    })
      .from(ambientRoomParticipants)
      .innerJoin(users, eq(ambientRoomParticipants.userId, users.id))
      .where(eq(ambientRoomParticipants.roomId, room.id));

    res.json({ ...room, participants });
  } catch (err) {
    logger.error('[ambient-rooms] GET error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// PATCH /channels/:channelId/ambient-room — update room config
ambientRoomsRouter.patch('/', requireAuth, validate(updateRoomSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const channelId = req.params.channelId as string;
    const { theme, musicEnabled, musicVolume, maxParticipants } = req.body;

    const updates: Record<string, any> = {};
    if (theme !== undefined) updates.theme = theme;
    if (musicEnabled !== undefined) updates.musicEnabled = musicEnabled;
    if (musicVolume !== undefined) updates.musicVolume = musicVolume;
    if (maxParticipants !== undefined) updates.maxParticipants = maxParticipants;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Nothing to update' });
      return;
    }

    // Upsert: create room if it doesn't exist, update if it does
    const [existing] = await db.select({ id: ambientRooms.id })
      .from(ambientRooms)
      .where(eq(ambientRooms.channelId, channelId))
      .limit(1);

    let room;
    if (existing) {
      [room] = await db.update(ambientRooms)
        .set(updates)
        .where(eq(ambientRooms.id, existing.id))
        .returning();
    } else {
      [room] = await db.insert(ambientRooms)
        .values({ channelId, ...updates })
        .returning();
    }

    const io = getIO();
    io.to(`channel:${channelId}`).emit('ambient_room_updated', room);

    res.json(room);
  } catch (err) {
    logger.error('[ambient-rooms] PATCH error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// POST /channels/:channelId/ambient-room/join — join room
ambientRoomsRouter.post('/join', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const channelId = req.params.channelId as string;

    // Get or create room
    let [room] = await db.select()
      .from(ambientRooms)
      .where(eq(ambientRooms.channelId, channelId))
      .limit(1);

    if (!room) {
      [room] = await db.insert(ambientRooms)
        .values({ channelId })
        .returning();
    }

    // Check max participants
    const [{ participantCount }] = await db.select({ participantCount: count() })
      .from(ambientRoomParticipants)
      .where(eq(ambientRoomParticipants.roomId, room.id));

    if (Number(participantCount) >= room.maxParticipants) {
      res.status(409).json({ code: 'ROOM_FULL', message: 'Room is at maximum capacity' });
      return;
    }

    const [participant] = await db.insert(ambientRoomParticipants)
      .values({ roomId: room.id, userId: req.userId!, status: 'working' })
      .onConflictDoNothing()
      .returning();

    const io = getIO();
    io.to(`channel:${channelId}`).emit('ambient_room_join', {
      roomId: room.id,
      userId: req.userId,
      status: 'working',
    });

    res.status(201).json(participant || { alreadyJoined: true });
  } catch (err) {
    logger.error('[ambient-rooms] JOIN error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// POST /channels/:channelId/ambient-room/leave — leave room
ambientRoomsRouter.post('/leave', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const channelId = req.params.channelId as string;

    const [room] = await db.select({ id: ambientRooms.id })
      .from(ambientRooms)
      .where(eq(ambientRooms.channelId, channelId))
      .limit(1);

    if (!room) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Room not found' });
      return;
    }

    await db.delete(ambientRoomParticipants)
      .where(and(
        eq(ambientRoomParticipants.roomId, room.id),
        eq(ambientRoomParticipants.userId, req.userId!),
      ));

    const io = getIO();
    io.to(`channel:${channelId}`).emit('ambient_room_leave', {
      roomId: room.id,
      userId: req.userId,
    });

    res.json({ ok: true });
  } catch (err) {
    logger.error('[ambient-rooms] LEAVE error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// PATCH /channels/:channelId/ambient-room/status — update own status
ambientRoomsRouter.patch('/status', requireAuth, validate(updateStatusSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const channelId = req.params.channelId as string;
    const { status } = req.body;

    const [room] = await db.select({ id: ambientRooms.id })
      .from(ambientRooms)
      .where(eq(ambientRooms.channelId, channelId))
      .limit(1);

    if (!room) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Room not found' });
      return;
    }

    const [updated] = await db.update(ambientRoomParticipants)
      .set({ status })
      .where(and(
        eq(ambientRoomParticipants.roomId, room.id),
        eq(ambientRoomParticipants.userId, req.userId!),
      ))
      .returning();

    if (!updated) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Not in room' });
      return;
    }

    const io = getIO();
    io.to(`channel:${channelId}`).emit('ambient_room_status', {
      roomId: room.id,
      userId: req.userId,
      status,
    });

    res.json(updated);
  } catch (err) {
    logger.error('[ambient-rooms] STATUS error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});
