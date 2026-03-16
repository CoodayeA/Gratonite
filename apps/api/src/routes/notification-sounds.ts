import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { eq, and, or, isNull } from 'drizzle-orm';
import { db } from '../db/index';
import { notificationSounds, notificationSoundPrefs } from '../db/schema/notification-sounds';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { z } from 'zod';

export const notificationSoundsRouter = Router();

const createSoundSchema = z.object({
  name: z.string().min(1).max(100),
  fileHash: z.string().min(1).max(255),
  duration: z.number().min(0).max(5.0),
  guildId: z.string().uuid().optional(),
});

const setPrefSchema = z.object({
  guildId: z.string().uuid().nullable().optional(),
  eventType: z.enum(['message', 'mention', 'dm', 'join', 'leave', 'call']),
  soundId: z.string().uuid().nullable(),
});

// GET /notification-sounds — list built-in + user's custom sounds
notificationSoundsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const sounds = await db.select()
      .from(notificationSounds)
      .where(
        or(
          eq(notificationSounds.isBuiltIn, true),
          eq(notificationSounds.uploadedBy, req.userId!),
        )
      );

    res.json(sounds);
  } catch (err) {
    logger.error('[notification-sounds] GET error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// POST /notification-sounds — upload custom sound
notificationSoundsRouter.post('/', requireAuth, validate(createSoundSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, fileHash, duration, guildId } = req.body;

    const [sound] = await db.insert(notificationSounds)
      .values({
        name,
        fileHash,
        duration,
        isBuiltIn: false,
        uploadedBy: req.userId!,
        guildId: guildId || null,
      })
      .returning();

    res.status(201).json(sound);
  } catch (err) {
    logger.error('[notification-sounds] POST error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// DELETE /notification-sounds/:soundId — delete custom sound (owner only)
notificationSoundsRouter.delete('/:soundId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const soundId = req.params.soundId as string;

    const [deleted] = await db.delete(notificationSounds)
      .where(and(
        eq(notificationSounds.id, soundId),
        eq(notificationSounds.uploadedBy, req.userId!),
        eq(notificationSounds.isBuiltIn, false),
      ))
      .returning();

    if (!deleted) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Sound not found or not owned by you' });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    logger.error('[notification-sounds] DELETE error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// GET /notification-sounds/prefs — get user's sound preferences
notificationSoundsRouter.get('/prefs', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const prefs = await db.select()
      .from(notificationSoundPrefs)
      .where(eq(notificationSoundPrefs.userId, req.userId!));

    res.json(prefs);
  } catch (err) {
    logger.error('[notification-sounds] GET prefs error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// PUT /notification-sounds/prefs — set preference
notificationSoundsRouter.put('/prefs', requireAuth, validate(setPrefSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId, eventType, soundId } = req.body;

    const [pref] = await db.insert(notificationSoundPrefs)
      .values({
        userId: req.userId!,
        guildId: guildId || null,
        eventType,
        soundId,
      })
      .onConflictDoUpdate({
        target: [notificationSoundPrefs.userId, notificationSoundPrefs.guildId, notificationSoundPrefs.eventType],
        set: { soundId },
      })
      .returning();

    res.json(pref);
  } catch (err) {
    logger.error('[notification-sounds] PUT prefs error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});
