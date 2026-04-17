import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, desc, and, gt, sql, inArray } from 'drizzle-orm';
import { db } from '../db/index';
import { reports } from '../db/schema/reports';
import { users } from '../db/schema/users';
import { guilds } from '../db/schema/guilds';
import { channels } from '../db/schema/channels';
import { messages } from '../db/schema/messages';
import { botListings } from '../db/schema/bot-store';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { ADMIN_SCOPES, hasAdminScope } from '../lib/admin-scopes';
import { logAdminAudit } from '../lib/admin-audit';

export const reportsRouter = Router();

// ── Validation schemas ──────────────────────────────────────────────────────

const createReportSchema = z.object({
  targetType: z.enum(['user', 'message', 'guild', 'bot', 'channel']),
  targetId: z.string().min(1),
  reason: z.string().min(1).max(2000),
  details: z.string().max(5000).optional(),
});

const updateReportSchema = z.object({
  status: z.enum(['open', 'investigating', 'under_review', 'resolved', 'dismissed']).optional(),
  adminNotes: z.string().max(5000).optional(),
});

const displayNameForUser = (user?: { displayName: string | null; username: string | null } | null): string =>
  user?.displayName || user?.username || 'Unknown user';

const uniqueIds = (values: Array<string | null | undefined>): string[] =>
  Array.from(new Set(values.filter((value): value is string => typeof value === 'string' && value.length > 0)));

const toMessagePreview = (content: string | null | undefined): string =>
  (content ?? '').trim().replace(/\s+/g, ' ').slice(0, 180);

const normalizeReportStatus = (status: string | undefined): 'open' | 'investigating' | 'resolved' | 'dismissed' | undefined => {
  if (!status) return undefined;
  if (status === 'under_review') return 'investigating';
  if (status === 'open' || status === 'investigating' || status === 'resolved' || status === 'dismissed') {
    return status;
  }
  return undefined;
};

