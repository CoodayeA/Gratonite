import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/index';
import { userSettings } from '../db/schema/settings';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';

export const settingsRouter = Router();

const patchSettingsSchema = z.object({
  theme: z.string().max(50).optional(),
  colorMode: z.enum(['dark', 'light']).optional(),
  fontFamily: z.string().max(50).optional(),
  fontSize: z.number().int().min(10).max(24).optional(),
  glassMode: z.boolean().optional(),
  buttonShape: z.enum(['rounded', 'pill', 'square']).optional(),
  soundMuted: z.boolean().optional(),
  soundVolume: z.number().int().min(0).max(100).optional(),
  soundPack: z.string().max(50).optional(),
  reducedMotion: z.boolean().optional(),
  highContrast: z.boolean().optional(),
  compactMode: z.boolean().optional(),
  accentColor: z.string().max(20).nullable().optional(),
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
      glassMode: false,
      buttonShape: 'rounded',
      soundMuted: false,
      soundVolume: 50,
      soundPack: 'default',
      reducedMotion: false,
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
