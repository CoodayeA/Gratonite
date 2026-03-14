/**
 * routes/calendars.ts — Shared server calendars with RSVP.
 * Mounted at /guilds/:guildId/calendar
 */
import { Router, Request, Response } from 'express';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { db } from '../db/index';
import { calendarEvents, calendarRsvps } from '../db/schema/calendars';
import { guildMembers } from '../db/schema/guilds';
import { users } from '../db/schema/users';
import { requireAuth } from '../middleware/auth';

export const calendarsRouter = Router({ mergeParams: true });

async function verifyMembership(guildId: string, userId: string) {
  const [m] = await db.select({ id: guildMembers.id }).from(guildMembers)
    .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, userId))).limit(1);
  return !!m;
}

// GET /guilds/:guildId/calendar — list events
calendarsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;
  if (!(await verifyMembership(guildId, req.userId!))) { res.status(403).json({ code: 'FORBIDDEN' }); return; }

  const month = req.query.month as string; // YYYY-MM
  let condition = eq(calendarEvents.guildId, guildId);

  const rows = await db.select().from(calendarEvents)
    .where(condition)
    .orderBy(desc(calendarEvents.startAt));

  res.json(rows);
});

// POST /guilds/:guildId/calendar — create event
calendarsRouter.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;
  if (!(await verifyMembership(guildId, req.userId!))) { res.status(403).json({ code: 'FORBIDDEN' }); return; }

  const { title, description, startAt, endAt, allDay, color, recurring, channelId } = req.body;
  if (!title || !startAt) { res.status(400).json({ code: 'BAD_REQUEST', message: 'title and startAt required' }); return; }

  const [event] = await db.insert(calendarEvents).values({
    guildId,
    channelId: channelId || null,
    title: String(title).slice(0, 200),
    description: description || null,
    startAt: new Date(startAt),
    endAt: endAt ? new Date(endAt) : null,
    allDay: !!allDay,
    color: color || '#5865F2',
    recurring: recurring || null,
    createdBy: req.userId!,
  }).returning();

  res.status(201).json(event);
});

// PATCH /guilds/:guildId/calendar/:eventId — update event
calendarsRouter.patch('/:eventId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId, eventId } = req.params as Record<string, string>;
  const { title, description, startAt, endAt, allDay, color, recurring } = req.body;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (title !== undefined) updates.title = String(title).slice(0, 200);
  if (description !== undefined) updates.description = description;
  if (startAt !== undefined) updates.startAt = new Date(startAt);
  if (endAt !== undefined) updates.endAt = endAt ? new Date(endAt) : null;
  if (allDay !== undefined) updates.allDay = !!allDay;
  if (color !== undefined) updates.color = color;
  if (recurring !== undefined) updates.recurring = recurring;

  const [updated] = await db.update(calendarEvents).set(updates)
    .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.guildId, guildId))).returning();
  if (!updated) { res.status(404).json({ code: 'NOT_FOUND' }); return; }

  res.json(updated);
});

// DELETE /guilds/:guildId/calendar/:eventId
calendarsRouter.delete('/:eventId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId, eventId } = req.params as Record<string, string>;
  const [deleted] = await db.delete(calendarEvents)
    .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.guildId, guildId))).returning();
  if (!deleted) { res.status(404).json({ code: 'NOT_FOUND' }); return; }
  res.json({ ok: true });
});

// POST /guilds/:guildId/calendar/:eventId/rsvp — RSVP to event
calendarsRouter.post('/:eventId/rsvp', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { eventId } = req.params as Record<string, string>;
  const { status } = req.body;
  if (!['going', 'maybe', 'not_going'].includes(status)) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'status must be going, maybe, or not_going' }); return;
  }

  // Upsert
  const [existing] = await db.select().from(calendarRsvps)
    .where(and(eq(calendarRsvps.eventId, eventId), eq(calendarRsvps.userId, req.userId!))).limit(1);

  if (existing) {
    await db.update(calendarRsvps).set({ status }).where(eq(calendarRsvps.id, existing.id));
  } else {
    await db.insert(calendarRsvps).values({ eventId, userId: req.userId!, status });
  }

  // Return all RSVPs for the event
  const rsvps = await db.select({
    userId: calendarRsvps.userId,
    status: calendarRsvps.status,
    username: users.username,
    displayName: users.displayName,
  }).from(calendarRsvps)
    .innerJoin(users, eq(users.id, calendarRsvps.userId))
    .where(eq(calendarRsvps.eventId, eventId));

  res.json(rsvps);
});

// GET /guilds/:guildId/calendar/:eventId/rsvps
calendarsRouter.get('/:eventId/rsvps', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { eventId } = req.params as Record<string, string>;
  const rsvps = await db.select({
    userId: calendarRsvps.userId,
    status: calendarRsvps.status,
    username: users.username,
    displayName: users.displayName,
  }).from(calendarRsvps)
    .innerJoin(users, eq(users.id, calendarRsvps.userId))
    .where(eq(calendarRsvps.eventId, eventId));

  res.json(rsvps);
});