function reportAuditAction(status: 'open' | 'investigating' | 'resolved' | 'dismissed' | undefined, hasNotes: boolean): string {
  if (!status) return hasNotes ? 'REPORT_NOTE_ADDED' : 'REPORT_UPDATED';
  switch (status) {
    case 'investigating':
      return 'REPORT_UNDER_REVIEW';
    case 'resolved':
      return 'REPORT_RESOLVED';
    case 'dismissed':
      return 'REPORT_DISMISSED';
    case 'open':
    default:
      return 'REPORT_REOPENED';
  }
}

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
    const statusFilter = normalizeReportStatus(req.query.status as string | undefined);
    const targetTypeFilter = req.query.targetType as string | undefined;
    const conditions = [];
    if (statusFilter) conditions.push(eq(reports.status, statusFilter));
    if (targetTypeFilter) conditions.push(eq(reports.targetType, targetTypeFilter));
    const whereClause = conditions.length ? and(...conditions) : undefined;

    const items = await db
      .select()
      .from(reports)
      .where(whereClause)
      .orderBy(desc(reports.createdAt))
      .limit(limit)
      .offset(offset);

    if (items.length === 0) {
      res.json({ items: [] });
      return;
    }

    const reporterIds = uniqueIds(items.map((item) => item.reporterId));
    const userTargetIds = uniqueIds(items.filter((item) => item.targetType === 'user').map((item) => item.targetId));
    const guildTargetIds = uniqueIds(items.filter((item) => item.targetType === 'guild').map((item) => item.targetId));
    const channelTargetIds = uniqueIds(items.filter((item) => item.targetType === 'channel').map((item) => item.targetId));
    const messageTargetIds = uniqueIds(items.filter((item) => item.targetType === 'message').map((item) => item.targetId));
    const botTargetIds = uniqueIds(items.filter((item) => item.targetType === 'bot').map((item) => item.targetId));

    const [reporterRows, userTargetRows, guildTargetRows, channelTargetRows, messageTargetRows, botTargetRows] = await Promise.all([
      reporterIds.length
        ? db.select({ id: users.id, username: users.username, displayName: users.displayName, avatarHash: users.avatarHash }).from(users).where(inArray(users.id, reporterIds))
        : Promise.resolve([]),
      userTargetIds.length
        ? db.select({ id: users.id, username: users.username, displayName: users.displayName, avatarHash: users.avatarHash }).from(users).where(inArray(users.id, userTargetIds))
        : Promise.resolve([]),
      guildTargetIds.length
        ? db.select({ id: guilds.id, name: guilds.name, iconHash: guilds.iconHash }).from(guilds).where(inArray(guilds.id, guildTargetIds))
        : Promise.resolve([]),
      channelTargetIds.length
        ? db.select({ id: channels.id, name: channels.name, guildId: channels.guildId }).from(channels).where(inArray(channels.id, channelTargetIds))
        : Promise.resolve([]),
      messageTargetIds.length
        ? db.select({ id: messages.id, authorId: messages.authorId, channelId: messages.channelId, content: messages.content }).from(messages).where(inArray(messages.id, messageTargetIds))
        : Promise.resolve([]),
      botTargetIds.length
        ? db.select({ id: botListings.id, name: botListings.name, description: botListings.shortDescription }).from(botListings).where(inArray(botListings.id, botTargetIds))
        : Promise.resolve([]),
    ]);

    const messageAuthorIds = uniqueIds(messageTargetRows.map((message) => message.authorId));
    const messageChannelIds = uniqueIds(messageTargetRows.map((message) => message.channelId));

    const [messageAuthorRows, messageChannelRows] = await Promise.all([
      messageAuthorIds.length
        ? db.select({ id: users.id, username: users.username, displayName: users.displayName, avatarHash: users.avatarHash }).from(users).where(inArray(users.id, messageAuthorIds))
        : Promise.resolve([]),
      messageChannelIds.length
        ? db.select({ id: channels.id, name: channels.name, guildId: channels.guildId }).from(channels).where(inArray(channels.id, messageChannelIds))
        : Promise.resolve([]),
    ]);

    const allGuildIds = uniqueIds([...guildTargetRows.map((guild) => guild.id), ...channelTargetRows.map((channel) => channel.guildId), ...messageChannelRows.map((channel) => channel.guildId)]);
    const relatedGuildRows = allGuildIds.length
      ? await db.select({ id: guilds.id, name: guilds.name, iconHash: guilds.iconHash }).from(guilds).where(inArray(guilds.id, allGuildIds))
      : [];

    const reporterMap = new Map(reporterRows.map((row) => [row.id, row]));
    const userTargetMap = new Map(userTargetRows.map((row) => [row.id, row]));
    const guildTargetMap = new Map(relatedGuildRows.map((row) => [row.id, row]));
    const channelTargetMap = new Map([...channelTargetRows, ...messageChannelRows].map((row) => [row.id, row]));
    const messageTargetMap = new Map(messageTargetRows.map((row) => [row.id, row]));
    const messageAuthorMap = new Map(messageAuthorRows.map((row) => [row.id, row]));
    const botTargetMap = new Map(botTargetRows.map((row) => [row.id, row]));

    res.json({
      items: items.map((item) => {
        const reporter = reporterMap.get(item.reporterId);

        let targetName = item.targetId;
        let targetPreview = '';
        let subjectUserId: string | null = null;
        let subjectGuildId: string | null = null;
        let targetAvatarHash: string | null = null;

        if (item.targetType === 'user') {
          const target = userTargetMap.get(item.targetId);
          targetName = displayNameForUser(target);
          targetPreview = target?.username ? `@${target.username}` : '';
          subjectUserId = target?.id ?? item.targetId;
          targetAvatarHash = target?.avatarHash ?? null;
        } else if (item.targetType === 'guild') {
          const target = guildTargetMap.get(item.targetId);
          targetName = target?.name ?? 'Unknown guild';
          subjectGuildId = target?.id ?? item.targetId;
        } else if (item.targetType === 'channel') {
          const target = channelTargetMap.get(item.targetId);
          const guild = target?.guildId ? guildTargetMap.get(target.guildId) : null;
          targetName = target ? `#${target.name}` : 'Unknown channel';
          targetPreview = guild?.name ? `in ${guild.name}` : '';
          subjectGuildId = target?.guildId ?? null;
        } else if (item.targetType === 'bot') {
          const target = botTargetMap.get(item.targetId);
          targetName = target?.name ?? 'Unknown bot';
          targetPreview = target?.description ?? '';
        } else if (item.targetType === 'message') {
          const target = messageTargetMap.get(item.targetId);
          const author = target?.authorId ? messageAuthorMap.get(target.authorId) : null;
          const channel = target?.channelId ? channelTargetMap.get(target.channelId) : null;
          const guild = channel?.guildId ? guildTargetMap.get(channel.guildId) : null;
          targetName = author ? displayNameForUser(author) : 'Reported message';
          targetPreview = toMessagePreview(target?.content) || 'No message body captured';
          subjectUserId = target?.authorId ?? null;
          subjectGuildId = channel?.guildId ?? null;
          targetAvatarHash = author?.avatarHash ?? null;
          if (channel?.name) {
            targetPreview = `${targetPreview}${guild?.name ? ` · #${channel.name} in ${guild.name}` : ` · #${channel.name}`}`;
          }
        }

        return {
          ...item,
          reporterName: displayNameForUser(reporter),
          reporterUsername: reporter?.username ?? null,
          reporterAvatarHash: reporter?.avatarHash ?? null,
          targetName,
          targetPreview,
          subjectUserId,
          subjectGuildId,
          targetAvatarHash,
        };
      }),
    });
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

    const { status, adminNotes } = req.body as z.infer<typeof updateReportSchema>;
    const normalizedStatus = normalizeReportStatus(status);

    const [existing] = await db.select().from(reports).where(eq(reports.id, req.params.id as string)).limit(1);
    if (!existing) {
      res.status(404).json({ code: 'NOT_FOUND', message: 'Report not found'  });
      return;
    }

    const [updated] = await db
      .update(reports)
      .set({ status: normalizedStatus ?? existing.status })
      .where(eq(reports.id, req.params.id as string))
      .returning();

    if (normalizedStatus || adminNotes) {
      await logAdminAudit({
        actorId: req.userId!,
        action: reportAuditAction(normalizedStatus, Boolean(adminNotes?.trim())),
        targetType: 'report',
        targetId: updated.id,
        description: `${normalizedStatus ? `Set report to ${normalizedStatus === 'investigating' ? 'under review' : normalizedStatus}` : 'Added moderator note'}${adminNotes?.trim() ? ` — ${adminNotes.trim().slice(0, 240)}` : ''}`,
        metadata: {
          previousStatus: existing.status,
          nextStatus: normalizedStatus ?? existing.status,
          adminNotes: adminNotes?.trim() || null,
          reportTargetType: existing.targetType,
          reportTargetId: existing.targetId,
        },
      });
    }

    res.json(updated);
  },
);
