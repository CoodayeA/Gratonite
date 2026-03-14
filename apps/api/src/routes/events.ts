/**
 * routes/events.ts — Express router for guild scheduled events.
 *
 * Mounted at /api/v1/guilds/:guildId/scheduled-events by routes/index.ts.
 *
 * Endpoints:
 *   GET    /                        — List events for a guild
 *   POST   /                        — Create a new event
 *   GET    /:eventId                — Get event detail
 *   PATCH  /:eventId                — Update event
 *   DELETE /:eventId                — Delete event
 *   PUT    /:eventId/interested     — Toggle interest (mark interested)
 *   DELETE /:eventId/interested     — Remove interest
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, desc, sql } from 'drizzle-orm';

import { db } from '../db/index';
import { scheduledEvents, eventInterests } from '../db/schema/events';
import { users } from '../db/schema/users';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';

export const eventsRouter = Router({ mergeParams: true });

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const createEventSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(4000).optional(),
  startTime: z.string(), // ISO 8601
  endTime: z.string().optional(),
  location: z.string().max(1000).optional(),
  channelId: z.string().uuid().optional(),
});

const updateEventSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(4000).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  location: z.string().max(1000).optional(),
  status: z.enum(['scheduled', 'active', 'completed', 'cancelled']).optional(),
});

// ---------------------------------------------------------------------------
// GET / — List guild events
// ---------------------------------------------------------------------------

eventsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params as Record<string, string>;

    const rows = await db
      .select({
        id: scheduledEvents.id,
        guildId: scheduledEvents.guildId,
        channelId: scheduledEvents.channelId,
        name: scheduledEvents.name,
        description: scheduledEvents.description,
        startTime: scheduledEvents.startTime,
        endTime: scheduledEvents.endTime,
        location: scheduledEvents.location,
        creatorId: scheduledEvents.creatorId,
        interestedCount: scheduledEvents.interestedCount,
        status: scheduledEvents.status,
        createdAt: scheduledEvents.createdAt,
        creatorUsername: users.username,
        creatorDisplayName: users.displayName,
      })
      .from(scheduledEvents)
      .leftJoin(users, eq(users.id, scheduledEvents.creatorId))
      .where(eq(scheduledEvents.guildId, guildId))
      .orderBy(desc(scheduledEvents.startTime));

    // Check if current user is interested in each event
    const eventIds = rows.map(r => r.id);
    let userInterests: Set<string> = new Set();
    if (eventIds.length > 0 && req.userId) {
      const interests = await db
        .select({ eventId: eventInterests.eventId })
        .from(eventInterests)
        .where(
          and(
            eq(eventInterests.userId, req.userId),
            sql`${eventInterests.eventId} = ANY(${eventIds})`,
          ),
        );
      userInterests = new Set(interests.map(i => i.eventId));
    }

    res.json(
      rows.map(r => ({
        id: r.id,
        guildId: r.guildId,
        channelId: r.channelId,
        name: r.name,
        description: r.description,
        startTime: r.startTime,
        endTime: r.endTime,
        location: r.location,
        creatorId: r.creatorId,
        creatorName: r.creatorDisplayName ?? r.creatorUsername ?? 'Unknown',
        interestedCount: r.interestedCount,
        status: r.status,
        createdAt: r.createdAt,
        isInterested: userInterests.has(r.id),
      })),
    );
  } catch (err) {
    console.error('[events] GET / error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST / — Create event
// ---------------------------------------------------------------------------

eventsRouter.post('/', requireAuth, validate(createEventSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params as Record<string, string>;
    const { name, description, startTime, endTime, location, channelId } = req.body;

    const [event] = await db
      .insert(scheduledEvents)
      .values({
        guildId,
        channelId: channelId ?? null,
        name,
        description: description ?? null,
        startTime: new Date(startTime),
        endTime: endTime ? new Date(endTime) : null,
        location: location ?? null,
        creatorId: req.userId!,
      })
      .returning();

    res.status(201).json(event);
  } catch (err) {
    console.error('[events] POST / error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /:eventId — Get event detail
// ---------------------------------------------------------------------------

eventsRouter.get('/:eventId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params as Record<string, string>;

    const [event] = await db
      .select({
        id: scheduledEvents.id,
        guildId: scheduledEvents.guildId,
        channelId: scheduledEvents.channelId,
        name: scheduledEvents.name,
        description: scheduledEvents.description,
        startTime: scheduledEvents.startTime,
        endTime: scheduledEvents.endTime,
        location: scheduledEvents.location,
        creatorId: scheduledEvents.creatorId,
        interestedCount: scheduledEvents.interestedCount,
        status: scheduledEvents.status,
        createdAt: scheduledEvents.createdAt,
        creatorUsername: users.username,
        creatorDisplayName: users.displayName,
      })
      .from(scheduledEvents)
      .leftJoin(users, eq(users.id, scheduledEvents.creatorId))
      .where(eq(scheduledEvents.id, eventId))
      .limit(1);

    if (!event) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Event not found' });
      return;
    }

    // Check interest
    let isInterested = false;
    if (req.userId) {
      const [interest] = await db
        .select({ eventId: eventInterests.eventId })
        .from(eventInterests)
        .where(and(eq(eventInterests.eventId, eventId), eq(eventInterests.userId, req.userId)))
        .limit(1);
      isInterested = !!interest;
    }

    res.json({
      ...event,
      creatorName: event.creatorDisplayName ?? event.creatorUsername ?? 'Unknown',
      isInterested,
    });
  } catch (err) {
    console.error('[events] GET /:eventId error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PATCH /:eventId — Update event
// ---------------------------------------------------------------------------

eventsRouter.patch('/:eventId', requireAuth, validate(updateEventSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params as Record<string, string>;

    // Verify event exists and user is creator
    const [existing] = await db
      .select({ id: scheduledEvents.id, creatorId: scheduledEvents.creatorId })
      .from(scheduledEvents)
      .where(eq(scheduledEvents.id, eventId))
      .limit(1);

    if (!existing) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Event not found' });
      return;
    }
    if (existing.creatorId !== req.userId) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Only the event creator can update this event' });
      return;
    }

    const updates: Record<string, unknown> = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.startTime !== undefined) updates.startTime = new Date(req.body.startTime);
    if (req.body.endTime !== undefined) updates.endTime = new Date(req.body.endTime);
    if (req.body.location !== undefined) updates.location = req.body.location;
    if (req.body.status !== undefined) updates.status = req.body.status;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ code: 'NO_CHANGES', message: 'No fields to update' });
      return;
    }

    const [updated] = await db
      .update(scheduledEvents)
      .set(updates)
      .where(eq(scheduledEvents.id, eventId))
      .returning();

    res.json(updated);
  } catch (err) {
    console.error('[events] PATCH /:eventId error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /:eventId — Delete event
// ---------------------------------------------------------------------------

eventsRouter.delete('/:eventId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params as Record<string, string>;

    const [existing] = await db
      .select({ id: scheduledEvents.id, creatorId: scheduledEvents.creatorId })
      .from(scheduledEvents)
      .where(eq(scheduledEvents.id, eventId))
      .limit(1);

    if (!existing) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Event not found' });
      return;
    }
    if (existing.creatorId !== req.userId) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Only the event creator can delete this event' });
      return;
    }

    await db.delete(scheduledEvents).where(eq(scheduledEvents.id, eventId));

    res.json({ code: 'OK' });
  } catch (err) {
    console.error('[events] DELETE /:eventId error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// PUT /:eventId/interested — Mark interested
// ---------------------------------------------------------------------------

eventsRouter.put('/:eventId/interested', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params as Record<string, string>;

    // Verify event exists
    const [event] = await db
      .select({ id: scheduledEvents.id })
      .from(scheduledEvents)
      .where(eq(scheduledEvents.id, eventId))
      .limit(1);

    if (!event) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Event not found' });
      return;
    }

    // Insert interest (ignore if already exists)
    const result = await db
      .insert(eventInterests)
      .values({ eventId, userId: req.userId! })
      .onConflictDoNothing();

    if (result.rowCount && result.rowCount > 0) {
      // Increment counter
      await db
        .update(scheduledEvents)
        .set({ interestedCount: sql`${scheduledEvents.interestedCount} + 1` })
        .where(eq(scheduledEvents.id, eventId));
    }

    res.json({ code: 'OK', interested: true });
  } catch (err) {
    console.error('[events] PUT /:eventId/interested error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /:eventId/interested — Remove interest
// ---------------------------------------------------------------------------

eventsRouter.delete('/:eventId/interested', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params as Record<string, string>;

    const result = await db
      .delete(eventInterests)
      .where(and(eq(eventInterests.eventId, eventId), eq(eventInterests.userId, req.userId!)));

    if (result.rowCount && result.rowCount > 0) {
      // Decrement counter
      await db
        .update(scheduledEvents)
        .set({ interestedCount: sql`GREATEST(${scheduledEvents.interestedCount} - 1, 0)` })
        .where(eq(scheduledEvents.id, eventId));
    }

    res.json({ code: 'OK', interested: false });
  } catch (err) {
    console.error('[events] DELETE /:eventId/interested error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});
