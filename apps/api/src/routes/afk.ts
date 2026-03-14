/**
 * routes/afk.ts — AFK / away mode with auto-reply message.
 * Mounted at /users
 */
import { Router, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index';
import { users } from '../db/schema/users';
import { requireAuth } from '../middleware/auth';

export const afkRouter = Router();

// In-memory AFK store (persists per server lifetime)
const afkStore = new Map<string, { message: string; since: string }>();

// GET /users/@me/afk — get my AFK status
afkRouter.get('/@me/afk', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const afk = afkStore.get(req.userId!);
  res.json(afk || null);
});

// POST /users/@me/afk — set AFK
afkRouter.post('/@me/afk', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { message } = req.body;

  afkStore.set(req.userId!, {
    message: message ? String(message).slice(0, 200) : 'I am currently AFK',
    since: new Date().toISOString(),
  });

  res.json(afkStore.get(req.userId!));
});

// DELETE /users/@me/afk — clear AFK
afkRouter.delete('/@me/afk', requireAuth, async (req: Request, res: Response): Promise<void> => {
  afkStore.delete(req.userId!);
  res.json({ ok: true });
});

// GET /users/:userId/afk — check if user is AFK
afkRouter.get('/:userId/afk', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = req.params.userId as string;
  const afk = afkStore.get(userId);
  res.json(afk || null);
});

// Export for use in messages route to auto-reply
export function getAfkStatus(userId: string) {
  return afkStore.get(userId) || null;
}
