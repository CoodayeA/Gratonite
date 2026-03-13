import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db/index';
import { giveaways, giveawayEntries, giveawayWinners } from '../db/schema/giveaways';
import { memberRoles } from '../db/schema/roles';
import { users } from '../db/schema/users';
import { Permissions } from '../db/schema/roles';
import { requireAuth } from '../middleware/auth';
import { hasPermission } from './roles';

export const giveawaysRouter = Router({ mergeParams: true });

// GET /guilds/:guildId/giveaways
giveawaysRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const guildId = req.params.guildId as string;
    const status = req.query.status as string | undefined;

    let conditions = [eq(giveaways.guildId, guildId)];
    if (status) conditions.push(eq(giveaways.status, status));

    const rows = await db.select({
      id: giveaways.id,
      guildId: giveaways.guildId,
      channelId: giveaways.channelId,
      prize: giveaways.prize,
      description: giveaways.description,
      winnersCount: giveaways.winnersCount,
      endsAt: giveaways.endsAt,
      endedAt: giveaways.endedAt,
      hostId: giveaways.hostId,
      requiredRoleId: giveaways.requiredRoleId,
      status: giveaways.status,
      createdAt: giveaways.createdAt,
      entryCount: sql<number>`(SELECT count(*) FROM giveaway_entries WHERE giveaway_id = ${giveaways.id})::int`,
    })
      .from(giveaways)
      .where(and(...conditions))
      .orderBy(desc(giveaways.createdAt))
      .limit(50);

    res.json(rows);
  } catch (err) {
    logger.error('[giveaways] GET error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// POST /guilds/:guildId/giveaways — create
giveawaysRouter.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const guildId = req.params.guildId as string;
    if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission' });
      return;
    }

    const { channelId, prize, description, winnersCount, endsAt, requiredRoleId } = req.body;
    if (!channelId || !prize || !endsAt) {
      res.status(400).json({ code: 'BAD_REQUEST', message: 'channelId, prize, and endsAt are required' });
      return;
    }

    const [giveaway] = await db.insert(giveaways).values({
      guildId,
      channelId,
      prize,
      description: description || null,
      winnersCount: winnersCount || 1,
      endsAt: new Date(endsAt),
      hostId: req.userId!,
      requiredRoleId: requiredRoleId || null,
    }).returning();

    res.status(201).json(giveaway);
  } catch (err) {
    logger.error('[giveaways] POST error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// POST /guilds/:guildId/giveaways/:id/enter
giveawaysRouter.post('/:id/enter', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const guildId = req.params.guildId as string;
    const id = req.params.id as string;

    const [giveaway] = await db.select().from(giveaways)
      .where(and(eq(giveaways.id, id), eq(giveaways.guildId, guildId), eq(giveaways.status, 'active')))
      .limit(1);

    if (!giveaway) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Giveaway not found or not active' });
      return;
    }

    // Check required role
    if (giveaway.requiredRoleId) {
      const [hasRole] = await db.select().from(memberRoles)
        .where(and(eq(memberRoles.userId, req.userId!), eq(memberRoles.roleId, giveaway.requiredRoleId)))
        .limit(1);
      if (!hasRole) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'You do not have the required role' });
        return;
      }
    }

    const [entry] = await db.insert(giveawayEntries)
      .values({ giveawayId: id, userId: req.userId! })
      .onConflictDoNothing()
      .returning();

    res.status(201).json(entry || { alreadyEntered: true });
  } catch (err) {
    logger.error('[giveaways] POST enter error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// DELETE /guilds/:guildId/giveaways/:id/enter — leave
giveawaysRouter.delete('/:id/enter', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    await db.delete(giveawayEntries)
      .where(and(eq(giveawayEntries.giveawayId, id), eq(giveawayEntries.userId, req.userId!)));
    res.json({ ok: true });
  } catch (err) {
    logger.error('[giveaways] DELETE enter error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// Helper: pick random winners
async function pickWinners(giveawayId: string, count: number): Promise<string[]> {
  const entries = await db.select({ userId: giveawayEntries.userId })
    .from(giveawayEntries)
    .where(eq(giveawayEntries.giveawayId, giveawayId));

  if (entries.length === 0) return [];

  // Shuffle and pick
  const shuffled = entries.sort(() => Math.random() - 0.5);
  const winners = shuffled.slice(0, Math.min(count, shuffled.length));

  for (const w of winners) {
    await db.insert(giveawayWinners).values({ giveawayId, userId: w.userId });
  }

  return winners.map(w => w.userId);
}

// POST /guilds/:guildId/giveaways/:id/end — manually end
giveawaysRouter.post('/:id/end', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const guildId = req.params.guildId as string;
    const id = req.params.id as string;

    if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission' });
      return;
    }

    const [giveaway] = await db.select().from(giveaways)
      .where(and(eq(giveaways.id, id), eq(giveaways.guildId, guildId)))
      .limit(1);

    if (!giveaway) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Giveaway not found' });
      return;
    }

    const winnerIds = await pickWinners(id, giveaway.winnersCount);

    const [ended] = await db.update(giveaways)
      .set({ status: 'ended', endedAt: new Date() })
      .where(eq(giveaways.id, id))
      .returning();

    const winnerUsers = winnerIds.length > 0
      ? await db.select({ id: users.id, username: users.username, displayName: users.displayName })
          .from(users).where(sql`${users.id} IN ${winnerIds}`)
      : [];

    res.json({ ...ended, winners: winnerUsers });
  } catch (err) {
    logger.error('[giveaways] POST end error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// POST /guilds/:guildId/giveaways/:id/reroll
giveawaysRouter.post('/:id/reroll', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const guildId = req.params.guildId as string;
    const id = req.params.id as string;

    if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission' });
      return;
    }

    const [giveaway] = await db.select().from(giveaways)
      .where(and(eq(giveaways.id, id), eq(giveaways.guildId, guildId), eq(giveaways.status, 'ended')))
      .limit(1);

    if (!giveaway) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Ended giveaway not found' });
      return;
    }

    // Clear old winners
    await db.delete(giveawayWinners).where(eq(giveawayWinners.giveawayId, id));
    const winnerIds = await pickWinners(id, giveaway.winnersCount);

    const winnerUsers = winnerIds.length > 0
      ? await db.select({ id: users.id, username: users.username, displayName: users.displayName })
          .from(users).where(sql`${users.id} IN ${winnerIds}`)
      : [];

    res.json({ giveawayId: id, winners: winnerUsers });
  } catch (err) {
    logger.error('[giveaways] POST reroll error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});

// DELETE /guilds/:guildId/giveaways/:id — cancel
giveawaysRouter.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const guildId = req.params.guildId as string;
    const id = req.params.id as string;

    if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission' });
      return;
    }

    const [updated] = await db.update(giveaways)
      .set({ status: 'cancelled' })
      .where(and(eq(giveaways.id, id), eq(giveaways.guildId, guildId)))
      .returning();

    if (!updated) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Giveaway not found' });
      return;
    }
    res.json(updated);
  } catch (err) {
    logger.error('[giveaways] DELETE error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  }
});
