import { Router, Request, Response } from 'express';
import { eq, and, isNotNull, sql } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { db } from '../db/index';
import { referrals } from '../db/schema/referrals';
import { requireAuth } from '../middleware/auth';

export const referralsRouter = Router();

referralsRouter.get('/@me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  let [ref] = await db.select().from(referrals).where(eq(referrals.referrerId, req.userId!)).limit(1);
  if (!ref) {
    const code = randomBytes(5).toString('hex');
    [ref] = await db.insert(referrals).values({ referrerId: req.userId!, code }).returning();
  }
  const count = await db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(referrals).where(and(eq(referrals.referrerId, req.userId!), isNotNull(referrals.referredId)));
  res.json({ code: ref.code, referralLink: `https://gratonite.chat/app/register?ref=${ref.code}`, count: count[0]?.count ?? 0 });
});
