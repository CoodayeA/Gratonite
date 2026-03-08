/**
 * middleware/federation-auth.ts — Verify HTTP Signatures on inbound federation requests.
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../db/index';
import { federatedInstances } from '../db/schema/federation-instances';
import { instanceBlocks } from '../db/schema/instance-blocks';
import { eq, and, or, isNull, gte } from 'drizzle-orm';
import { verifyRequest } from '../lib/http-signature';
import { isFederationEnabled, getFederationFlags } from '../federation/index';

/**
 * Middleware that verifies an inbound federation request via HTTP Signature.
 * Sets req.federationInstanceId and req.federationInstanceUrl on success.
 */
export async function requireFederationAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!isFederationEnabled()) {
    res.status(503).json({ code: 'FEDERATION_DISABLED', message: 'Federation is not enabled on this instance' });
    return;
  }

  const flags = getFederationFlags();
  if (!flags.allowInbound) {
    res.status(503).json({ code: 'FEDERATION_INBOUND_DISABLED', message: 'Inbound federation is disabled' });
    return;
  }

  const signature = req.headers['signature'] as string | undefined;
  if (!signature) {
    res.status(401).json({ code: 'MISSING_SIGNATURE', message: 'HTTP Signature header required' });
    return;
  }

  // Parse keyId from signature header
  const keyIdMatch = signature.match(/keyId="([^"]+)"/);
  if (!keyIdMatch) {
    res.status(401).json({ code: 'INVALID_SIGNATURE', message: 'Missing keyId in Signature header' });
    return;
  }

  const keyId = keyIdMatch[1];
  // keyId format: https://instance.com/api/v1/federation/actor#main-key
  // Extract base URL
  let instanceUrl: string;
  try {
    const url = new URL(keyId);
    instanceUrl = `${url.protocol}//${url.host}`;
  } catch {
    res.status(401).json({ code: 'INVALID_KEY_ID', message: 'Invalid keyId URL format' });
    return;
  }

  // Check if this domain is blocked
  const domain = new URL(instanceUrl).hostname;
  const now = new Date();
  const blocks = await db
    .select({ id: instanceBlocks.id })
    .from(instanceBlocks)
    .where(and(
      eq(instanceBlocks.blockedDomain, domain),
      or(isNull(instanceBlocks.expiresAt), gte(instanceBlocks.expiresAt, now)),
    ))
    .limit(1);

  if (blocks.length > 0) {
    res.status(403).json({ code: 'INSTANCE_BLOCKED', message: 'Your instance has been blocked' });
    return;
  }

  // Look up instance
  const [instance] = await db
    .select()
    .from(federatedInstances)
    .where(eq(federatedInstances.baseUrl, instanceUrl))
    .limit(1);

  if (!instance) {
    res.status(401).json({ code: 'UNKNOWN_INSTANCE', message: 'Instance not recognized. Complete handshake first.' });
    return;
  }

  if (instance.status !== 'active') {
    res.status(403).json({ code: 'INSTANCE_SUSPENDED', message: `Instance is ${instance.status}` });
    return;
  }

  if (!instance.publicKeyPem) {
    res.status(401).json({ code: 'NO_PUBLIC_KEY', message: 'Instance has no public key on file' });
    return;
  }

  // Verify the HTTP Signature
  const isValid = verifyRequest(req, instance.publicKeyPem);
  if (!isValid) {
    res.status(401).json({ code: 'SIGNATURE_INVALID', message: 'HTTP Signature verification failed' });
    return;
  }

  // Update last seen
  await db.update(federatedInstances)
    .set({ lastSeenAt: new Date(), failedHeartbeats: 0 })
    .where(eq(federatedInstances.id, instance.id));

  // Attach instance info to request
  (req as any).federationInstanceId = instance.id;
  (req as any).federationInstanceUrl = instanceUrl;

  next();
}
