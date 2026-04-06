import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { eq, and, desc, sql, gte, isNull, isNotNull } from 'drizzle-orm';
import { db } from '../db/index';
import { requireAuth } from '../middleware/auth';
import { hasPermission } from './roles';
import { Permissions } from '../db/schema/roles';
import { studyRoomSettings, studySessions } from '../db/schema/study-rooms';
import { channels } from '../db/schema/channels';
import { users } from '../db/schema/users';

export const studyRoomsRouter = Router({ mergeParams: true });

// GET /channels/:channelId/study — get room settings
studyRoomsRouter.get('/channels/:channelId/study', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelId } = req.params as Record<string, string>;
    const [settings] = await db.select().from(studyRoomSettings).where(eq(studyRoomSettings.channelId, channelId)).limit(1);
    res.json(settings || { channelId, pomodoroWork: 25, pomodoroBreak: 5, ambientSound: null });
  } catch (err) {
    logger.error('[study-rooms] GET settings error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error'  });
  }
});

// PUT /channels/:channelId/study/settings — update settings
studyRoomsRouter.put('/channels/:channelId/study/settings', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelId } = req.params as Record<string, string>;
    const [channel] = await db.select().from(channels).where(eq(channels.id, channelId)).limit(1);
    if (!channel || !channel.guildId) { res.status(404).json({ code: 'NOT_FOUND', message: 'Channel not found'  }); return; }

    if (!(await hasPermission(req.userId!, channel.guildId, Permissions.MANAGE_CHANNELS))) {
      res.status(403).json({ code: 'FORBIDDEN', message: 'Missing MANAGE_CHANNELS permission'  }); return;
    }

    const { pomodoroWork, pomodoroBreak, ambientSound } = req.body;
    const [row] = await db.insert(studyRoomSettings).values({
      channelId,
      pomodoroWork: pomodoroWork ?? 25,
      pomodoroBreak: pomodoroBreak ?? 5,
      ambientSound: ambientSound ?? null,
    }).onConflictDoUpdate({
      target: studyRoomSettings.channelId,
      set: {
        ...(pomodoroWork !== undefined && { pomodoroWork }),
        ...(pomodoroBreak !== undefined && { pomodoroBreak }),
        ...(ambientSound !== undefined && { ambientSound }),
      },
    }).returning();
    res.json(row);
  } catch (err) {
    logger.error('[study-rooms] PUT settings error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error'  });
  }
});

// POST /channels/:channelId/study/start — start a study session
studyRoomsRouter.post('/channels/:channelId/study/start', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelId } = req.params as Record<string, string>;
    const userId = req.userId!;
    const { sessionType } = req.body;
    const [channel] = await db.select().from(channels).where(eq(channels.id, channelId)).limit(1);
    if (!channel || !channel.guildId) { res.status(404).json({ code: 'NOT_FOUND', message: 'Channel not found'  }); return; }

    // End any existing active session for this user in this channel
    await db.update(studySessions)
      .set({ endedAt: new Date(), duration: sql`EXTRACT(EPOCH FROM now() - ${studySessions.startedAt})::integer` })
      .where(and(eq(studySessions.userId, userId), eq(studySessions.channelId, channelId), isNull(studySessions.endedAt)));

    const [session] = await db.insert(studySessions).values({
      userId,
      guildId: channel.guildId,
      channelId,
      sessionType: sessionType || 'pomodoro',
    }).returning();
    res.json(session);
  } catch (err) {
    logger.error('[study-rooms] POST start error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error'  });
  }
});

// POST /channels/:channelId/study/end — end current session
studyRoomsRouter.post('/channels/:channelId/study/end', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelId } = req.params as Record<string, string>;
    const userId = req.userId!;
    const [session] = await db.update(studySessions)
      .set({ endedAt: new Date(), duration: sql`EXTRACT(EPOCH FROM now() - ${studySessions.startedAt})::integer` })
      .where(and(eq(studySessions.userId, userId), eq(studySessions.channelId, channelId), isNull(studySessions.endedAt)))
      .returning();
    if (!session) { res.status(404).json({ code: 'NOT_FOUND', message: 'No active session found'  }); return; }
    res.json(session);
  } catch (err) {
    logger.error('[study-rooms] POST end error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error'  });
  }
});

// GET /guilds/:guildId/study/stats — get study stats
studyRoomsRouter.get('/guilds/:guildId/study/stats', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params as Record<string, string>;
    const period = (req.query.period as string) || 'week';
    const since = new Date();
    if (period === 'week') since.setDate(since.getDate() - 7);
    else if (period === 'month') since.setMonth(since.getMonth() - 1);
    else since.setFullYear(2000);

    const [totals] = await db.select({
      totalHours: sql<number>`COALESCE(SUM(${studySessions.duration}) / 3600.0, 0)`,
      sessionCount: sql<number>`count(*)::int`,
    }).from(studySessions)
      .where(and(eq(studySessions.guildId, guildId), gte(studySessions.startedAt, since), isNotNull(studySessions.endedAt)));

    const leaderboard = await db.select({
      userId: studySessions.userId,
      username: users.username,
      displayName: users.displayName,
      totalHours: sql<number>`COALESCE(SUM(${studySessions.duration}) / 3600.0, 0)`,
    }).from(studySessions)
      .innerJoin(users, eq(studySessions.userId, users.id))
      .where(and(eq(studySessions.guildId, guildId), gte(studySessions.startedAt, since), isNotNull(studySessions.endedAt)))
      .groupBy(studySessions.userId, users.username, users.displayName)
      .orderBy(desc(sql`SUM(${studySessions.duration})`))
      .limit(10);

    res.json({ totalHours: Number(totals?.totalHours ?? 0), sessionCount: Number(totals?.sessionCount ?? 0), leaderboard });
  } catch (err) {
    logger.error('[study-rooms] GET stats error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error'  });
  }
});

// GET /guilds/:guildId/study/leaderboard — weekly leaderboard
studyRoomsRouter.get('/guilds/:guildId/study/leaderboard', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { guildId } = req.params as Record<string, string>;
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const leaderboard = await db.select({
      userId: studySessions.userId,
      username: users.username,
      displayName: users.displayName,
      totalHours: sql<number>`COALESCE(SUM(${studySessions.duration}) / 3600.0, 0)`,
      sessionCount: sql<number>`count(*)::int`,
    }).from(studySessions)
      .innerJoin(users, eq(studySessions.userId, users.id))
      .where(and(eq(studySessions.guildId, guildId), gte(studySessions.startedAt, weekAgo), isNotNull(studySessions.endedAt)))
      .groupBy(studySessions.userId, users.username, users.displayName)
      .orderBy(desc(sql`SUM(${studySessions.duration})`))
      .limit(20);

    res.json(leaderboard);
  } catch (err) {
    logger.error('[study-rooms] GET leaderboard error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error'  });
  }
});
