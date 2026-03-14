/**
 * routes/bot-applications.ts — Webhook bot application management.
 *
 * Mounted at /bots/applications in src/routes/index.ts.
 *
 * Endpoints:
 *   POST   /                  — Register a new webhook bot
 *   GET    /mine              — List developer's own bots
 *   GET    /:id               — Get single bot (owner only)
 *   PATCH  /:id               — Update bot fields (owner only)
 *   DELETE /:id               — Delete bot (owner only)
 *   POST   /:id/rotate        — Rotate API token (owner only)
 *
 * Security notes:
 *   - webhookSecretKey and webhookSecretHash are NEVER returned in list/get
 *     responses. The raw webhookSecret is returned only on creation.
 *   - apiToken is returned only on creation and after a successful rotation.
 *
 * @module routes/bot-applications
 */

import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import argon2 from 'argon2';

import { db } from '../db/index';
import { botApplications } from '../db/schema/bot-applications';
import { botListings } from '../db/schema/bot-store';
import { users } from '../db/schema/users';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';

export const botApplicationsRouter = Router();

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const createBotSchema = z.object({
  name: z.string().min(1).max(64),
  description: z.string().optional(),
  webhookUrl: z.string().url().max(512),
  avatarHash: z.string().max(255).optional(),
});

const VALID_EVENTS = ['message_create', 'message_update', 'message_delete', 'member_join', 'member_leave', 'reaction_add', 'reaction_remove', 'component_interaction'] as const;

const updateBotSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  description: z.string().optional(),
  webhookUrl: z.string().url().max(512).optional(),
  avatarHash: z.string().max(255).optional(),
  isActive: z.boolean().optional(),
  subscribedEvents: z.array(z.enum(VALID_EVENTS)).optional(),
});

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns a safe public representation of a bot — all secret fields omitted.
 * This shape is used in every list/get response.
 */
function publicBot(bot: typeof botApplications.$inferSelect) {
  return {
    id: bot.id,
    ownerId: bot.ownerId,
    name: bot.name,
    description: bot.description,
    avatarHash: bot.avatarHash,
    webhookUrl: bot.webhookUrl,
    isActive: bot.isActive,
    listingId: bot.listingId,
    subscribedEvents: bot.subscribedEvents,
    botUserId: bot.botUserId,
    createdAt: bot.createdAt,
    updatedAt: bot.updatedAt,
  };
}

/**
 * Sends a ping event to the given webhookUrl and returns whether it was
 * reachable. Enforces a 3-second timeout via AbortController.
 * Never throws — all errors are swallowed and map to `false`.
 */
async function pingWebhook(webhookUrl: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);

    const resp = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'ping', timestamp: Date.now() }),
      signal: controller.signal,
    });

    clearTimeout(timer);
    // Treat any HTTP-level response (even 4xx/5xx) as "reachable".
    return resp.status > 0;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// POST /bots/applications — Register new webhook bot
// ---------------------------------------------------------------------------

/**
 * POST /bots/applications
 *
 * Registers a new webhook bot for the authenticated developer.
 *
 * Creation flow:
 *   1. Generate webhookSecretKey — 32 random bytes as a 64-char hex string.
 *   2. Argon2-hash the key for storage (webhookSecretHash).
 *   3. Pre-generate the bot's UUID so it can be embedded in the JWT.
 *   4. Sign a 100-year JWT containing { botId, type: 'bot' }.
 *   5. Kick off a non-blocking ping to the webhookUrl.
 *   6. Insert the bot row.
 *   7. Return the public bot shape + the raw webhookSecret + apiToken
 *      (both are one-time reveals).
 *
 * @auth    requireAuth
 * @body    { name, description?, webhookUrl, avatarHash? }
 * @returns 201 Public bot + webhookSecret + apiToken + webhookReachable
 * @returns 400 Validation failure
 * @returns 500 Unexpected error
 */
