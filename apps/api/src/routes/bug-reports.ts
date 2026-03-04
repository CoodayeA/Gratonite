import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index';
import { bugReports } from '../db/schema/reports';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { ADMIN_SCOPES, hasAdminScope } from '../lib/admin-scopes';

export const bugReportsRouter = Router();

// ── Validation schemas ──────────────────────────────────────────────────────

const createBugReportSchema = z.object({
  title: z.string().min(1).max(200),
  summary: z.string().min(1).max(5000),
  pageUrl: z.string().max(500).optional(),
  viewport: z.string().max(50).optional(),
  userAgent: z.string().max(500).optional(),
  clientTimestamp: z.string().max(100).optional(),
});

const updateBugReportSchema = z.object({
  status: z.enum(['open', 'investigating', 'resolved', 'closed']),
});

// ── POST /bug-reports — create a bug report ─────────────────────────────────

bugReportsRouter.post(
  '/',
  requireAuth,
  validate(createBugReportSchema),
  async (req: Request, res: Response): Promise<void> => {
    const { summary, ...rest } = req.body as z.infer<typeof createBugReportSchema>;

    const [report] = await db
      .insert(bugReports)
      .values({
        userId: req.userId!,
        description: summary,
        ...rest,
      })
      .returning();

    res.status(201).json(report);
  },
);

// ── GET /bug-reports — list bug reports ─────────────────────────────────────
// Admins see all, regular users see only their own.

bugReportsRouter.get(
  '/',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const isAdmin = await hasAdminScope(req.userId!, ADMIN_SCOPES.BUG_REPORTS_MANAGE);

    const statusFilter = req.query.status as string | undefined;
    const mine = req.query.mine === 'true';
    const limit = Math.min(Number(req.query.limit) || 50, 100);

    let query = db.select().from(bugReports).orderBy(desc(bugReports.createdAt)).limit(limit).$dynamic();

    if (!isAdmin || mine) {
      query = query.where(eq(bugReports.userId, req.userId!));
    }

    if (statusFilter) {
      // When both userId filter and status filter are needed, we handle it simply:
      // Fetch all matching userId rows and filter status in JS for simplicity
    }

    const items = await query;

    const filtered = statusFilter
      ? items.filter((r) => r.status === statusFilter)
      : items;

    res.json({ items: filtered, adminView: isAdmin && !mine });
  },
);

// ── PATCH /bug-reports/:id — update status (admin only) ─────────────────────

bugReportsRouter.patch(
  '/:id',
  requireAuth,
  validate(updateBugReportSchema),
  async (req: Request, res: Response): Promise<void> => {
    if (!(await hasAdminScope(req.userId!, ADMIN_SCOPES.BUG_REPORTS_MANAGE))) {
      res.status(403).json({ error: 'Admin scope required: admin.bug-reports.manage' });
      return;
    }

    const { status } = req.body as z.infer<typeof updateBugReportSchema>;

    const [updated] = await db
      .update(bugReports)
      .set({ status })
      .where(eq(bugReports.id, req.params.id as string))
      .returning();

    if (!updated) {
      res.status(404).json({ error: 'Bug report not found' });
      return;
    }

    res.json(updated);
  },
);
