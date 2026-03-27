/**
 * routes/spam-detection.ts — Guild spam detection configuration (item 93)
 * Mounted at /api/v1/guilds/:guildId/spam-config
 */
import { Router, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index';
import { guildSpamConfig } from '../db/schema/guild-spam-config';
import { Permissions } from '../db/schema/roles';
import { requireAuth } from '../middleware/auth';
import { hasPermission } from './roles';
import { normalizeError } from '../lib/errors';

export const spamDetectionRouter = Router({ mergeParams: true });

/** GET / — Get spam config */
spamDetectionRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;
  if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission' }); return;
  }

  try {
    const [config] = await db.select().from(guildSpamConfig).where(eq(guildSpamConfig.guildId, guildId)).limit(1);
    res.json(config || {
      guildId, enabled: false, maxDuplicateMessages: 5, duplicateWindowSeconds: 10,
      maxMentionsPerMessage: 10, maxLinksPerMessage: 5, rapidJoinThreshold: 10,
      rapidJoinWindowSeconds: 30, action: 'flag', exemptRoles: [],
    });
  } catch (err) {
    const normalized = normalizeError(err);
    if (normalized.code === 'FEATURE_UNAVAILABLE') {
      res.json({
        guildId, enabled: false, maxDuplicateMessages: 5, duplicateWindowSeconds: 10,
        maxMentionsPerMessage: 10, maxLinksPerMessage: 5, rapidJoinThreshold: 10,
        rapidJoinWindowSeconds: 30, action: 'flag', exemptRoles: [],
      });
      return;
    }
    throw err;
  }
});

/** PUT / — Update spam config */
spamDetectionRouter.put('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;
  if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission' }); return;
  }

  const { enabled, maxDuplicateMessages, duplicateWindowSeconds, maxMentionsPerMessage,
    maxLinksPerMessage, rapidJoinThreshold, rapidJoinWindowSeconds, action, exemptRoles } = req.body;

  const validAction = ['flag', 'mute', 'kick'].includes(action) ? action : 'flag';

  const [upserted] = await db.insert(guildSpamConfig)
    .values({
      guildId, enabled: !!enabled,
      maxDuplicateMessages: maxDuplicateMessages ?? 5,
      duplicateWindowSeconds: duplicateWindowSeconds ?? 10,
      maxMentionsPerMessage: maxMentionsPerMessage ?? 10,
      maxLinksPerMessage: maxLinksPerMessage ?? 5,
      rapidJoinThreshold: rapidJoinThreshold ?? 10,
      rapidJoinWindowSeconds: rapidJoinWindowSeconds ?? 30,
      action: validAction,
      exemptRoles: Array.isArray(exemptRoles) ? exemptRoles : [],
    })
    .onConflictDoUpdate({
      target: guildSpamConfig.guildId,
      set: {
        enabled: !!enabled,
        maxDuplicateMessages: maxDuplicateMessages ?? 5,
        duplicateWindowSeconds: duplicateWindowSeconds ?? 10,
        maxMentionsPerMessage: maxMentionsPerMessage ?? 10,
        maxLinksPerMessage: maxLinksPerMessage ?? 5,
        rapidJoinThreshold: rapidJoinThreshold ?? 10,
        rapidJoinWindowSeconds: rapidJoinWindowSeconds ?? 30,
        action: validAction,
        exemptRoles: Array.isArray(exemptRoles) ? exemptRoles : [],
        updatedAt: new Date(),
      },
    })
    .returning();

  res.json(upserted);
});
