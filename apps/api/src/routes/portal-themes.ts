/**
 * routes/portal-themes.ts — Portal Theme System.
 *
 * Mounted at /api/v1/guilds/:guildId/portal-theme
 *
 * Endpoints:
 *   GET    /                  — Get the resolved portal theme for the current
 *                               user (member override merged over guild default).
 *   GET    /default           — Get the guild owner's default theme.
 *   PUT    /default           — Owner-only: set the guild's default theme.
 *   GET    /me                — Get this member's personal override (or null).
 *   PUT    /me                — Set/replace this member's personal override.
 *   DELETE /me                — Clear this member's personal override.
 *   GET    /presets           — List all named presets for this guild.
 *   POST   /presets           — Owner-only: save a named preset.
 *   DELETE /presets/:presetId — Owner-only: delete a named preset.
 *
 * The theme JSON is validated against a Zod schema before persistence; unknown
 * fields are stripped to keep the column tidy.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and, asc } from 'drizzle-orm';

import { db } from '../db/index';
import { guilds, guildMembers } from '../db/schema/guilds';
import { portalThemePresets } from '../db/schema/portal-theme-presets';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { logger } from '../lib/logger';
import { logAuditEvent, AuditActionTypes, AuditTargetTypes } from '../lib/audit';

export const portalThemesRouter = Router({ mergeParams: true });

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

/**
 * Theme JSON schema. The web client mirrors this in
 * apps/web/src/portal/themes/types.ts. Keep in sync.
 */
const portalThemeSchema = z
  .object({
    version: z.literal(1).optional().default(1),
    vibe: z.enum(['holographic', 'solar-system', 'liquid-lava', 'iso-city']),
    accentColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$|^gradient:#[0-9a-fA-F]{6},#[0-9a-fA-F]{6}$/)
      .default('#00ff88'),
    backgroundStyle: z
      .enum(['deep-space', 'aurora', 'solid', 'animated-grid', 'liquid-blobs', 'custom-image'])
      .default('deep-space'),
    customBackgroundUrl: z.string().url().max(2048).optional().nullable(),
    planetStyle: z
      .enum(['green', 'violet', 'amber', 'azure', 'rose', 'mono', 'custom'])
      .default('green'),
    customPlanetUrl: z.string().url().max(2048).optional().nullable(),
    density: z.enum(['cozy', 'comfortable', 'compact']).default('comfortable'),
    fontPersonality: z.enum(['modern', 'editorial', 'builder', 'playful']).default('modern'),
    animations: z.enum(['on', 'subtle', 'off']).default('on'),
  })
  .strip();

const presetCreateSchema = z.object({
  name: z.string().min(1).max(80).trim(),
  theme: portalThemeSchema,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getGuildOrThrow(guildId: string) {
  const [guild] = await db.select().from(guilds).where(eq(guilds.id, guildId)).limit(1);
  if (!guild) throw new Error('NOT_FOUND');
  return guild;
}

async function getMembershipOrThrow(guildId: string, userId: string) {
  const [m] = await db
    .select()
    .from(guildMembers)
    .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, userId)))
    .limit(1);
  if (!m) throw new Error('FORBIDDEN');
  return m;
}

function handleError(res: Response, err: unknown, where: string) {
  if (err instanceof Error) {
    if (err.message === 'NOT_FOUND') {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Guild not found' });
      return;
    }
    if (err.message === 'FORBIDDEN') {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Forbidden' });
      return;
    }
  }
  logger.error(`[portal-themes] ${where} error:`, err);
  res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
}

// ---------------------------------------------------------------------------
// Resolved theme — what the web client actually renders with
// ---------------------------------------------------------------------------

portalThemesRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params as { guildId: string };
    const userId = req.userId!;
    const guild = await getGuildOrThrow(guildId);
    const member = await getMembershipOrThrow(guildId, userId);

    res.json({
      guildDefault: guild.portalTheme ?? null,
      memberOverride: member.portalThemeOverride ?? null,
      isOwner: guild.ownerId === userId,
    });
  } catch (err) {
    handleError(res, err, 'GET /');
  }
});

// ---------------------------------------------------------------------------
// Guild default (owner-only writes)
// ---------------------------------------------------------------------------

portalThemesRouter.get(
  '/default',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { guildId } = req.params as { guildId: string };
      await getMembershipOrThrow(guildId, req.userId!);
      const guild = await getGuildOrThrow(guildId);
      res.json({ theme: guild.portalTheme ?? null });
    } catch (err) {
      handleError(res, err, 'GET /default');
    }
  },
);

