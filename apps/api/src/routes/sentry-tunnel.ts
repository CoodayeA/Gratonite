import express, { Router, type Request, type Response } from 'express';
import { logger } from '../lib/logger';

function getTunnelTarget() {
  const dsn = process.env.WEB_SENTRY_DSN;
  if (!dsn) {
    return null;
  }

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
      const target = getTunnelTarget();
      if (!target) {
        res.status(503).json({ code: 'NOT_CONFIGURED', message: 'Sentry tunnel is not configured' });
        return;
      }
      const upstream = await fetch(target.url, {
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
