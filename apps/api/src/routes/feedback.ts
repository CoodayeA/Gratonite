import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index';
import { feedback } from '../db/schema/reports';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { ADMIN_SCOPES, hasAdminScope } from '../lib/admin-scopes';

export const feedbackRouter = Router();

// ── Validation schemas ──────────────────────────────────────────────────────

const createFeedbackSchema = z.object({
  category: z.string().min(1).max(50),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
});

const updateFeedbackSchema = z.object({
  status: z.enum(['open', 'reviewing', 'planned', 'resolved', 'dismissed']).optional(),
  adminNotes: z.string().max(5000).optional(),
});

// ── POST /feedback — submit feedback ────────────────────────────────────────

feedbackRouter.post(
  '/feedback',
  requireAuth,
  validate(createFeedbackSchema),
  async (req: Request, res: Response): Promise<void> => {
    const { category, title, body } = req.body as z.infer<typeof createFeedbackSchema>;

    const [item] = await db
      .insert(feedback)
      .values({
        userId: req.userId!,
        category,
        title,
        body,
      })
      .returning();

    res.status(201).json(item);
  },
);

// ── GET /feedback/mine — list own feedback ──────────────────────────────────

feedbackRouter.get(
  '/feedback/mine',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const items = await db
      .select()
      .from(feedback)
      .where(eq(feedback.userId, req.userId!))
      .orderBy(desc(feedback.createdAt))
      .limit(50);

    res.json({ items });
  },
);

// ── GET /admin/feedback — list all feedback (admin only) ────────────────────

feedbackRouter.get(
  '/admin/feedback',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    if (!(await hasAdminScope(req.userId!, ADMIN_SCOPES.FEEDBACK_MANAGE))) {
      res.status(403).json({ error: 'Admin scope required: admin.feedback.manage' });
      return;
    }

    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;
    const statusFilter = req.query.status as string | undefined;
    const categoryFilter = req.query.category as string | undefined;

    let items = await db
      .select()
      .from(feedback)
      .orderBy(desc(feedback.createdAt))
      .limit(limit)
      .offset(offset);

    if (statusFilter) {
      items = items.filter((r) => r.status === statusFilter);
    }
    if (categoryFilter) {
      items = items.filter((r) => r.category === categoryFilter);
    }

    res.json({ items });
  },
);

// ── PATCH /admin/feedback/:id — update feedback (admin only) ────────────────

feedbackRouter.patch(
  '/admin/feedback/:id',
  requireAuth,
  validate(updateFeedbackSchema),
  async (req: Request, res: Response): Promise<void> => {
    if (!(await hasAdminScope(req.userId!, ADMIN_SCOPES.FEEDBACK_MANAGE))) {
      res.status(403).json({ error: 'Admin scope required: admin.feedback.manage' });
      return;
    }

    const { status, adminNotes } = req.body as z.infer<typeof updateFeedbackSchema>;

    const updateData: Record<string, string> = {};
    if (status) updateData.status = status;
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes;

    const [updated] = await db
      .update(feedback)
      .set(updateData)
      .where(eq(feedback.id, req.params.id as string))
      .returning();

    if (!updated) {
      res.status(404).json({ error: 'Feedback not found' });
      return;
    }

    res.json(updated);
  },
);