portalThemesRouter.put(
  '/default',
  requireAuth,
  validate(portalThemeSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { guildId } = req.params as { guildId: string };
      const userId = req.userId!;
      const guild = await getGuildOrThrow(guildId);
      if (guild.ownerId !== userId) {
        res
          .status(403)
          .json({ code: 'FORBIDDEN', message: 'Only the guild owner can set the default theme' });
        return;
      }

      const theme = req.body as z.infer<typeof portalThemeSchema>;
      await db
        .update(guilds)
        .set({ portalTheme: theme, updatedAt: new Date() })
        .where(eq(guilds.id, guildId));

      logAuditEvent(
        guildId,
        userId,
        AuditActionTypes.GUILD_UPDATE,
        guildId,
        AuditTargetTypes.GUILD,
        { portalTheme: theme },
        'Updated portal theme default',
      );

      res.json({ theme });
    } catch (err) {
      handleError(res, err, 'PUT /default');
    }
  },
);

// ---------------------------------------------------------------------------
// Member override
// ---------------------------------------------------------------------------

portalThemesRouter.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params as { guildId: string };
    const member = await getMembershipOrThrow(guildId, req.userId!);
    res.json({ theme: member.portalThemeOverride ?? null });
  } catch (err) {
    handleError(res, err, 'GET /me');
  }
});

portalThemesRouter.put(
  '/me',
  requireAuth,
  validate(portalThemeSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { guildId } = req.params as { guildId: string };
      const userId = req.userId!;
      await getMembershipOrThrow(guildId, userId);

      const theme = req.body as z.infer<typeof portalThemeSchema>;
      await db
        .update(guildMembers)
        .set({ portalThemeOverride: theme })
        .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, userId)));

      res.json({ theme });
    } catch (err) {
      handleError(res, err, 'PUT /me');
    }
  },
);

portalThemesRouter.delete(
  '/me',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { guildId } = req.params as { guildId: string };
      const userId = req.userId!;
      await getMembershipOrThrow(guildId, userId);

      await db
        .update(guildMembers)
        .set({ portalThemeOverride: null })
        .where(and(eq(guildMembers.guildId, guildId), eq(guildMembers.userId, userId)));

      res.status(204).send();
    } catch (err) {
      handleError(res, err, 'DELETE /me');
    }
  },
);

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

portalThemesRouter.get(
  '/presets',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { guildId } = req.params as { guildId: string };
      await getMembershipOrThrow(guildId, req.userId!);
      const presets = await db
        .select()
        .from(portalThemePresets)
        .where(eq(portalThemePresets.guildId, guildId))
        .orderBy(asc(portalThemePresets.name));
      res.json({ presets });
    } catch (err) {
      handleError(res, err, 'GET /presets');
    }
  },
);

portalThemesRouter.post(
  '/presets',
  requireAuth,
  validate(presetCreateSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { guildId } = req.params as { guildId: string };
      const userId = req.userId!;
      const guild = await getGuildOrThrow(guildId);
      if (guild.ownerId !== userId) {
        res
          .status(403)
          .json({ code: 'FORBIDDEN', message: 'Only the guild owner can save presets' });
        return;
      }
      const { name, theme } = req.body as z.infer<typeof presetCreateSchema>;
      try {
        const [row] = await db
          .insert(portalThemePresets)
          .values({ guildId, name, theme, createdBy: userId })
          .returning();
        res.status(201).json({ preset: row });
      } catch (e: any) {
        if (typeof e?.message === 'string' && e.message.includes('duplicate')) {
          res
            .status(409)
            .json({ code: 'CONFLICT', message: 'A preset with that name already exists' });
          return;
        }
        throw e;
      }
    } catch (err) {
      handleError(res, err, 'POST /presets');
    }
  },
);

portalThemesRouter.delete(
  '/presets/:presetId',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { guildId, presetId } = req.params as { guildId: string; presetId: string };
      const userId = req.userId!;
      const guild = await getGuildOrThrow(guildId);
      if (guild.ownerId !== userId) {
        res
          .status(403)
          .json({ code: 'FORBIDDEN', message: 'Only the guild owner can delete presets' });
        return;
      }
      await db
        .delete(portalThemePresets)
        .where(
          and(
            eq(portalThemePresets.id, presetId),
            eq(portalThemePresets.guildId, guildId),
          ),
        );
      res.status(204).send();
    } catch (err) {
      handleError(res, err, 'DELETE /presets/:presetId');
    }
  },
);
