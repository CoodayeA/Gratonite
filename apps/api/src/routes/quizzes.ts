/**
 * routes/quizzes.ts — User-created quizzes.
 * Mounted at /guilds/:guildId/quizzes
 */
import { Router, Request, Response } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/index';
import { quizzes, quizAttempts } from '../db/schema/quizzes';
import { users } from '../db/schema/users';
import { guildMembers } from '../db/schema/guilds';
import { requireAuth } from '../middleware/auth';

export const quizzesRouter = Router({ mergeParams: true });

// GET /guilds/:guildId/quizzes — list quizzes
quizzesRouter.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;

  const rows = await db.select({
    id: quizzes.id,
    title: quizzes.title,
    description: quizzes.description,
    questionCount: quizzes.questions,
    timeLimit: quizzes.timeLimit,
    createdBy: quizzes.createdBy,
    createdAt: quizzes.createdAt,
    authorName: users.displayName,
  }).from(quizzes)
    .leftJoin(users, eq(users.id, quizzes.createdBy))
    .where(eq(quizzes.guildId, guildId))
    .orderBy(desc(quizzes.createdAt));

  res.json(rows.map(r => ({
    ...r,
    questionCount: Array.isArray(r.questionCount) ? (r.questionCount as unknown[]).length : 0,
  })));
});

// POST /guilds/:guildId/quizzes — create quiz
quizzesRouter.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const guildId = req.params.guildId as string;
  const { title, description, questions, timeLimit } = req.body;

  if (!title || !Array.isArray(questions) || questions.length === 0) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'title and questions array required' }); return;
  }

  const [quiz] = await db.insert(quizzes).values({
    guildId,
    title: String(title).slice(0, 200),
    description: description || null,
    questions,
    timeLimit: timeLimit || null,
    createdBy: req.userId!,
  }).returning();

  res.status(201).json(quiz);
});

// GET /guilds/:guildId/quizzes/:quizId — get quiz (without answers for non-creator)
quizzesRouter.get('/:quizId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { quizId } = req.params as Record<string, string>;

  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1);
  if (!quiz) { res.status(404).json({ code: 'NOT_FOUND' }); return; }

  const isCreator = quiz.createdBy === req.userId;
  const questions = (quiz.questions as Array<{ question: string; options: string[]; correctIndex: number }>);

  res.json({
    ...quiz,
    questions: questions.map(q => isCreator ? q : { question: q.question, options: q.options }),
  });
});

// POST /guilds/:guildId/quizzes/:quizId/attempt — submit quiz attempt
quizzesRouter.post('/:quizId/attempt', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { quizId } = req.params as Record<string, string>;
  const { answers } = req.body;

  if (!Array.isArray(answers)) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'answers array required' }); return;
  }

  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1);
  if (!quiz) { res.status(404).json({ code: 'NOT_FOUND' }); return; }

  const questions = quiz.questions as Array<{ correctIndex: number }>;
  let score = 0;
  for (let i = 0; i < questions.length; i++) {
    if (answers[i] === questions[i].correctIndex) score++;
  }

  const [attempt] = await db.insert(quizAttempts).values({
    quizId,
    userId: req.userId!,
    answers,
    score,
    maxScore: questions.length,
  }).returning();

  res.status(201).json(attempt);
});

// GET /guilds/:guildId/quizzes/:quizId/leaderboard — quiz leaderboard
quizzesRouter.get('/:quizId/leaderboard', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { quizId } = req.params as Record<string, string>;

  const rows = await db.select({
    userId: quizAttempts.userId,
    score: quizAttempts.score,
    maxScore: quizAttempts.maxScore,
    completedAt: quizAttempts.completedAt,
    username: users.username,
    displayName: users.displayName,
  }).from(quizAttempts)
    .innerJoin(users, eq(users.id, quizAttempts.userId))
    .where(eq(quizAttempts.quizId, quizId))
    .orderBy(desc(quizAttempts.score));

  res.json(rows);
});

// DELETE /guilds/:guildId/quizzes/:quizId
quizzesRouter.delete('/:quizId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { quizId } = req.params as Record<string, string>;
  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1);
  if (!quiz) { res.status(404).json({ code: 'NOT_FOUND' }); return; }
  if (quiz.createdBy !== req.userId!) { res.status(403).json({ code: 'FORBIDDEN' }); return; }

  await db.delete(quizzes).where(eq(quizzes.id, quizId));
  res.json({ ok: true });
});
