import { Router, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index';
import { guildWordFilters } from '../db/schema/guild-word-filters';
import { Permissions } from '../db/schema/roles';
import { requireAuth } from '../middleware/auth';
import { hasPermission } from './roles';
import { logger } from '../lib/logger';

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

  const { words, action, exemptRoles, regexPatterns } = req.body as {
    words: string[];
    action: 'block' | 'delete' | 'warn';
    exemptRoles: string[];
    regexPatterns?: string[];
  };

  if (!Array.isArray(words) || !['block', 'delete', 'warn'].includes(action)) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'Invalid body' });
    return;
  }

  const sanitizedWords = words.map(w => String(w).trim()).filter(Boolean);
  const sanitizedExemptRoles = Array.isArray(exemptRoles) ? exemptRoles.filter(r => typeof r === 'string') : [];

  // Validate regex patterns (item 92)
  const sanitizedRegex: string[] = [];
  if (Array.isArray(regexPatterns)) {
    if (regexPatterns.length > 100) {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Too many regex patterns (max 100)' }); return;
    }
    for (const pat of regexPatterns) {
      try {
        new RegExp(pat); // validate
        sanitizedRegex.push(pat);
      } catch (err) {
        logger.debug({ msg: 'skipping invalid regex pattern', pattern: pat, err });
      }
    }
  }

  const [upserted] = await db
    .insert(guildWordFilters)
    .values({
      guildId,
      words: sanitizedWords,
      action,
      exemptRoles: sanitizedExemptRoles,
      regexPatterns: sanitizedRegex,
    })
    .onConflictDoUpdate({
      target: guildWordFilters.guildId,
      set: {
        words: sanitizedWords,
        action,
        exemptRoles: sanitizedExemptRoles,
        regexPatterns: sanitizedRegex,
        updatedAt: new Date(),
      },
    })
    .returning();

  res.json(upserted);
});

/** POST /api/v1/guilds/:guildId/word-filter/test — Test a regex pattern against sample text (item 92) */
wordFilterRouter.post('/test', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { guildId } = req.params as Record<string, string>;

  if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
    res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission' });
    return;
  }

  const { pattern, testText } = req.body as { pattern: string; testText: string };
  if (!pattern || !testText) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'pattern and testText required' });
    return;
  }

  // Guard against ReDoS: limit pattern and text length
  if (pattern.length > 200) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'Pattern too long (max 200 chars)' });
    return;
  }
  if (testText.length > 500) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'Test text too long (max 500 chars)' });
    return;
  }

  try {
    const re = new RegExp(pattern, 'gi');
    // Run with a time guard to prevent catastrophic backtracking
    const startTime = Date.now();
    const matches: { match: string; index: number | undefined }[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(testText)) !== null) {
      matches.push({ match: m[0], index: m.index });
      if (Date.now() - startTime > 100) {
        res.json({ valid: false, error: 'Pattern too complex (timed out)', matches: [], matchCount: 0 });
        return;
      }
      // Prevent infinite loops on zero-length matches
      if (m[0].length === 0) re.lastIndex++;
    }
    res.json({ valid: true, matches, matchCount: matches.length });
  } catch (err: any) {
    res.json({ valid: false, error: err?.message || 'Invalid regex', matches: [], matchCount: 0 });
  }
});
