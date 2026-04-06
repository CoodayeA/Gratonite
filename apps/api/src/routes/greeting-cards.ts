import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { db } from '../db/index';
import { greetingCardTemplates, greetingCards } from '../db/schema/greeting-cards';
import { users } from '../db/schema/users';
import { requireAuth } from '../middleware/auth';

export const greetingCardsRouter = Router({ mergeParams: true });

/** GET /greeting-cards/templates — list templates by category */
greetingCardsRouter.get('/templates', async (_req: Request, res: Response): Promise<void> => {
  try {
    const templates = await db.select().from(greetingCardTemplates);
    const grouped: Record<string, typeof templates> = {};
    for (const t of templates) {
      if (!grouped[t.category]) grouped[t.category] = [];
      grouped[t.category].push(t);
    }
    res.json(grouped);
  } catch (err) {
    logger.error('[greeting-cards] GET templates error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error'  });
  }
});

/** POST /greeting-cards — send a card */
greetingCardsRouter.post('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const senderId = req.userId!;
    const { templateId, recipientId, message, stickers } = req.body as {
      templateId: string;
      recipientId: string;
      message: string;
      stickers?: unknown[];
    };

    if (!templateId || !recipientId || !message) {
      res.status(400).json({ code: 'BAD_REQUEST', message: 'templateId, recipientId, and message are required'  });
      return;
    }

    if (senderId === recipientId) {
      res.status(400).json({ code: 'BAD_REQUEST', message: 'Cannot send a card to yourself'  });
      return;
    }

    // Verify template exists
    const [template] = await db.select().from(greetingCardTemplates)
      .where(eq(greetingCardTemplates.id, templateId)).limit(1);
    if (!template) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Template not found'  });
      return;
    }

    const [card] = await db.insert(greetingCards).values({
      templateId,
      senderId,
      recipientId,
      message,
      stickers: stickers ?? [],
    }).returning();

    res.status(201).json(card);
  } catch (err) {
    logger.error('[greeting-cards] POST error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error'  });
  }
});

/** GET /greeting-cards/inbox — get received cards */
greetingCardsRouter.get('/inbox', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    const rows = await db.select({
      card: greetingCards,
      template: greetingCardTemplates,
      sender: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarHash: users.avatarHash,
      },
    })
      .from(greetingCards)
      .innerJoin(greetingCardTemplates, eq(greetingCardTemplates.id, greetingCards.templateId))
      .innerJoin(users, eq(users.id, greetingCards.senderId))
      .where(eq(greetingCards.recipientId, userId))
      .orderBy(desc(greetingCards.sentAt));

    res.json(rows.map(r => ({ ...r.card, template: r.template, sender: r.sender })));
  } catch (err) {
    logger.error('[greeting-cards] GET inbox error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error'  });
  }
});

/** PATCH /greeting-cards/:id/view — mark card as viewed */
greetingCardsRouter.patch('/:id/view', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params as Record<string, string>;

    const [updated] = await db.update(greetingCards)
      .set({ viewedAt: new Date() })
      .where(and(
        eq(greetingCards.id, id),
        eq(greetingCards.recipientId, userId),
        isNull(greetingCards.viewedAt),
      ))
      .returning();

    if (!updated) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Card not found or already viewed'  });
      return;
    }

    res.json(updated);
  } catch (err) {
    logger.error('[greeting-cards] PATCH view error:', err);
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Internal server error'  });
  }
});
