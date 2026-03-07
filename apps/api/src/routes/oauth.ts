import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index';
import { oauthApps, oauthTokens } from '../db/schema/oauth';
import { requireAuth } from '../middleware/auth';
import { redis } from '../lib/redis';

export const oauthRouter = Router();

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

/** GET /oauth/authorize — public: get app info for consent screen */
oauthRouter.get('/authorize', async (req: Request, res: Response): Promise<void> => {
  const clientId = typeof req.query.client_id === 'string' ? req.query.client_id : '';
  const scope = typeof req.query.scope === 'string' ? req.query.scope : '';

  if (!clientId) {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: 'client_id is required' }); return;
  }

  const [app] = await db.select().from(oauthApps).where(eq(oauthApps.clientId, clientId)).limit(1);
  if (!app) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Application not found' }); return;
  }

  const requestedScopes = scope ? scope.split(' ') : app.scopes;

  res.json({
    id: app.id,
    name: app.name,
    description: app.description,
    iconHash: app.iconHash,
    scopes: requestedScopes,
  });
});

/** POST /oauth/authorize — authenticated: approve or deny consent */
oauthRouter.post('/authorize', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { clientId, redirectUri, scope, state, approved } = req.body;

  if (!clientId || !redirectUri) {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: 'clientId and redirectUri are required' }); return;
  }

  if (!approved) {
    res.json({ redirectUri: `${redirectUri}?error=access_denied&state=${encodeURIComponent(state || '')}` }); return;
  }

  const [app] = await db.select().from(oauthApps).where(eq(oauthApps.clientId, clientId)).limit(1);
  if (!app) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Application not found' }); return;
  }

  const code = crypto.randomBytes(16).toString('hex');
  await redis.set(
    `oauth:code:${code}`,
    JSON.stringify({ clientId, userId: req.userId, scopes: scope ? scope.split(' ') : app.scopes }),
    'EX',
    60,
  );

  res.json({ code, state, redirectUri });
});

/** POST /oauth/token — exchange code for tokens */
oauthRouter.post('/token', async (req: Request, res: Response): Promise<void> => {
  const { grant_type, code, client_id, client_secret, refresh_token } = req.body;

  if (grant_type === 'authorization_code') {
    if (!code || !client_id || !client_secret) {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'code, client_id, and client_secret are required' }); return;
    }

    const [app] = await db.select().from(oauthApps).where(eq(oauthApps.clientId, client_id)).limit(1);
    if (!app) {
      res.status(400).json({ code: 'INVALID_CLIENT', message: 'Invalid client_id' }); return;
    }

    if (sha256(client_secret) !== app.clientSecretHash) {
      res.status(401).json({ code: 'INVALID_CLIENT', message: 'Invalid client_secret' }); return;
    }

    const stored = await redis.get(`oauth:code:${code}`);
    if (!stored) {
      res.status(400).json({ code: 'INVALID_GRANT', message: 'Invalid or expired authorization code' }); return;
    }

    const codeData = JSON.parse(stored) as { clientId: string; userId: string; scopes: string[] };
    if (codeData.clientId !== client_id) {
      res.status(400).json({ code: 'INVALID_GRANT', message: 'Code does not match client' }); return;
    }

    await redis.del(`oauth:code:${code}`);

    const accessToken = crypto.randomBytes(32).toString('hex');
    const refreshTokenVal = crypto.randomBytes(32).toString('hex');

    await db.insert(oauthTokens).values({
      appId: app.id,
      userId: codeData.userId,
      accessTokenHash: sha256(accessToken),
      refreshTokenHash: sha256(refreshTokenVal),
      scopes: codeData.scopes,
      expiresAt: new Date(Date.now() + 3600 * 1000),
    });

    res.json({
      access_token: accessToken,
      refresh_token: refreshTokenVal,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: codeData.scopes.join(' '),
    });
  } else if (grant_type === 'refresh_token') {
    if (!refresh_token || !client_id || !client_secret) {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'refresh_token, client_id, and client_secret are required' }); return;
    }

    const [app] = await db.select().from(oauthApps).where(eq(oauthApps.clientId, client_id)).limit(1);
    if (!app || sha256(client_secret) !== app.clientSecretHash) {
      res.status(401).json({ code: 'INVALID_CLIENT', message: 'Invalid credentials' }); return;
    }

    const hashedRefresh = sha256(refresh_token);
    const [token] = await db.select().from(oauthTokens)
      .where(and(eq(oauthTokens.refreshTokenHash, hashedRefresh), eq(oauthTokens.appId, app.id)))
      .limit(1);

    if (!token) {
      res.status(400).json({ code: 'INVALID_GRANT', message: 'Invalid refresh token' }); return;
    }

    // Rotate tokens
    const newAccessToken = crypto.randomBytes(32).toString('hex');
    const newRefreshToken = crypto.randomBytes(32).toString('hex');

    await db.delete(oauthTokens).where(eq(oauthTokens.id, token.id));
    await db.insert(oauthTokens).values({
      appId: app.id,
      userId: token.userId,
      accessTokenHash: sha256(newAccessToken),
      refreshTokenHash: sha256(newRefreshToken),
      scopes: token.scopes,
      expiresAt: new Date(Date.now() + 3600 * 1000),
    });

    res.json({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: token.scopes.join(' '),
    });
  } else {
    res.status(400).json({ code: 'UNSUPPORTED_GRANT_TYPE', message: 'Unsupported grant_type' });
  }
});

