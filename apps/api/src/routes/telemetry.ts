import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { verifyAccessToken } from '../lib/jwt';
import { logger } from '../lib/logger';

export const telemetryRouter = Router();

const clientEventSchema = z.object({
  event: z.enum([
    'guild_open_attempt',
    'guild_open_result',
    'guild_toast_suppressed',
    'auth_refresh_attempt',
    'auth_refresh_result',
    'auth_expired_transition',
    'auth_request_short_circuit',
  ]),
  guildId: z.string().uuid().nullable().optional(),
  route: z.string().max(512).nullable().optional(),
  statusClass: z.enum(['success', 'forbidden', 'not_found', 'network', 'unauthorized']).nullable().optional(),
  latencyMs: z.number().int().min(0).max(300000).nullable().optional(),
  requestId: z.string().max(128).nullable().optional(),
  reason: z.string().max(128).nullable().optional(),
  timestamp: z.string().datetime().optional(),
});

function resolveUserId(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  try {
    const payload = verifyAccessToken(token);
    return payload.userId;
  } catch (err) {
    logger.debug({ msg: 'telemetry token verification failed', err });
    return null;
  }
}

telemetryRouter.post(
  '/client-events',
  (req: Request, res: Response): void => {
    const parsed = clientEventSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ code: 'BAD_REQUEST', message: 'Invalid telemetry payload' });
      return;
    }

    const requestId = String(req.headers['x-request-id'] ?? req.headers['x-correlation-id'] ?? '');
    const userId = resolveUserId(req);
    const payload = parsed.data;

    console.info(JSON.stringify({
      event: payload.event,
      guildId: payload.guildId ?? null,
      userId,
      route: payload.route ?? '/app/guild/:guildId',
      statusClass: payload.statusClass ?? null,
      latencyMs: payload.latencyMs ?? null,
      upstreamRequestId: payload.requestId ?? null,
      reason: payload.reason ?? null,
      requestId: requestId || null,
      status: 202,
      timestamp: payload.timestamp ?? new Date().toISOString(),
    }));

    res.status(202).json({ ok: true });
  },
);
