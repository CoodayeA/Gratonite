/**
 * routes/calendar-sync.ts — Google Calendar integration (OAuth + sync).
 * Mounted at /users/@me/calendar-integrations
 */
import { Router, Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import crypto from 'node:crypto';
import { db } from '../db/index';
import { calendarIntegrations } from '../db/schema/calendar-integrations';
import { requireAuth } from '../middleware/auth';
import { logger } from '../lib/logger';
import { exchangeCodeForTokens, refreshAccessToken, listCalendarEvents } from '../lib/google-calendar';

export const calendarSyncRouter = Router();

const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/calendar';

// SECURITY: HMAC-sign the OAuth state parameter to prevent state forgery
const STATE_SECRET = process.env.CALENDAR_STATE_SECRET || process.env.JWT_SECRET || 'gratonite-calendar-state-secret';
function signState(payload: object): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', STATE_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}
function verifyState(stateParam: string): { userId: string; guildId: string | null } | null {
  const dotIdx = stateParam.lastIndexOf('.');
  if (dotIdx === -1) return null;
  const data = stateParam.slice(0, dotIdx);
  const sig = stateParam.slice(dotIdx + 1);
  const expected = crypto.createHmac('sha256', STATE_SECRET).update(data).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try { return JSON.parse(Buffer.from(data, 'base64url').toString()); } catch { return null; }
}

// GET /users/@me/calendar-integrations — list connected calendars
calendarSyncRouter.get('/users/@me/calendar-integrations', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const rows = await db.select({
      id: calendarIntegrations.id,
      guildId: calendarIntegrations.guildId,
      provider: calendarIntegrations.provider,
      calendarId: calendarIntegrations.calendarId,
      syncEnabled: calendarIntegrations.syncEnabled,
      lastSyncAt: calendarIntegrations.lastSyncAt,
      createdAt: calendarIntegrations.createdAt,
    }).from(calendarIntegrations)
      .where(eq(calendarIntegrations.userId, req.userId!));

    res.json(rows);
  } catch (err) {
    logger.error('[calendar-sync] GET list error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// POST /users/@me/calendar-integrations/google/connect — initiate Google OAuth flow
calendarSyncRouter.post('/users/@me/calendar-integrations/google/connect', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      res.status(503).json({ code: 'NOT_CONFIGURED', message: 'Google Calendar integration is not configured' });
      return;
    }

    const appUrl = process.env.APP_URL || 'http://localhost:4000';
    const redirectUri = `${appUrl}/api/v1/users/@me/calendar-integrations/google/callback`;
    const { guildId } = req.body as { guildId?: string };

    // SECURITY: HMAC-sign state to prevent forgery
    const state = signState({ userId: req.userId, guildId: guildId || null });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: GOOGLE_SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    res.json({ authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
  } catch (err) {
    logger.error('[calendar-sync] POST connect error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// GET /users/@me/calendar-integrations/google/callback — OAuth callback
calendarSyncRouter.get('/users/@me/calendar-integrations/google/callback', async (req: Request, res: Response): Promise<void> => {
  try {
    const code = req.query.code as string;
    const stateParam = req.query.state as string;

    if (!code || !stateParam) {
      res.status(400).json({ code: 'BAD_REQUEST', message: 'Missing code or state parameter' });
      return;
    }

    // SECURITY: verify HMAC signature on state to prevent forgery/account takeover
    const state = verifyState(stateParam);
    if (!state || !state.userId) {
      res.status(400).json({ code: 'BAD_REQUEST', message: 'Invalid or tampered state parameter' });
      return;
    }

    const appUrl = process.env.APP_URL || 'http://localhost:4000';
    const redirectUri = `${appUrl}/api/v1/users/@me/calendar-integrations/google/callback`;

    const tokens = await exchangeCodeForTokens(code, redirectUri);

    // Upsert the integration
    const existingConditions = [
      eq(calendarIntegrations.userId, state.userId),
      eq(calendarIntegrations.provider, 'google'),
      ...(state.guildId ? [eq(calendarIntegrations.guildId, state.guildId)] : []),
    ];

    const existing = await db.select({ id: calendarIntegrations.id }).from(calendarIntegrations)
      .where(and(...existingConditions))
      .limit(1);

    if (existing.length > 0) {
      await db.update(calendarIntegrations).set({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: tokens.expiresAt,
        syncEnabled: true,
      }).where(eq(calendarIntegrations.id, existing[0].id));
    } else {
      await db.insert(calendarIntegrations).values({
        userId: state.userId,
        guildId: state.guildId,
        provider: 'google',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: tokens.expiresAt,
      });
    }

    // Redirect back to the app settings page
    const frontendUrl = process.env.CORS_ORIGIN || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/app/settings?calendarConnected=true`);
  } catch (err) {
    logger.error('[calendar-sync] GET callback error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to connect Google Calendar' });
  }
});

// DELETE /users/@me/calendar-integrations/:id — disconnect
calendarSyncRouter.delete('/users/@me/calendar-integrations/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const integrationId = req.params.id as string;
    const [deleted] = await db.delete(calendarIntegrations)
      .where(and(eq(calendarIntegrations.id, integrationId), eq(calendarIntegrations.userId, req.userId!)))
      .returning();

    if (!deleted) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Integration not found' });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    logger.error('[calendar-sync] DELETE error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// POST /users/@me/calendar-integrations/:id/sync — manual sync trigger
calendarSyncRouter.post('/users/@me/calendar-integrations/:id/sync', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const integrationId = req.params.id as string;
    const [integration] = await db.select().from(calendarIntegrations)
      .where(and(eq(calendarIntegrations.id, integrationId), eq(calendarIntegrations.userId, req.userId!)))
      .limit(1);

    if (!integration) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Integration not found' });
      return;
    }

    let accessToken = integration.accessToken;

    // Refresh token if expired
    if (new Date() >= integration.tokenExpiresAt) {
      const refreshed = await refreshAccessToken(integration.refreshToken);
      accessToken = refreshed.accessToken;
      await db.update(calendarIntegrations).set({
        accessToken: refreshed.accessToken,
        tokenExpiresAt: refreshed.expiresAt,
      }).where(eq(calendarIntegrations.id, integration.id));
    }

    // Fetch upcoming events from Google Calendar (next 30 days)
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const events = await listCalendarEvents(
      accessToken,
      now.toISOString(),
      thirtyDaysLater.toISOString(),
      integration.calendarId,
    );

    // Update lastSyncAt
    await db.update(calendarIntegrations).set({ lastSyncAt: new Date() })
      .where(eq(calendarIntegrations.id, integration.id));

    res.json({ synced: true, eventCount: events.length, events });
  } catch (err) {
    logger.error('[calendar-sync] POST sync error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to sync calendar' });
  }
});

// PATCH /users/@me/calendar-integrations/:id — toggle sync on/off
calendarSyncRouter.patch('/users/@me/calendar-integrations/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const integrationId = req.params.id as string;
    const { syncEnabled } = req.body as { syncEnabled?: boolean };

    if (syncEnabled === undefined) {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Nothing to update' });
      return;
    }

    const [updated] = await db.update(calendarIntegrations).set({ syncEnabled })
      .where(and(eq(calendarIntegrations.id, integrationId), eq(calendarIntegrations.userId, req.userId!)))
      .returning();

    if (!updated) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Integration not found' });
      return;
    }

    res.json(updated);
  } catch (err) {
    logger.error('[calendar-sync] PATCH error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});
