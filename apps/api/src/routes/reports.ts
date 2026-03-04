import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index';
import { reports } from '../db/schema/reports';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { ADMIN_SCOPES, hasAdminScope } from '../lib/admin-scopes';

export const reportsRouter = Router();

// ── Validation schemas ──────────────────────────────────────────────────────

const createReportSchema = z.object({
  targetType: z.enum(['user', 'message', 'guild', 'bot', 'channel']),
  targetId: z.string().min(1),
  reason: z.string().min(1).max(2000),
  details: z.string().max(5000).optional(),
});

const updateReportSchema = z.object({
  status: z.enum(['open', 'investigating', 'resolved', 'dismissed']).optional(),
  adminNotes: z.string().max(5000).optional(),
});

// ── POST /reports — submit a report ─────────────────────────────────────────

reportsRouter.post(
  '/reports',
  requireAuth,
  validate(createReportSchema),
  async (req: Request, res: Response): Promise<void> => {
    const { targetType, targetId, reason } = req.body as z.infer<typeof createReportSchema>;

    const [report] = await db
      .insert(reports)
      .values({
        reporterId: req.userId!,
        targetType,
        targetId,
        reason,
      })
      .returning();

    res.status(201).json(report);
  },
);

// ── GET /admin/reports — list all reports (admin only) ──────────────────────

reportsRouter.get(
  '/admin/reports',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    if (!(await hasAdminScope(req.userId!, ADMIN_SCOPES.REPORTS_MANAGE))) {
      res.status(403).json({ error: 'Admin scope required: admin.reports.manage' });
      return;
    }

    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Number(req.query.offset) || 0;
    const statusFilter = req.query.status as string | undefined;
    const targetTypeFilter = req.query.targetType as string | undefined;

    let items = await db
      .select()
      .from(reports)
      .orderBy(desc(reports.createdAt))
      .limit(limit)
      .offset(offset);

    if (statusFilter) {
      items = items.filter((r) => r.status === statusFilter);
    }
    if (targetTypeFilter) {
      items = items.filter((r) => r.targetType === targetTypeFilter);
    }

    res.json({ items });
  },
);

// ── PATCH /admin/reports/:id — update report status (admin only) ────────────

reportsRouter.patch(
  '/admin/reports/:id',
  requireAuth,
  validate(updateReportSchema),
  async (req: Request, res: Response): Promise<void> => {
    if (!(await hasAdminScope(req.userId!, ADMIN_SCOPES.REPORTS_MANAGE))) {
      res.status(403).json({ error: 'Admin scope required: admin.reports.manage' });
      return;
    }

    const { status } = req.body as z.infer<typeof updateReportSchema>;

    const [updated] = await db
      .update(reports)
      .set({ status: status ?? 'open' })
      .where(eq(reports.id, req.params.id as string))
      .returning();

    if (!updated) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    res.json(updated);
  },
);