/** GET /oauth/applications — list user's apps */
oauthRouter.get('/applications', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const apps = await db.select().from(oauthApps).where(eq(oauthApps.ownerId, req.userId!));
  res.json(apps);
});

/** POST /oauth/applications — create a new app */
oauthRouter.post('/applications', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { name, description, redirectUris, scopes } = req.body;
  if (!name) {
    res.status(400).json({ code: 'VALIDATION_ERROR', message: 'name is required' }); return;
  }

  const clientSecret = crypto.randomBytes(32).toString('hex');

  const [app] = await db.insert(oauthApps).values({
    ownerId: req.userId!,
    name,
    description: description || null,
    clientSecretHash: sha256(clientSecret),
    redirectUris: redirectUris || [],
    scopes: scopes || [],
  }).returning();

  res.status(201).json({ ...app, clientSecret });
});

/** GET /oauth/applications/:appId — get one app */
oauthRouter.get('/applications/:appId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const [app] = await db.select().from(oauthApps)
    .where(and(eq(oauthApps.id, (req.params.appId as string)), eq(oauthApps.ownerId, req.userId!)))
    .limit(1);

  if (!app) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Application not found' }); return;
  }
  res.json(app);
});

/** PATCH /oauth/applications/:appId — update app */
oauthRouter.patch('/applications/:appId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { name, description, redirectUris, scopes } = req.body;

  const [app] = await db.select().from(oauthApps)
    .where(and(eq(oauthApps.id, (req.params.appId as string)), eq(oauthApps.ownerId, req.userId!)))
    .limit(1);

  if (!app) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Application not found' }); return;
  }

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (redirectUris !== undefined) updates.redirectUris = redirectUris;
  if (scopes !== undefined) updates.scopes = scopes;

  if (Object.keys(updates).length === 0) {
    res.json(app); return;
  }

  const [updated] = await db.update(oauthApps).set(updates).where(eq(oauthApps.id, (req.params.appId as string))).returning();
  res.json(updated);
});

/** DELETE /oauth/applications/:appId — delete app */
oauthRouter.delete('/applications/:appId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const [app] = await db.select().from(oauthApps)
    .where(and(eq(oauthApps.id, (req.params.appId as string)), eq(oauthApps.ownerId, req.userId!)))
    .limit(1);

  if (!app) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Application not found' }); return;
  }

  await db.delete(oauthApps).where(eq(oauthApps.id, (req.params.appId as string)));
  res.json({ success: true });
});