botApplicationsRouter.post(
  '/',
  requireAuth,
  validate(createBotSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, description, webhookUrl, avatarHash } =
        req.body as z.infer<typeof createBotSchema>;

      // 1. Raw HMAC signing key — 256 bits of entropy, hex-encoded.
      const webhookSecretKey = crypto.randomBytes(32).toString('hex');

      // 2. Argon2 hash stored in the DB (for developer verification UI).
      const webhookSecretHash = await argon2.hash(webhookSecretKey);

      // 3. Generate the UUID in application code so we can embed it in the JWT
      //    before the DB insert.
      const botId = crypto.randomUUID();

      // 4. Long-lived bot JWT.
      const apiToken = jwt.sign(
        { botId, type: 'bot' },
        process.env.JWT_SECRET!,
        { expiresIn: '100y' },
      );

      // 5. Start the ping concurrently — do not block the insert.
      const pingPromise = pingWebhook(webhookUrl);

      // 5b. Create a virtual user for the bot (so it appears in member lists)
      const botUsername = `bot_${name.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 24)}_${crypto.randomBytes(2).toString('hex')}`;
      const [botUser] = await db
        .insert(users)
        .values({
          username: botUsername,
          email: `bot+${botId}@gratonite.internal`,
          passwordHash: 'BOT_ACCOUNT_NO_LOGIN',
          displayName: name,
          avatarHash: avatarHash ?? null,
          isBot: true,
          status: 'online',
        })
        .returning();

      // 6. Insert.
      const [newBot] = await db
        .insert(botApplications)
        .values({
          id: botId,
          ownerId: req.userId!,
          name,
          description: description ?? null,
          webhookUrl,
          avatarHash: avatarHash ?? null,
          webhookSecretHash,
          webhookSecretKey,
          apiToken,
          isActive: true,
          botUserId: botUser.id,
        })
        .returning();

      // Collect ping result (usually already resolved by now).
      const webhookReachable = await pingPromise;

      // 7. Respond — raw secret + token shown exactly once.
      res.status(201).json({
        ...publicBot(newBot),
        webhookSecret: webhookSecretKey,
        apiToken,
        webhookReachable,
      });
    } catch (err) {
      logger.error('[bot-applications] POST / error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /bots/applications/mine — List developer's own bots
// ---------------------------------------------------------------------------

/**
 * GET /bots/applications/mine
 *
 * Returns all bot applications owned by the authenticated user.
 * Secret fields (webhookSecretHash, webhookSecretKey, apiToken) are stripped.
 *
 * IMPORTANT: This route must be registered before /:id so that Express does
 * not interpret "mine" as an ID parameter.
 *
 * @auth    requireAuth
 * @returns 200 Array of public bot objects
 */
botApplicationsRouter.get(
  '/mine',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const rows = await db
        .select()
        .from(botApplications)
        .where(eq(botApplications.ownerId, req.userId!));

      res.status(200).json(rows.map(publicBot));
    } catch (err) {
      logger.error('[bot-applications] GET /mine error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /bots/applications/:id — Get single bot (owner only)
// ---------------------------------------------------------------------------

/**
 * GET /bots/applications/:id
 *
 * Returns a single bot application. The caller must be the owner.
 *
 * @auth    requireAuth, owner only
 * @param   id {string} — Bot application UUID
 * @returns 200 Public bot object
 * @returns 403 Not the owner
 * @returns 404 Bot not found
 */
botApplicationsRouter.get(
  '/:id',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id: _id } = req.params; const id = _id as string;

      const [bot] = await db
        .select()
        .from(botApplications)
        .where(eq(botApplications.id, id))
        .limit(1);

      if (!bot) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Bot not found' });
        return;
      }

      if (bot.ownerId !== req.userId) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'You do not own this bot' });
        return;
      }

      res.status(200).json(publicBot(bot));
    } catch (err) {
      logger.error('[bot-applications] GET /:id error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /bots/applications/:id — Update bot (owner only)
// ---------------------------------------------------------------------------

/**
 * PATCH /bots/applications/:id
 *
 * Updates one or more mutable fields on a bot application. Only fields
 * explicitly included in the request body are changed; omitted fields retain
 * their current values.
 *
 * @auth    requireAuth, owner only
 * @param   id {string}
 * @body    { name?, description?, webhookUrl?, avatarHash?, isActive? }
 * @returns 200 Updated public bot object
 * @returns 400 Validation failure or no fields provided
 * @returns 403 Not the owner
 * @returns 404 Bot not found
 */
botApplicationsRouter.patch(
  '/:id',
  requireAuth,
  validate(updateBotSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id: _id } = req.params; const id = _id as string;
      const body = req.body as z.infer<typeof updateBotSchema>;

      const [bot] = await db
        .select()
        .from(botApplications)
        .where(eq(botApplications.id, id))
        .limit(1);

      if (!bot) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Bot not found' });
        return;
      }

      if (bot.ownerId !== req.userId) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'You do not own this bot' });
        return;
      }

      // Build a sparse update — only fields present in the request body.
      const updates: Partial<typeof botApplications.$inferInsert> = {};
      if (body.name !== undefined)              updates.name = body.name;
      if (body.description !== undefined)       updates.description = body.description;
      if (body.webhookUrl !== undefined)        updates.webhookUrl = body.webhookUrl;
      if (body.avatarHash !== undefined)        updates.avatarHash = body.avatarHash;
      if (body.isActive !== undefined)          updates.isActive = body.isActive;
      if (body.subscribedEvents !== undefined)  updates.subscribedEvents = body.subscribedEvents;

      if (Object.keys(updates).length === 0) {
        res.status(400).json({ code: 'VALIDATION_ERROR', message: 'No fields to update' });
        return;
      }

      updates.updatedAt = new Date();

      const [updated] = await db
        .update(botApplications)
        .set(updates)
        .where(eq(botApplications.id, id))
        .returning();

      res.status(200).json(publicBot(updated));
    } catch (err) {
      logger.error('[bot-applications] PATCH /:id error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /bots/applications/:id — Delete bot (owner only)
// ---------------------------------------------------------------------------

/**
 * DELETE /bots/applications/:id
 *
 * Permanently removes the bot application. Associated botInstalls rows are
 * handled by the DB-level foreign key cascade on botListings → botInstalls.
 *
 * @auth    requireAuth, owner only
 * @param   id {string}
 * @returns 200 { code: 'OK', message: 'Bot deleted' }
 * @returns 403 Not the owner
 * @returns 404 Bot not found
 */
botApplicationsRouter.delete(
  '/:id',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id: _id } = req.params; const id = _id as string;

      const [bot] = await db
        .select({ id: botApplications.id, ownerId: botApplications.ownerId })
        .from(botApplications)
        .where(eq(botApplications.id, id))
        .limit(1);

      if (!bot) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Bot not found' });
        return;
      }

      if (bot.ownerId !== req.userId) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'You do not own this bot' });
        return;
      }

      await db.delete(botApplications).where(eq(botApplications.id, id));

      res.status(200).json({ code: 'OK', message: 'Bot deleted' });
    } catch (err) {
      logger.error('[bot-applications] DELETE /:id error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /bots/applications/:id/rotate — Rotate API token (owner only)
// ---------------------------------------------------------------------------

/**
 * POST /bots/applications/:id/rotate
 *
 * Generates a fresh long-lived JWT for the bot and stores it in the DB,
 * effectively invalidating the previous token immediately.
 *
 * The new token is returned in the response body and is shown only once.
 * The developer must update the token in their bot's environment.
 *
 * @auth    requireAuth, owner only
 * @param   id {string}
 * @returns 200 { apiToken: string }
 * @returns 403 Not the owner
 * @returns 404 Bot not found
 */
botApplicationsRouter.post(
  '/:id/rotate',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id: _id } = req.params; const id = _id as string;

      const [bot] = await db
        .select({ id: botApplications.id, ownerId: botApplications.ownerId })
        .from(botApplications)
        .where(eq(botApplications.id, id))
        .limit(1);

      if (!bot) {
        res.status(404).json({ code: 'NOT_FOUND', message: 'Bot not found' });
        return;
      }

      if (bot.ownerId !== req.userId) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'You do not own this bot' });
        return;
      }

      const newApiToken = jwt.sign(
        { botId: bot.id, type: 'bot' },
        process.env.JWT_SECRET!,
        { expiresIn: '100y' },
      );

      await db
        .update(botApplications)
        .set({ apiToken: newApiToken, updatedAt: new Date() })
        .where(eq(botApplications.id, id));

      res.status(200).json({ apiToken: newApiToken });
    } catch (err) {
      logger.error('[bot-applications] POST /:id/rotate error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  },
);
