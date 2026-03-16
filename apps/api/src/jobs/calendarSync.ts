/**
 * jobs/calendarSync.ts — Sync Gratonite calendar events with Google Calendar.
 * Runs every 5 minutes via BullMQ.
 */
import { db } from '../db/index';
import { logger } from '../lib/logger';
import { calendarIntegrations } from '../db/schema/calendar-integrations';
import { calendarEvents } from '../db/schema/calendars';
import { eq, and, gte, lte } from 'drizzle-orm';
import { refreshAccessToken, createCalendarEvent, listCalendarEvents } from '../lib/google-calendar';

/** Core processor — used by BullMQ worker. */
export async function processCalendarSync(): Promise<void> {
  const integrations = await db.select().from(calendarIntegrations)
    .where(eq(calendarIntegrations.syncEnabled, true));

  for (const integration of integrations) {
    try {
      let accessToken = integration.accessToken;

      // Refresh token if expired (or within 5 minutes of expiry)
      const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
      if (new Date(integration.tokenExpiresAt) <= fiveMinutesFromNow) {
        try {
          const refreshed = await refreshAccessToken(integration.refreshToken);
          accessToken = refreshed.accessToken;
          await db.update(calendarIntegrations).set({
            accessToken: refreshed.accessToken,
            tokenExpiresAt: refreshed.expiresAt,
          }).where(eq(calendarIntegrations.id, integration.id));
        } catch (err) {
          logger.error(`[calendarSync] Failed to refresh token for integration ${integration.id}:`, err);
          continue;
        }
      }

      // Fetch Gratonite guild events for the next 30 days (if guildId is set)
      if (integration.guildId) {
        const now = new Date();
        const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        const gratoniteEvents = await db.select().from(calendarEvents)
          .where(and(
            eq(calendarEvents.guildId, integration.guildId),
            gte(calendarEvents.startAt, now),
            lte(calendarEvents.startAt, thirtyDaysLater),
          ));

        // Fetch existing Google Calendar events to avoid duplicates
        let googleEvents: Awaited<ReturnType<typeof listCalendarEvents>> = [];
        try {
          googleEvents = await listCalendarEvents(
            accessToken,
            now.toISOString(),
            thirtyDaysLater.toISOString(),
            integration.calendarId,
          );
        } catch (err) {
          logger.warn(`[calendarSync] Failed to fetch Google Calendar events for integration ${integration.id}:`, err);
        }

        const googleEventSummaries = new Set(googleEvents.map(e => e.summary));

        // Sync new Gratonite events to Google Calendar
        for (const event of gratoniteEvents) {
          // Skip if an event with the same title already exists in Google Calendar
          const summaryWithPrefix = `[Gratonite] ${event.title}`;
          if (googleEventSummaries.has(summaryWithPrefix)) continue;

          try {
            await createCalendarEvent(accessToken, {
              summary: summaryWithPrefix,
              description: event.description || undefined,
              start: event.allDay
                ? { date: event.startAt.toISOString().split('T')[0] }
                : { dateTime: event.startAt.toISOString() },
              end: event.endAt
                ? (event.allDay
                  ? { date: event.endAt.toISOString().split('T')[0] }
                  : { dateTime: event.endAt.toISOString() })
                : (event.allDay
                  ? { date: event.startAt.toISOString().split('T')[0] }
                  : { dateTime: new Date(event.startAt.getTime() + 60 * 60 * 1000).toISOString() }),
            }, integration.calendarId);
          } catch (err) {
            logger.warn(`[calendarSync] Failed to create Google event "${event.title}":`, err);
          }
        }
      }

      // Update lastSyncAt
      await db.update(calendarIntegrations).set({ lastSyncAt: new Date() })
        .where(eq(calendarIntegrations.id, integration.id));

    } catch (err) {
      logger.error(`[calendarSync] Error processing integration ${integration.id}:`, err);
    }
  }
}

/** @deprecated Legacy setInterval starter — kept for fallback. Use BullMQ worker instead. */
export function startCalendarSyncJob() {
  setInterval(async () => {
    try {
      await processCalendarSync();
    } catch (err) {
      logger.error('[calendarSync] Job error:', err);
    }
  }, 5 * 60_000);
}
