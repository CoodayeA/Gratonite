/**
 * routes/setup.ts — One-click self-host setup wizard.
 *
 * Provides endpoints for first-time instance configuration:
 *   GET  /setup/status — Is this instance configured?
 *   POST /setup/init   — Run first-time setup
 *   POST /setup/test-domain — Verify domain is reachable
 */

import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { db } from '../db/index';
import { users } from '../db/schema/users';
import { federationKeyPairs } from '../db/schema/federation-key-pairs';
import { eq, sql } from 'drizzle-orm';
import { assertNotPrivateHost } from '../lib/ssrf-guard';
import { logger } from '../lib/logger';

export const setupRouter = Router();

/**
 * GET /setup/status — Check if instance is configured.
 */
setupRouter.get('/status', async (_req: Request, res: Response) => {
  try {
    // Check if any admin user exists
    const [admin] = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.isAdmin, true))
      .limit(1);

    // Check if federation keys exist
    const [keys] = await db.select({ id: federationKeyPairs.id })
      .from(federationKeyPairs)
      .where(eq(federationKeyPairs.isActive, true))
      .limit(1);

    const configured = !!admin;
    const federationReady = !!keys;

    res.json({
      configured,
      federationReady,
      domain: process.env.INSTANCE_DOMAIN || null,
      federationEnabled: process.env.FEDERATION_ENABLED === 'true',
      relayEnabled: process.env.RELAY_ENABLED === 'true',
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check setup status' });
  }
});

/**
 * POST /setup/init — First-time setup.
 * Creates admin user, generates federation keys, configures instance.
 */
setupRouter.post('/init', async (req: Request, res: Response) => {
  const { domain, adminEmail, adminPassword, adminUsername, enableFederation, enableRelay } = req.body as {
    domain?: string;
    adminEmail?: string;
    adminPassword?: string;
    adminUsername?: string;
    enableFederation?: boolean;
    enableRelay?: boolean;
  };

  // Validate required fields
  if (!domain || !adminEmail || !adminPassword) {
    res.status(400).json({ code: 'MISSING_FIELDS', message: 'domain, adminEmail, and adminPassword are required' });
    return;
  }

  if (adminPassword.length < 8) {
    res.status(400).json({ code: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters' });
    return;
  }

  // Check if already configured
  const [existingAdmin] = await db.select({ id: users.id })
    .from(users)
    .where(eq(users.isAdmin, true))
    .limit(1);

  if (existingAdmin) {
    res.status(409).json({ code: 'ALREADY_CONFIGURED', message: 'Instance is already configured' });
    return;
  }

  try {
    // Hash the admin password
    const bcrypt = await import('bcrypt');
    const passwordHash = await bcrypt.hash(adminPassword, 12);

    // Create admin user
    const username = adminUsername || 'admin';
    const [adminUser] = await db.insert(users).values({
      username,
      email: adminEmail,
      passwordHash,
      displayName: 'Admin',
      isAdmin: true,
      emailVerified: true,
    }).returning({ id: users.id });

    // Generate federation keys if enabled
    let federationAddress = null;
    if (enableFederation !== false) {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });

      const keyId = `https://${domain}/api/v1/federation/actor#main-key`;
      await db.insert(federationKeyPairs).values({
        keyId,
        publicKeyPem: publicKey,
        privateKeyPem: privateKey,
        algorithm: 'ed25519',
        isActive: true,
      });

      federationAddress = `${username}@${domain}`;
    }

    logger.info(`[setup] Instance configured: domain=${domain}, admin=${adminEmail}`);

    res.status(201).json({
      success: true,
      domain,
      adminUserId: adminUser.id,
      federationAddress,
      federationEnabled: enableFederation !== false,
      relayEnabled: enableRelay ?? false,
      message: 'Instance configured successfully! Set INSTANCE_DOMAIN, FEDERATION_ENABLED, and RELAY_ENABLED in your environment, then restart.',
    });
  } catch (err) {
    logger.error('[setup] Init failed:', err);
    res.status(500).json({ code: 'SETUP_FAILED', message: 'Setup failed. Check server logs.' });
  }
});

/**
 * POST /setup/test-domain — Verify a domain is reachable.
 */
setupRouter.post('/test-domain', async (req: Request, res: Response) => {
  const { domain } = req.body as { domain?: string };
  if (!domain) {
    res.status(400).json({ code: 'MISSING_DOMAIN', message: 'domain is required' });
    return;
  }

  try {
    await assertNotPrivateHost(domain);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    const resp = await fetch(`https://${domain}/health`, { signal: controller.signal });
    clearTimeout(timer);

    res.json({
      reachable: resp.ok,
      status: resp.status,
      message: resp.ok ? 'Domain is reachable' : `Domain returned ${resp.status}`,
    });
  } catch {
    res.json({
      reachable: false,
      message: 'Domain is not reachable. Make sure DNS is configured and TLS is set up.',
    });
  }
});
