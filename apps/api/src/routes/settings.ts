import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/index';
import { userSettings } from '../db/schema/settings';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { redis } from '../lib/redis';
import { safeJsonParse } from '../lib/safe-json.js';

export const settingsRouter = Router();

const patchSettingsSchema = z.object({
  theme: z.string().max(50).optional(),
  colorMode: z.enum(['dark', 'light']).optional(),
  fontFamily: z.string().max(50).optional(),
  fontSize: z.number().int().min(10).max(24).optional(),
  glassMode: z.enum(['off', 'subtle', 'full']).optional(),
  buttonShape: z.enum(['rounded', 'pill', 'square']).optional(),
  soundMuted: z.boolean().optional(),
  soundVolume: z.number().int().min(0).max(100).optional(),
  soundPack: z.string().max(50).optional(),
  reducedMotion: z.boolean().optional(),
  lowPower: z.boolean().optional(),
  highContrast: z.boolean().optional(),
  compactMode: z.boolean().optional(),
  accentColor: z.string().max(20).nullable().optional(),
  emailNotifications: z.object({
    mentions: z.boolean().optional(),
    dms: z.boolean().optional(),
    frequency: z.enum(['instant', 'daily', 'never']).optional(),
  }).optional(),
});

/** GET /api/v1/users/@me/settings */
settingsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const [settings] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, req.userId!))
    .limit(1);

  if (!settings) {
    // Return defaults
    res.json({
      theme: 'midnight',
      colorMode: 'dark',
      fontFamily: 'Inter',
      fontSize: 14,
      glassMode: 'full',
      buttonShape: 'rounded',
      soundMuted: false,
      soundVolume: 50,
      soundPack: 'default',
      reducedMotion: false,
      lowPower: false,
      highContrast: false,
      compactMode: false,
      accentColor: null,
    });
    return;
  }

  const { id, userId, createdAt, updatedAt, ...rest } = settings;
  res.json(rest);
});

/** PATCH /api/v1/users/@me/settings */
settingsRouter.patch(
  '/',
  requireAuth,
  validate(patchSettingsSchema),
  async (req: Request, res: Response): Promise<void> => {
    const data = req.body as z.infer<typeof patchSettingsSchema>;

    // Upsert
    const [existing] = await db
      .select({ id: userSettings.id })
      .from(userSettings)
      .where(eq(userSettings.userId, req.userId!))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(userSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(userSettings.userId, req.userId!))
        .returning();
      const { id, userId, createdAt, updatedAt, ...rest } = updated;
      res.json(rest);
    } else {
      const [created] = await db
        .insert(userSettings)
        .values({ userId: req.userId!, ...data })
        .returning();
      const { id, userId, createdAt, updatedAt, ...rest } = created;
      res.json(rest);
    }
  },
);

// ---------------------------------------------------------------------------
// Notification preferences (per-guild/channel key-value store in Redis)
// ---------------------------------------------------------------------------

const notifKeySchema = z.object({
  key: z.string().min(1).max(200),
  value: z.object({
    level: z.enum(['all', 'mentions', 'nothing']).optional(),
    mutedUntil: z.string().nullable().optional(),
  }),
});

/** GET /api/v1/users/@me/settings/notif?key=notif:guild:xxx */
settingsRouter.get('/notif', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const key = req.query.key as string | undefined;
  if (!key) { res.status(400).json({ code: 'BAD_REQUEST', message: 'key query parameter required' }); return; }
  const raw = await redis.get(`user-notif:${req.userId!}:${key}`);
  if (!raw) { res.json({ key, value: null }); return; }
  const parsed = safeJsonParse(raw, null);
  res.json({ key, value: parsed });
});

/** PATCH /api/v1/users/@me/settings/notif */
settingsRouter.patch('/notif', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const parsed = notifKeySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ code: 'VALIDATION_ERROR', message: parsed.error.message }); return; }
  const { key, value } = parsed.data;
  try {
    await redis.set(`user-notif:${req.userId!}:${key}`, JSON.stringify(value));
    res.json({ key, value });
  } catch (err) {
    logger.error('[settings] notif save error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to save notification preference' });
  }
});
