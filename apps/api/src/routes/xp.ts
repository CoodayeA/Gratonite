/**
 * routes/xp.ts — XP & leveling system routes.
 * Mounted at /
 */
import { Router, Request, Response } from 'express';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db/index';
import { users } from '../db/schema/users';
import { guildXp, levelRoles } from '../db/schema/xp-system';
import { guildMembers } from '../db/schema/guilds';
import { requireAuth } from '../middleware/auth';
import { logger } from '../lib/logger';

export const xpRouter = Router();

/** XP required to reach a given level: level^2 * 100 */
function xpForLevel(level: number): number {
  return level * level * 100;
}

/** Calculate level from XP */
function levelFromXp(xp: number): number {
  return Math.max(1, Math.floor(Math.sqrt(xp / 100)));
}

// GET /users/@me/xp — get current user's global XP info
xpRouter.get('/users/@me/xp', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const [user] = await db.select({ xp: users.xp, level: users.level }).from(users)
    .where(eq(users.id, req.userId!)).limit(1);

  if (!user) { res.status(404).json({ code: 'NOT_FOUND' }); return; }

  const currentLevel = user.level;
  const nextLevelXp = xpForLevel(currentLevel + 1);
  const currentLevelXp = xpForLevel(currentLevel);

  res.json({
    xp: user.xp,
    level: currentLevel,
    xpForCurrentLevel: currentLevelXp,
    xpForNextLevel: nextLevelXp,
    progress: Math.min(1, (user.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)),
  });
});

// GET /guilds/:guildId/xp/leaderboard — guild XP leaderboard
xpRouter.get('/guilds/:guildId/xp/leaderboard', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;

  const rows = await db.select({
    userId: guildXp.userId,
    xp: guildXp.xp,
    level: guildXp.level,
    username: users.username,
    displayName: users.displayName,
    avatarHash: users.avatarHash,
  }).from(guildXp)
    .innerJoin(users, eq(users.id, guildXp.userId))
    .where(eq(guildXp.guildId, guildId))
    .orderBy(desc(guildXp.xp))
    .limit(50);

  res.json(rows.map((r, i) => ({ rank: i + 1, ...r })));
});

// GET /guilds/:guildId/xp/@me — my XP in a guild
xpRouter.get('/guilds/:guildId/xp/@me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;

  const [row] = await db.select().from(guildXp)
    .where(and(eq(guildXp.guildId, guildId), eq(guildXp.userId, req.userId!))).limit(1);

  if (!row) {
    res.json({ xp: 0, level: 1, progress: 0 });
    return;
  }

  const nextLevelXp = xpForLevel(row.level + 1);
  const currentLevelXp = xpForLevel(row.level);

  res.json({
    xp: row.xp,
    level: row.level,
    progress: Math.min(1, (row.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)),
  });
});

/** Internal: award XP to a user (called from message handler, etc.) */
export async function awardXp(userId: string, guildId: string | null, amount: number): Promise<void> {
  try {
    // Global XP
    const [user] = await db.select({ xp: users.xp, level: users.level }).from(users)
      .where(eq(users.id, userId)).limit(1);
    if (!user) return;

    const newXp = user.xp + amount;
    const newLevel = levelFromXp(newXp);

    await db.update(users).set({ xp: newXp, level: newLevel })
      .where(eq(users.id, userId));

    // Guild XP
    if (guildId) {
      const [gxp] = await db.select().from(guildXp)
        .where(and(eq(guildXp.guildId, guildId), eq(guildXp.userId, userId))).limit(1);

      if (gxp) {
        const gNewXp = gxp.xp + amount;
        const gNewLevel = levelFromXp(gNewXp);
        await db.update(guildXp).set({ xp: gNewXp, level: gNewLevel, updatedAt: new Date() })
          .where(eq(guildXp.id, gxp.id));
      } else {
        await db.insert(guildXp).values({
          guildId,
          userId,
          xp: amount,
          level: levelFromXp(amount),
        });
      }
    }
  } catch (err) {
    logger.error('[xp] awardXp error:', err);
  }
}
