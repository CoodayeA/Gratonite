import { Router, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index';
import { userVoiceSettings } from '../db/schema/voice-effects';
import { requireAuth } from '../middleware/auth';

export const voiceEffectsRouter = Router({ mergeParams: true });

const EFFECTS = [
  { id: 'robot', name: 'Robot', description: 'Metallic vocoder sound' },
  { id: 'deep', name: 'Deep', description: 'Pitch down for a deeper voice' },
  { id: 'helium', name: 'Helium', description: 'Pitch up for a squeaky voice' },
  { id: 'echo', name: 'Echo', description: 'Delay effect with repeating tails' },
  { id: 'reverb', name: 'Reverb', description: 'Hall reverb for spacious sound' },
  { id: 'whisper', name: 'Whisper', description: 'Soft breathy whisper effect' },
  { id: 'radio', name: 'Radio', description: 'Band-pass filter for a radio sound' },
];

const VALID_EFFECTS = EFFECTS.map(e => e.id);

/** GET /voice/effects — list available effects */
voiceEffectsRouter.get('/voice/effects', requireAuth, async (_req: Request, res: Response): Promise<void> => {
  res.json(EFFECTS);
});

/** GET /users/@me/voice-settings — get my voice settings */
voiceEffectsRouter.get('/users/@me/voice-settings', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const [settings] = await db.select().from(userVoiceSettings)
    .where(eq(userVoiceSettings.userId, req.userId!)).limit(1);

  res.json(settings || { userId: req.userId!, activeEffect: null, effectVolume: 100 });
});

/** PUT /users/@me/voice-settings — set active effect */
voiceEffectsRouter.put('/users/@me/voice-settings', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { activeEffect, effectVolume } = req.body;

  if (activeEffect !== null && activeEffect !== undefined && !VALID_EFFECTS.includes(activeEffect)) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'Invalid effect' }); return;
  }

  const volume = effectVolume !== undefined ? Math.max(0, Math.min(100, Number(effectVolume))) : 100;

  const [row] = await db.insert(userVoiceSettings).values({
    userId: req.userId!,
    activeEffect: activeEffect ?? null,
    effectVolume: volume,
  }).onConflictDoUpdate({
    target: userVoiceSettings.userId,
    set: { activeEffect: activeEffect ?? null, effectVolume: volume },
  }).returning();

  res.json(row);
});
