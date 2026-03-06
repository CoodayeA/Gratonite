import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index';
import { pushSubscriptions } from '../db/schema/push-subscriptions';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';

export const pushRouter = Router();

pushRouter.get('/vapid-public-key', (_req: Request, res: Response) => {
  res.json({ key: process.env.VAPID_PUBLIC_KEY || '' });
});

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string(),
  auth: z.string(),
});

pushRouter.post('/subscribe', requireAuth, validate(subscribeSchema), async (req: Request, res: Response): Promise<void> => {
  const { endpoint, p256dh, auth } = req.body;
  await db.insert(pushSubscriptions).values({ userId: req.userId!, endpoint, p256dh, auth })
    .onConflictDoUpdate({ target: [pushSubscriptions.userId, pushSubscriptions.endpoint], set: { p256dh, auth } });
  res.json({ ok: true });
});

pushRouter.delete('/subscribe', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { endpoint } = req.body as { endpoint?: string };
  if (!endpoint) { res.status(400).json({ error: 'endpoint required' }); return; }
  await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, req.userId!), eq(pushSubscriptions.endpoint, endpoint)));
  res.json({ ok: true });
});
