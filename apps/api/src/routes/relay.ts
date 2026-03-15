/**
 * routes/relay.ts — Relay directory endpoints.
 * Mounted at /api/v1/relays.
 */

import { Router, Request, Response } from 'express';
import { db } from '../db/index';
import { relayNodes } from '../db/schema/relay-nodes';
import { eq, desc } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { requireFederationAuth } from '../middleware/federation-auth';
import { users } from '../db/schema/users';
import { logger } from '../lib/logger';

export const relayRouter = Router();

/**
 * GET /api/v1/relays — List relays with reputation scores (public).
 */
relayRouter.get('/', async (_req: Request, res: Response) => {
  const nodes = await db.select({
    domain: relayNodes.domain,
    websocketUrl: relayNodes.websocketUrl,
    reputationScore: relayNodes.reputationScore,
    connectedInstances: relayNodes.connectedInstances,
    uptimePercent: relayNodes.uptimePercent,
    latencyMs: relayNodes.latencyMs,
    meshPeers: relayNodes.meshPeers,
    turnSupported: relayNodes.turnSupported,
    softwareVersion: relayNodes.softwareVersion,
    registeredAt: relayNodes.registeredAt,
    lastHealthCheck: relayNodes.lastHealthCheck,
  })
    .from(relayNodes)
    .where(eq(relayNodes.status, 'active'))
    .orderBy(desc(relayNodes.reputationScore))
    .limit(100);

  res.json(nodes);
});

/**
 * POST /api/v1/relays/register — Relay self-registration (federation auth).
 */
relayRouter.post('/register', requireFederationAuth, async (req: Request, res: Response) => {
  const { domain, websocketUrl, publicKeyPem, softwareVersion, turnSupported } = req.body as {
    domain?: string;
    websocketUrl?: string;
    publicKeyPem?: string;
    softwareVersion?: string;
    turnSupported?: boolean;
  };

  if (!domain || !websocketUrl) {
    res.status(400).json({ code: 'MISSING_FIELDS', message: 'domain and websocketUrl are required' });
    return;
  }

  await db.insert(relayNodes).values({
    domain,
    websocketUrl,
    publicKeyPem: publicKeyPem ?? null,
    softwareVersion: softwareVersion ?? null,
    turnSupported: turnSupported ?? false,
    status: 'active',
    reputationScore: 50, // Start neutral
    registeredAt: new Date(),
    lastHealthCheck: new Date(),
  }).onConflictDoUpdate({
    target: relayNodes.domain,
    set: {
      websocketUrl,
      publicKeyPem: publicKeyPem ?? null,
      softwareVersion: softwareVersion ?? null,
      turnSupported: turnSupported ?? false,
      lastHealthCheck: new Date(),
      updatedAt: new Date(),
    },
  });

  res.status(201).json({ status: 'registered', domain });
});

/**
 * GET /api/v1/relays/:relayId/status — Detailed relay health.
 */
relayRouter.get('/:relayId/status', async (req: Request, res: Response) => {
  const relayId = req.params.relayId as string;

  const [relay] = await db.select()
    .from(relayNodes)
    .where(eq(relayNodes.id, relayId))
    .limit(1);

  if (!relay) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Relay not found' });
    return;
  }

  res.json(relay);
});

/**
 * POST /api/v1/relays/:relayId/report — Report a relay (abuse, downtime).
 */
relayRouter.post('/:relayId/report', requireAuth, async (req: Request, res: Response) => {
  const relayId = req.params.relayId as string;
  const { reason } = req.body as { reason?: string };

  if (!reason) {
    res.status(400).json({ code: 'MISSING_REASON', message: 'reason is required' });
    return;
  }

  const [relay] = await db.select({ domain: relayNodes.domain, reputationScore: relayNodes.reputationScore })
    .from(relayNodes).where(eq(relayNodes.id, relayId)).limit(1);

  if (!relay) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Relay not found' });
    return;
  }

  // Decrease reputation on report (weighted by reporter trust — simplified for now)
  const newScore = Math.max(0, relay.reputationScore - 2);
  await db.update(relayNodes)
    .set({ reputationScore: newScore, updatedAt: new Date() })
    .where(eq(relayNodes.id, relayId));

  logger.info(`[relay:report] Relay ${relay.domain} reported: ${reason}. Score: ${relay.reputationScore} → ${newScore}`);

  res.json({ status: 'reported', newReputationScore: newScore });
});

/**
 * GET /api/v1/relays/reputation/:relayId — Reputation breakdown.
 */
relayRouter.get('/reputation/:relayId', async (req: Request, res: Response) => {
  const relayId = req.params.relayId as string;

  const [relay] = await db.select()
    .from(relayNodes)
    .where(eq(relayNodes.id, relayId))
    .limit(1);

  if (!relay) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Relay not found' });
    return;
  }

  res.json({
    domain: relay.domain,
    overall: relay.reputationScore,
    breakdown: {
      uptime: relay.uptimePercent,
      latency: relay.latencyMs,
      connectedInstances: relay.connectedInstances,
      meshPeers: relay.meshPeers,
      turnSupported: relay.turnSupported,
    },
    status: relay.status,
    registeredAt: relay.registeredAt,
    lastHealthCheck: relay.lastHealthCheck,
  });
});
