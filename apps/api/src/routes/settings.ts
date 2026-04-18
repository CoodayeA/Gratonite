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
import { DEFAULT_EMAIL_NOTIFICATIONS, mergeEmailNotificationsJson } from '../lib/emailNotificationPrefs';
import { mergeNotificationQuietHoursJson } from '../lib/notificationQuietHours';
import { buildUserSettingsResponse, sanitizePersistedSettingsPatch } from '../lib/user-settings';

export const settingsRouter = Router();

const patchSettingsSchema = z.object({
  theme: z.string().max(50).optional(),
  colorMode: z.enum(['dark', 'light']).optional(),
  fontFamily: z.string().max(50).optional(),
  fontSize: z.union([z.number().int().min(10).max(24).transform(String), z.enum(['small', 'medium', 'large', 'extra-large'])]).optional(),
  glassMode: z.enum(['off', 'subtle', 'full']).optional(),
  buttonShape: z.enum(['rounded', 'pill', 'sharp', 'square']).optional(),
  soundMuted: z.boolean().optional(),
  soundVolume: z.number().int().min(0).max(100).optional(),
  soundPack: z.string().max(50).optional(),
  reducedMotion: z.boolean().optional(),
  lowPower: z.boolean().optional(),
  highContrast: z.boolean().optional(),
  compactMode: z.boolean().optional(),
  accentColor: z.string().max(20).nullable().optional(),
  screenReaderMode: z.boolean().optional(),
  linkUnderlines: z.boolean().optional(),
  focusIndicatorSize: z.enum(['normal', 'large']).optional(),
  colorBlindMode: z.enum(['none', 'deuteranopia', 'protanopia', 'tritanopia']).optional(),
  customThemeId: z.string().uuid().nullable().optional(),
  themePreferences: z.object({
    colorMode: z.enum(['dark', 'light']).optional(),
    accentColor: z.string().max(20).nullable().optional(),
    glassMode: z.enum(['off', 'subtle', 'full']).optional(),
    customVars: z.record(z.string(), z.string()).optional(),
  }).nullable().optional(),
  birthday: z.object({
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
  }).nullable().optional(),
  emailNotifications: z.object({
    mentions: z.boolean().optional(),
    dms: z.boolean().optional(),
    frequency: z.enum(['instant', 'daily', 'never']).optional(),
    /** Opt-in: new sign-in from unrecognized device (not verification / password reset) */
    securityAlerts: z.boolean().optional(),
  }).optional(),
  notificationQuietHours: z
    .object({
      enabled: z.boolean(),
      startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      timezone: z.string().max(64).optional(),
      days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    })
    .nullable()
    .optional(),
  // Item 86: DND scheduling
  dndSchedule: z.object({
    enabled: z.boolean(),
    startHour: z.number().int().min(0).max(23),
    startMinute: z.number().int().min(0).max(59),
    endHour: z.number().int().min(0).max(23),
    endMinute: z.number().int().min(0).max(59),
    timezone: z.string().max(50).optional(),
  }).nullable().optional(),
  // Item 91: Auto-collapse long messages
  autoCollapseLongMessages: z.boolean().optional(),
  autoCollapseThreshold: z.number().int().min(5).max(100).optional(),
  // Item 102: Custom profile theme
  profileTheme: z.object({
    primaryColor: z.string().max(20).optional(),
    secondaryColor: z.string().max(20).optional(),
    backgroundImage: z.string().max(500).optional(),
    cardStyle: z.enum(['default', 'glass', 'solid', 'gradient']).optional(),
  }).nullable().optional(),
  // Item 85: Notification grouping
  notificationGrouping: z.boolean().optional(),
}).passthrough();

/** GET /api/v1/users/@me/settings */
settingsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, req.userId!))
      .limit(1);

    res.json(buildUserSettingsResponse(settings));
  } catch (err) {
    logger.error('[settings] GET / error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

/** PATCH /api/v1/users/@me/settings */
settingsRouter.patch(
  '/',
  requireAuth,
  validate(patchSettingsSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body as z.infer<typeof patchSettingsSchema>;
      const data = sanitizePersistedSettingsPatch(body as Record<string, unknown>);

      // Upsert
      const [existing] = await db
        .select()
        .from(userSettings)
        .where(eq(userSettings.userId, req.userId!))
        .limit(1);

      const incomingEmail = body.emailNotifications;
      if (incomingEmail !== undefined) {
        data.emailNotifications = {
          ...mergeEmailNotificationsJson(existing?.emailNotifications),
          ...incomingEmail,
        };
      }

      const incomingQh = body.notificationQuietHours;
      if (incomingQh !== undefined) {
        data.notificationQuietHours = mergeNotificationQuietHoursJson(
          existing?.notificationQuietHours,
          incomingQh,
        );
      }

      if (Object.keys(data).length === 0) {
        res.json(buildUserSettingsResponse(existing));
        return;
      }

      if (existing) {
        const [updated] = await db
          .update(userSettings)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(userSettings.userId, req.userId!))
          .returning();
        res.json(buildUserSettingsResponse(updated));
      } else {
        const insertPayload = { ...data };
        if (insertPayload.emailNotifications !== undefined) {
          insertPayload.emailNotifications = {
            ...DEFAULT_EMAIL_NOTIFICATIONS,
            ...insertPayload.emailNotifications,
          };
        } else {
          insertPayload.emailNotifications = { ...DEFAULT_EMAIL_NOTIFICATIONS };
        }
        const [created] = await db
          .insert(userSettings)
          .values({ userId: req.userId!, ...insertPayload })
          .returning();
        res.json(buildUserSettingsResponse(created));
      }
    } catch (err) {
      logger.error('[settings] PATCH / error:', err);
      res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
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
  try {
    const key = req.query.key as string | undefined;
    if (!key) { res.status(400).json({ code: 'BAD_REQUEST', message: 'key query parameter required' }); return; }
    const raw = await redis.get(`user-notif:${req.userId!}:${key}`);
    if (!raw) { res.json({ key, value: null }); return; }
    const parsed = safeJsonParse(raw, null);
    res.json({ key, value: parsed });
  } catch (err) {
    logger.error('[settings] GET /notif error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
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
