import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { eq, and, asc } from 'drizzle-orm';
import { db } from '../db/index';
import { guildOnboardingSteps, guildOnboardingCompletions } from '../db/schema/onboarding-completions';
import { Permissions } from '../db/schema/roles';
import { requireAuth } from '../middleware/auth';
import { hasPermission } from './roles';

export const onboardingRouter = Router({ mergeParams: true });

// GET /guilds/:guildId/onboarding/config
onboardingRouter.get('/config', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const guildId = req.params.guildId as string;
    const steps = await db.select()
      .from(guildOnboardingSteps)
      .where(eq(guildOnboardingSteps.guildId, guildId))
      .orderBy(asc(guildOnboardingSteps.displayOrder));

    res.json({ guildId, steps });
  } catch (err) {
    logger.error('[onboarding] GET config error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// PUT /guilds/:guildId/onboarding/config
onboardingRouter.put('/config', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const guildId = req.params.guildId as string;
    if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission' });
      return;
    }

    const { steps } = req.body as {
      steps: Array<{ stepType: string; title: string; description?: string; options?: unknown; displayOrder?: number }>;
    };

    if (!Array.isArray(steps)) {
      res.status(400).json({ code: 'BAD_REQUEST', message: 'steps must be an array' });
      return;
    }

    // Replace all steps: delete existing, insert new
    await db.delete(guildOnboardingSteps).where(eq(guildOnboardingSteps.guildId, guildId));

    if (steps.length > 0) {
      await db.insert(guildOnboardingSteps).values(
        steps.map((s, i) => ({
          guildId,
          stepType: s.stepType,
          title: s.title,
          description: s.description || null,
          options: s.options || [],
          displayOrder: s.displayOrder ?? i,
        }))
      );
    }

    const saved = await db.select()
      .from(guildOnboardingSteps)
      .where(eq(guildOnboardingSteps.guildId, guildId))
      .orderBy(asc(guildOnboardingSteps.displayOrder));

    res.json({ guildId, steps: saved });
  } catch (err) {
    logger.error('[onboarding] PUT config error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// POST /guilds/:guildId/onboarding/complete
onboardingRouter.post('/complete', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const guildId = req.params.guildId as string;
    const { selections } = req.body as { selections?: Record<string, unknown> };

    const [completion] = await db.insert(guildOnboardingCompletions)
      .values({
        guildId,
        userId: req.userId!,
        selections: selections || {},
      })
      .onConflictDoUpdate({
        target: [guildOnboardingCompletions.guildId, guildOnboardingCompletions.userId],
        set: { completedAt: new Date(), selections: selections || {} },
      })
      .returning();

    res.status(201).json(completion);
  } catch (err) {
    logger.error('[onboarding] POST complete error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// GET /guilds/:guildId/onboarding/status
onboardingRouter.get('/status', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const guildId = req.params.guildId as string;
    const [completion] = await db.select()
      .from(guildOnboardingCompletions)
      .where(and(eq(guildOnboardingCompletions.guildId, guildId), eq(guildOnboardingCompletions.userId, req.userId!)))
      .limit(1);

    res.json({ completed: !!completion, completion: completion || null });
  } catch (err) {
    logger.error('[onboarding] GET status error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});
