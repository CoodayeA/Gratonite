import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, desc, and, gt, sql } from 'drizzle-orm';
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
    const userId = req.userId!;

    // Check for duplicate: same user already reported this exact target
    const [existing] = await db
      .select({ id: reports.id })
      .from(reports)
      .where(
        and(
          eq(reports.reporterId, userId),
          eq(reports.targetId, targetId),
          eq(reports.targetType, targetType),
        ),
      )
      .limit(1);

    if (existing) {
      res.status(409).json({ code: 'CONFLICT', message: 'You have already reported this content.'  });
      return;
    }

    // Rate limit: max 5 reports per minute per user
    const oneMinuteAgo = new Date(Date.now() - 60_000);
    const [{ count: recentCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(reports)
      .where(
        and(
          eq(reports.reporterId, userId),
          gt(reports.createdAt, oneMinuteAgo),
        ),
      );

    if (recentCount >= 5) {
      res.status(429).json({ code: 'RATE_LIMITED', message: 'Too many reports. Please wait a minute before reporting again.'  });
      return;
    }

    const [report] = await db
      .insert(reports)
      .values({
        reporterId: userId,
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
      res.status(403).json({ code: 'FORBIDDEN', message: 'Admin scope required: admin.reports.manage'  });
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
      res.status(403).json({ code: 'FORBIDDEN', message: 'Admin scope required: admin.reports.manage'  });
      return;
    }

    const { status } = req.body as z.infer<typeof updateReportSchema>;

    const [updated] = await db
      .update(reports)
      .set({ status: status ?? 'open' })
      .where(eq(reports.id, req.params.id as string))
      .returning();

    if (!updated) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Report not found'  });
      return;
    }

    res.json(updated);
  },
);
