import { Router, Request, Response } from 'express';
import { eq, and, asc } from 'drizzle-orm';
import { db } from '../db/index';
import { profileShowcaseItems } from '../db/schema/profile-showcase';
import { requireAuth } from '../middleware/auth';

export const showcaseRouter = Router();

// GET /users/:userId/showcase — get showcase items for a user
showcaseRouter.get('/users/:userId/showcase', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { userId } = req.params as Record<string, string>;

  const rows = await db.select().from(profileShowcaseItems)
    .where(eq(profileShowcaseItems.userId, userId))
    .orderBy(asc(profileShowcaseItems.displayOrder));

  res.json(rows);
});

// PUT /users/@me/showcase — set showcase items
showcaseRouter.put('/users/@me/showcase', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { items } = req.body as {
    items: { slot: number; itemType: string; referenceId: string }[];
  };

  if (!items || !Array.isArray(items)) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'items array is required'  });
    return;
  }

  // Delete existing items
  await db.delete(profileShowcaseItems)
    .where(eq(profileShowcaseItems.userId, req.userId!));

  // Insert new items
  if (items.length > 0) {
    const values = items.map((item, index) => ({
      userId: req.userId!,
      slot: item.slot,
      itemType: item.itemType,
      referenceId: item.referenceId,
      displayOrder: index,
    }));

    await db.insert(profileShowcaseItems).values(values);
  }

  const rows = await db.select().from(profileShowcaseItems)
    .where(eq(profileShowcaseItems.userId, req.userId!))
    .orderBy(asc(profileShowcaseItems.displayOrder));

  res.json(rows);
});

// DELETE /users/@me/showcase/:slot — remove item from slot
showcaseRouter.delete('/users/@me/showcase/:slot', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const slot = parseInt(req.params.slot as string, 10);

  if (isNaN(slot)) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'Invalid slot number'  });
    return;
  }

  const [existing] = await db.select().from(profileShowcaseItems)
    .where(and(
      eq(profileShowcaseItems.userId, req.userId!),
      eq(profileShowcaseItems.slot, slot),
    ))
    .limit(1);

  if (!existing) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'No item in this slot' });
    return;
  }

  await db.delete(profileShowcaseItems)
    .where(and(
      eq(profileShowcaseItems.userId, req.userId!),
      eq(profileShowcaseItems.slot, slot),
    ));

  res.json({ code: 'OK', message: 'Item removed from slot' });
});
