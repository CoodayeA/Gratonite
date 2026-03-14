/**
 * routes/standup.ts — Daily standup bot with prompts and summaries.
 * Mounted at /guilds/:guildId/standup
 */
import { Router, Request, Response } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/index';
import { standupConfigs, standupResponses } from '../db/schema/standup';
import { users } from '../db/schema/users';
import { requireAuth } from '../middleware/auth';
import { hasPermission } from './roles';
import { Permissions } from '../db/schema/roles';

export const standupRouter = Router({ mergeParams: true });

function todayStr() { return new Date().toISOString().slice(0, 10); }

// GET /guilds/:guildId/standup/config — get standup config
standupRouter.get('/config', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;
  const [config] = await db.select().from(standupConfigs)
    .where(eq(standupConfigs.guildId, guildId)).limit(1);
  res.json(config || null);
});

// POST /guilds/:guildId/standup/config — create or update config
standupRouter.post('/config', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;
  if (!(await hasPermission(req.userId!, guildId, Permissions.MANAGE_GUILD))) {
    res.status(403).json({ code: 'FORBIDDEN' }); return;
  }

  const { channelId, schedule, timezone, questions, enabled } = req.body;
  if (!channelId) { res.status(400).json({ code: 'BAD_REQUEST', message: 'channelId required' }); return; }

  const [existing] = await db.select().from(standupConfigs)
    .where(eq(standupConfigs.guildId, guildId)).limit(1);

  if (existing) {
    const updates: Record<string, unknown> = {};
    if (channelId !== undefined) updates.channelId = channelId;
    if (schedule !== undefined) updates.schedule = schedule;
    if (timezone !== undefined) updates.timezone = timezone;
    if (questions !== undefined) updates.questions = questions;
    if (enabled !== undefined) updates.enabled = enabled;

    const [updated] = await db.update(standupConfigs).set(updates)
      .where(eq(standupConfigs.id, existing.id)).returning();
    res.json(updated);
  } else {
    const [created] = await db.insert(standupConfigs).values({
      guildId,
      channelId,
      schedule: schedule || '09:00',
      timezone: timezone || 'UTC',
      questions: questions || ['What did you do yesterday?', 'What will you do today?', 'Any blockers?'],
      enabled: enabled !== false,
      createdBy: req.userId!,
    }).returning();
    res.status(201).json(created);
  }
});

// POST /guilds/:guildId/standup/respond — submit standup response
standupRouter.post('/respond', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;
  const { answers } = req.body;
  if (!Array.isArray(answers)) { res.status(400).json({ code: 'BAD_REQUEST', message: 'answers array required' }); return; }

  const [config] = await db.select().from(standupConfigs)
    .where(eq(standupConfigs.guildId, guildId)).limit(1);
  if (!config) { res.status(404).json({ code: 'NOT_FOUND', message: 'No standup configured' }); return; }

  const date = todayStr();

  // Check if already responded today
  const [existing] = await db.select().from(standupResponses)
    .where(and(eq(standupResponses.configId, config.id), eq(standupResponses.userId, req.userId!), eq(standupResponses.date, date)))
    .limit(1);

  if (existing) {
    const [updated] = await db.update(standupResponses).set({ answers })
      .where(eq(standupResponses.id, existing.id)).returning();
    res.json(updated);
  } else {
    const [created] = await db.insert(standupResponses).values({
      configId: config.id,
      userId: req.userId!,
      date,
      answers,
    }).returning();
    res.status(201).json(created);
  }
});

// GET /guilds/:guildId/standup/summary — get today's summary
standupRouter.get('/summary', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;
  const date = (req.query.date as string) || todayStr();

  const [config] = await db.select().from(standupConfigs)
    .where(eq(standupConfigs.guildId, guildId)).limit(1);
  if (!config) { res.json({ responses: [], questions: [] }); return; }

  const responses = await db.select({
    id: standupResponses.id,
    userId: standupResponses.userId,
    answers: standupResponses.answers,
    createdAt: standupResponses.createdAt,
    username: users.username,
    displayName: users.displayName,
    avatarHash: users.avatarHash,
  }).from(standupResponses)
    .innerJoin(users, eq(users.id, standupResponses.userId))
    .where(and(eq(standupResponses.configId, config.id), eq(standupResponses.date, date)));

  res.json({ questions: config.questions, responses, date });
});
