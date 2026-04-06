import { Router, Request, Response } from 'express';
import { eq, and, desc, sql, isNull, isNotNull } from 'drizzle-orm';
import { db } from '../db/index';
import { requireAuth } from '../middleware/auth';
import { logger } from '../lib/logger';
import { hasPermission } from './roles';
import { Permissions } from '../db/schema/roles';
import { guildQuests, guildQuestContributions } from '../db/schema/guild-quests';
import { users } from '../db/schema/users';

export const guildQuestsRouter = Router({ mergeParams: true });

// GET /guilds/:guildId/quests — list quests
guildQuestsRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params as Record<string, string>;
    const status = (req.query.status as string) || 'active';

    let condition;
    if (status === 'active') {
      condition = and(eq(guildQuests.guildId, guildId), isNull(guildQuests.completedAt));
    } else if (status === 'completed') {
      condition = and(eq(guildQuests.guildId, guildId), isNotNull(guildQuests.completedAt));
    } else {
      condition = eq(guildQuests.guildId, guildId);
    }

    const quests = await db.select().from(guildQuests).where(condition).orderBy(desc(guildQuests.createdAt));
    res.json(quests);
  } catch (err) {
    logger.error('[guild-quests] GET error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error'  });
  }
});

// POST /guilds/:guildId/quests — create quest
guildQuestsRouter.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params as Record<string, string>;
    if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission'  }); return;
    }

    const { title, description, questType, targetValue, reward, endDate, recurring } = req.body;
    if (!title || !targetValue || !endDate) {
      res.status(400).json({ code: 'BAD_REQUEST', message: 'title, targetValue, and endDate are required'  }); return;
    }

    const [quest] = await db.insert(guildQuests).values({
      guildId,
      title,
      description: description || null,
      questType: questType || 'messages',
      targetValue,
      reward: reward || { coins: 100 },
      endDate: new Date(endDate),
      recurring: recurring || false,
    }).returning();
    res.status(201).json(quest);
  } catch (err) {
    logger.error('[guild-quests] POST error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error'  });
  }
});

// PATCH /guilds/:guildId/quests/:id — update quest
guildQuestsRouter.patch('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId, id } = req.params as Record<string, string>;
    if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission'  }); return;
    }

    const updates: Record<string, unknown> = {};
    const { title, description, questType, targetValue, reward, endDate, recurring } = req.body;
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (questType !== undefined) updates.questType = questType;
    if (targetValue !== undefined) updates.targetValue = targetValue;
    if (reward !== undefined) updates.reward = reward;
    if (endDate !== undefined) updates.endDate = new Date(endDate);
    if (recurring !== undefined) updates.recurring = recurring;

    const [quest] = await db.update(guildQuests).set(updates).where(and(eq(guildQuests.id, id), eq(guildQuests.guildId, guildId))).returning();
    if (!quest) { res.status(404).json({ code: 'NOT_FOUND', message: 'Quest not found'  }); return; }
    res.json(quest);
  } catch (err) {
    logger.error('[guild-quests] PATCH error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error'  });
  }
});

// DELETE /guilds/:guildId/quests/:id — delete quest
guildQuestsRouter.delete('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId, id } = req.params as Record<string, string>;
    if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_GUILD permission'  }); return;
    }

    const [deleted] = await db.delete(guildQuests).where(and(eq(guildQuests.id, id), eq(guildQuests.guildId, guildId))).returning();
    if (!deleted) { res.status(404).json({ code: 'NOT_FOUND', message: 'Quest not found'  }); return; }
    res.json({ success: true });
  } catch (err) {
    logger.error('[guild-quests] DELETE error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error'  });
  }
});

// POST /guilds/:guildId/quests/:id/contribute — add contribution
guildQuestsRouter.post('/:id/contribute', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId, id } = req.params as Record<string, string>;
    const userId = req.userId!;
    const value = Number(req.body.value) || 1;

    const [quest] = await db.select().from(guildQuests).where(and(eq(guildQuests.id, id), eq(guildQuests.guildId, guildId))).limit(1);
    if (!quest) { res.status(404).json({ code: 'NOT_FOUND', message: 'Quest not found'  }); return; }
    if (quest.completedAt) { res.status(400).json({ code: 'BAD_REQUEST', message: 'Quest already completed'  }); return; }

    await db.insert(guildQuestContributions).values({ questId: id, userId, contributionValue: value });

    const newValue = Math.min(quest.currentValue + value, quest.targetValue);
    const isCompleted = newValue >= quest.targetValue;

    const [updated] = await db.update(guildQuests).set({
      currentValue: newValue,
      ...(isCompleted && { completedAt: new Date() }),
    }).where(eq(guildQuests.id, id)).returning();

    res.json(updated);
  } catch (err) {
    logger.error('[guild-quests] POST contribute error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error'  });
  }
});

// GET /guilds/:guildId/quests/:id/contributions — contribution breakdown
guildQuestsRouter.get('/:id/contributions', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params as Record<string, string>;

    const contributions = await db.select({
      userId: guildQuestContributions.userId,
      username: users.username,
      displayName: users.displayName,
      total: sql<number>`SUM(${guildQuestContributions.contributionValue})::int`,
    }).from(guildQuestContributions)
      .innerJoin(users, eq(guildQuestContributions.userId, users.id))
      .where(eq(guildQuestContributions.questId, id))
      .groupBy(guildQuestContributions.userId, users.username, users.displayName)
      .orderBy(desc(sql`SUM(${guildQuestContributions.contributionValue})`));

    res.json(contributions);
  } catch (err) {
    logger.error('[guild-quests] GET contributions error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error'  });
  }
});
