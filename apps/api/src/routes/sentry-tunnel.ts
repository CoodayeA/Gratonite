import express, { Router, type Request, type Response } from 'express';
import { logger } from '../lib/logger';

const DEFAULT_WEB_SENTRY_DSN =
  'https://06e4ca4d04c520405630f744f70700b1@o4511074273329152.ingest.us.sentry.io/4511074372616192';

function getTunnelTarget() {
  const dsn = process.env.WEB_SENTRY_DSN || DEFAULT_WEB_SENTRY_DSN;
  const parsed = new URL(dsn);
  const projectId = parsed.pathname.replace(/^\//, '');
  const publicKey = parsed.username;

  if (!projectId || !publicKey) {
    throw new Error('Invalid WEB_SENTRY_DSN');
  }

  return {
    url: `https://${parsed.host}/api/${projectId}/envelope/?sentry_key=${encodeURIComponent(publicKey)}&sentry_version=7`,
  };
}

export const sentryTunnelRouter = Router();

sentryTunnelRouter.post(
  '/',
  express.raw({ type: '*/*', limit: '512kb' }),
  async (req: Request, res: Response): Promise<void> => {
    const payload = req.body;
    if (!Buffer.isBuffer(payload) || payload.length === 0) {
      res.status(400).json({ code: 'BAD_REQUEST', message: 'Missing Sentry envelope payload' });
      return;
    }

    try {
      const { url } = getTunnelTarget();
      const upstream = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': req.get('content-type') || 'application/x-sentry-envelope',
        },
        body: new Uint8Array(payload),
      });

      if (!upstream.ok) {
        logger.warn({
          msg: 'Sentry tunnel upstream rejected payload',
          status: upstream.status,
        });
      }

      res.status(200).set('cache-control', 'no-store').end();
    } catch (error) {
      logger.warn({ msg: 'Sentry tunnel failed', error });
      res.status(200).set('cache-control', 'no-store').end();
    }
  },
);
