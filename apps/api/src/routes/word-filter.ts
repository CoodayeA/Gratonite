import { Router, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index';
import { guildWordFilters } from '../db/schema/guild-word-filters';
import { Permissions } from '../db/schema/roles';
import { requireAuth } from '../middleware/auth';
import { hasPermission } from './roles';

export const wordFilterRouter = Router({ mergeParams: true });

/** GET /api/v1/guilds/:guildId/word-filter */
wordFilterRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId } = req.params as Record<string, string>;

  if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission' });
    return;
  }

  const [filter] = await db
    .select()
    .from(guildWordFilters)
    .where(eq(guildWordFilters.guildId, guildId))
    .limit(1);

  if (!filter) {
    res.json({ words: [], action: 'block', exemptRoles: [] });
    return;
  }

  res.json(filter);
});

/** PUT /api/v1/guilds/:guildId/word-filter */
wordFilterRouter.put('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId } = req.params as Record<string, string>;

  if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission' });
    return;
  }

  const { words, action, exemptRoles } = req.body as {
    words: string[];
    action: 'block' | 'delete' | 'warn';
    exemptRoles: string[];
  };

  if (!Array.isArray(words) || !['block', 'delete', 'warn'].includes(action)) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'Invalid body' });
    return;
  }

  const sanitizedWords = words.map(w => String(w).trim()).filter(Boolean);
  const sanitizedExemptRoles = Array.isArray(exemptRoles) ? exemptRoles.filter(r => typeof r === 'string') : [];

  const [upserted] = await db
    .insert(guildWordFilters)
    .values({
      guildId,
      words: sanitizedWords,
      action,
      exemptRoles: sanitizedExemptRoles,
    })
    .onConflictDoUpdate({
      target: guildWordFilters.guildId,
      set: {
        words: sanitizedWords,
        action,
        exemptRoles: sanitizedExemptRoles,
        updatedAt: new Date(),
      },
    })
    .returning();

  res.json(upserted);
});
