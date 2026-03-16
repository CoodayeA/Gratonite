/**
 * jobs/dndSchedule.ts — Background cron job for automatic DND scheduling.
 *
 * Every 60 seconds, checks all enabled DND schedules and:
 * - If the current time (in the user's timezone) falls within the DND window, sets status to 'dnd'
 * - If the current time is outside the window and user was auto-DND'd, restores previous status
 */

import { eq, and } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { db } from '../db/index';
import { dndSchedules } from '../db/schema/dnd-schedules';
import { users } from '../db/schema/users';
import { getIO } from '../lib/socket-io';

/**
 * Track which users were auto-set to DND so we can restore their previous status.
 * Maps userId -> previous status before auto-DND was applied.
 */
const autoDndUsers = new Map<string, string>();

function isWithinDndWindow(startTime: string, endTime: string, days: number[], timezone: string): boolean {
  // Get current time in the user's timezone
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  });

  const parts = formatter.formatToParts(now);
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
  const currentTime = `${hour}:${minute}`;

  // Get current day of week (0=Sunday)
  const dayFormatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'long' });
  const dayName = dayFormatter.format(now);
  const dayMap: Record<string, number> = {
    Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
    Thursday: 4, Friday: 5, Saturday: 6,
  };
  const currentDay = dayMap[dayName] ?? 0;

  // Check if today is an active day
  if (!days.includes(currentDay)) return false;

  // Handle same-day and overnight windows
  if (startTime <= endTime) {
    // Same-day window: e.g. 09:00 - 17:00
    return currentTime >= startTime && currentTime < endTime;
  } else {
    // Overnight window: e.g. 22:00 - 08:00
    return currentTime >= startTime || currentTime < endTime;
  }
}

/** Core processor — used by both the legacy setInterval and BullMQ worker. */
export async function processDndSchedule(): Promise<void> {
  const schedules = await db.select()
    .from(dndSchedules)
    .where(eq(dndSchedules.enabled, true));

  for (const schedule of schedules) {
    try {
      const days = (schedule.days as number[]) || [0, 1, 2, 3, 4, 5, 6];
      const inWindow = isWithinDndWindow(schedule.startTime, schedule.endTime, days, schedule.timezone);

      const [user] = await db.select({ id: users.id, status: users.status })
        .from(users)
        .where(eq(users.id, schedule.userId))
        .limit(1);

      if (!user) continue;

      if (inWindow && user.status !== 'dnd') {
        // Save previous status and set to DND
        autoDndUsers.set(user.id, user.status);
        await db.update(users)
          .set({ status: 'dnd' })
          .where(eq(users.id, user.id));

        try {
          getIO().emit('PRESENCE_UPDATE', { userId: user.id, status: 'dnd' });
        } catch { /* socket not ready */ }
      } else if (!inWindow && autoDndUsers.has(user.id)) {
        // Restore previous status
        const previousStatus = autoDndUsers.get(user.id)!;
        autoDndUsers.delete(user.id);

        // Only restore if user is still in DND (they didn't manually change it)
        if (user.status === 'dnd') {
          await db.update(users)
            .set({ status: previousStatus })
            .where(eq(users.id, user.id));

          try {
            getIO().emit('PRESENCE_UPDATE', { userId: user.id, status: previousStatus });
          } catch { /* socket not ready */ }
        }
      }
    } catch (err) {
      logger.error(`[dndSchedule] Error processing schedule for user ${schedule.userId}:`, err);
    }
  }
}

/** @deprecated Legacy setInterval starter — kept for fallback. Use BullMQ worker instead. */
export function startDndScheduleJob() {
  setInterval(async () => {
    try {
      await processDndSchedule();
    } catch (err) {
      logger.error('[dndSchedule] Job error:', err);
    }
  }, 60_000);
}
