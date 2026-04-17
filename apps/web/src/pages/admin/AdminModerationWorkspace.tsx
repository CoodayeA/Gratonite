import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  Filter,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../components/ui/ToastManager';
import Avatar from '../../components/ui/Avatar';

type ApiReportStatus = 'open' | 'investigating' | 'resolved' | 'dismissed';
type ReportStatus = 'open' | 'under_review' | 'resolved' | 'dismissed';
type BotStatus = 'pending' | 'approved' | 'rejected';
type AppealFilter = 'pending' | 'all';

type WorkspaceReport = {
  id: string;
  targetId: string;
  targetType: 'message' | 'user' | 'guild' | 'bot' | 'channel';
  reason: string;
  status: ReportStatus;
  reportedDate: string;
  reporterId: string;
  reporterName: string;
  reporterUsername: string | null;
  reporterAvatarHash: string | null;
  targetName: string;
  targetPreview: string;
  targetAvatarHash: string | null;
  subjectUserId: string | null;
  subjectGuildId: string | null;
};

type AuditEntry = {
  id: string;
  action: string;
  description: string;
  actor: string;
  createdAt: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
};

type GuildOption = {
  id: string;
  name: string;
  iconHash: string | null;
};

type BanAppeal = {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatarHash: string | null;
  reason: string | null;
  appealStatus: 'pending' | 'approved' | 'denied' | null;
  appealText: string | null;
  appealSubmittedAt: string | null;
  appealReviewedAt: string | null;
  reviewedByName: string | null;
};

type WarningEntry = {
  id: string;
  reason: string;
  createdAt: string;
};

type BanEntry = {
  userId: string;
  reason: string | null;
  bannedAt: string;
};

type QueueSummary = {
  openReports: number;
  underReviewReports: number;
  pendingBots: number;
  visibleAppeals: number;
};

const WORKFLOW_STEPS = [
  {
    title: 'Triage the live queue',
    description: 'Pick an open report, move it into review, and attach the moderator note that explains the next action.',
    href: '#report-queue',
    accent: 'var(--warning)',
  },
  {
    title: 'Check context before acting',
    description: 'Use the report target, guild context, warnings, ban state, and moderator notes without leaving the workspace.',
    href: '#moderator-context',
    accent: 'var(--accent-blue)',
  },
  {
    title: 'Close the loop',
    description: 'Review appeal status and the action timeline so every decision is visible after the case moves on.',
    href: '#appeals-and-history',
    accent: 'var(--accent-purple)',
  },
];

const STATUS_LABELS: Record<ReportStatus, string> = {
  open: 'Open',
  under_review: 'Under review',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
};

const ACTION_CHOICES: Array<{ key: ReportStatus; label: string; tone: string }> = [
  { key: 'under_review', label: 'Start review', tone: 'var(--accent-blue)' },
  { key: 'resolved', label: 'Resolve', tone: 'var(--success)' },
  { key: 'dismissed', label: 'Dismiss', tone: 'var(--error)' },
  { key: 'open', label: 'Re-open', tone: 'var(--warning)' },
];

function normalizeReportStatus(status: ApiReportStatus | ReportStatus | string | undefined): ReportStatus {
  if (status === 'investigating' || status === 'under_review') return 'under_review';
  if (status === 'resolved' || status === 'dismissed') return status;
  return 'open';
}

function toApiReportStatus(status: ReportStatus): ApiReportStatus {
  if (status === 'under_review') return 'investigating';
  return status;
}

function formatRelative(iso?: string | null) {
  if (!iso) return 'Just now';
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateTime(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isModerationEntry(entry: AuditEntry) {
  return entry.action.startsWith('REPORT_') || entry.action.startsWith('BAN_APPEAL_') || entry.action.startsWith('BOT_LISTING_');
}

function statusBadgeStyles(status: ReportStatus) {
  switch (status) {
    case 'under_review':
      return { color: 'var(--accent-blue)', background: 'rgba(59,130,246,0.12)' };
    case 'resolved':
      return { color: 'var(--success)', background: 'rgba(34,197,94,0.12)' };
    case 'dismissed':
      return { color: 'var(--text-muted)', background: 'rgba(100,116,139,0.14)' };
    case 'open':
    default:
      return { color: 'var(--warning)', background: 'rgba(245,158,11,0.12)' };
  }
}

function queueOrder(status: ReportStatus) {
  switch (status) {
    case 'open':
      return 0;
    case 'under_review':
      return 1;
    case 'resolved':
      return 2;
    case 'dismissed':
      return 3;
    default:
      return 4;
  }
}

function moderationLabel(entry: AuditEntry) {
  switch (entry.action) {
    case 'REPORT_UNDER_REVIEW':
      return 'Report moved to review';
    case 'REPORT_RESOLVED':
      return 'Report resolved';
    case 'REPORT_DISMISSED':
      return 'Report dismissed';
    case 'REPORT_REOPENED':
      return 'Report re-opened';
    case 'REPORT_NOTE_ADDED':
      return 'Moderator note added';
    case 'BAN_APPEAL_APPROVED':
      return 'Appeal approved';
    case 'BAN_APPEAL_DENIED':
      return 'Appeal denied';
    default:
      return entry.action.replace(/_/g, ' ').toLowerCase().replace(/(^|\\s)\\w/g, (char) => char.toUpperCase());
  }
}

export default function AdminModerationWorkspace() {
  const { addToast } = useToast();
  const [reports, setReports] = useState<WorkspaceReport[]>([]);
  const [auditFeed, setAuditFeed] = useState<AuditEntry[]>([]);
  const [pendingBots, setPendingBots] = useState(0);
  const [guilds, setGuilds] = useState<GuildOption[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [selectedGuildId, setSelectedGuildId] = useState('');
  const [reportSearch, setReportSearch] = useState('');
  const [reportStatusFilter, setReportStatusFilter] = useState<'all' | ReportStatus>('all');
  const [appealFilter, setAppealFilter] = useState<AppealFilter>('pending');
  const [appeals, setAppeals] = useState<BanAppeal[]>([]);
  const [reportHistory, setReportHistory] = useState<AuditEntry[]>([]);
  const [warningHistory, setWarningHistory] = useState<WarningEntry[]>([]);
  const [banHistory, setBanHistory] = useState<BanEntry[]>([]);
  const [modNote, setModNote] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reportActionLoading, setReportActionLoading] = useState(false);
  const [appealsLoading, setAppealsLoading] = useState(false);
  const [contextLoading, setContextLoading] = useState(false);
  const [modNoteSaving, setModNoteSaving] = useState(false);
  const [appealError, setAppealError] = useState('');

  const hydrateQueue = useCallback(async (preserveSelection = true) => {
    const [reportsResponse, botsResponse, auditResponse, guildsResponse] = await Promise.all([
      api.reports.list({ limit: 200 }),
      api.adminBotStore.list({ limit: 200 }),
      api.adminAudit.list({ limit: 80 }),
      api.guilds.getMine(),
    ]);

    const rawReports = (Array.isArray(reportsResponse) ? reportsResponse : (reportsResponse as any)?.items ?? []) as any[];
    const nextReports = rawReports
      .flatMap((report) => {
        const id = typeof report.id === 'string' && report.id.trim() ? report.id : null;
        if (!id) return [];
        return [{
          id,
          targetId: report.targetId ?? '',
          targetType: (['message', 'user', 'guild', 'bot', 'channel'].includes(report.targetType) ? report.targetType : 'message') as WorkspaceReport['targetType'],
          reason: report.reason ?? 'Other',
          status: normalizeReportStatus(report.status),
          reportedDate: report.createdAt ?? new Date().toISOString(),
          reporterId: report.reporterId ?? '',
          reporterName: report.reporterName ?? report.reporterUsername ?? 'Unknown reporter',
          reporterUsername: report.reporterUsername ?? null,
          reporterAvatarHash: report.reporterAvatarHash ?? null,
          targetName: report.targetName ?? report.targetId ?? 'Unknown target',
          targetPreview: report.targetPreview ?? '',
          targetAvatarHash: report.targetAvatarHash ?? null,
          subjectUserId: report.subjectUserId ?? null,
          subjectGuildId: report.subjectGuildId ?? null,
        } satisfies WorkspaceReport];
      })
      .sort((left, right) => {
        const statusDiff = queueOrder(left.status) - queueOrder(right.status);
        if (statusDiff !== 0) return statusDiff;
        return new Date(right.reportedDate).getTime() - new Date(left.reportedDate).getTime();
      });

    const botItems = (Array.isArray(botsResponse) ? botsResponse : (botsResponse as any)?.items ?? []) as Array<{ status?: BotStatus }>;
    const auditItems = ((Array.isArray(auditResponse) ? auditResponse : (auditResponse as any)?.items ?? []) as any[])
      .map((item, index) => ({
        id: item.id ?? `audit-${index}`,
        action: item.action ?? 'MODERATION_EVENT',
        description: item.description ?? '',
        actor: item.actor ?? 'system',
        createdAt: item.timestamp ?? item.createdAt ?? new Date().toISOString(),
        targetType: item.targetType ?? null,
        targetId: item.targetId ?? null,
        metadata: item.metadata ?? null,
      }))
      .filter(isModerationEntry);

    const guildOptions = ((Array.isArray(guildsResponse) ? guildsResponse : []) as any[])
      .map((guild) => ({ id: guild.id, name: guild.name, iconHash: guild.iconHash ?? null }))
      .filter((guild): guild is GuildOption => Boolean(guild.id && guild.name));

    setReports(nextReports);
    setPendingBots(botItems.filter((bot) => bot.status === 'pending').length);
    setAuditFeed(auditItems);
    setGuilds(guildOptions);
    setSelectedReportId((current) => {
      if (preserveSelection && current && nextReports.some((report) => report.id === current)) return current;
      return nextReports[0]?.id ?? null;
    });
    setSelectedGuildId((current) => {
      if (current && guildOptions.some((guild) => guild.id === current)) return current;
      const defaultGuild = nextReports.find((report) => report.subjectGuildId && guildOptions.some((guild) => guild.id === report.subjectGuildId))?.subjectGuildId;
      return defaultGuild ?? guildOptions[0]?.id ?? '';
    });
  }, []);

  const refreshWorkspace = useCallback(async (preserveSelection = true) => {
    try {
      setRefreshing(true);
      await hydrateQueue(preserveSelection);
    } catch {
      addToast({ title: 'Failed to refresh moderation workspace', variant: 'error' });
    } finally {
      setRefreshing(false);
    }
  }, [addToast, hydrateQueue]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    hydrateQueue(false)
      .catch(() => {
        if (!cancelled) addToast({ title: 'Failed to load moderation workspace', variant: 'error' });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [addToast, hydrateQueue]);

  const selectedReport = useMemo(
    () => reports.find((report) => report.id === selectedReportId) ?? reports[0] ?? null,
    [reports, selectedReportId],
  );

  useEffect(() => {
    if (!selectedReport) {
      setNoteDraft('');
      return;
    }
    setNoteDraft('');
    if (selectedReport.subjectGuildId && guilds.some((guild) => guild.id === selectedReport.subjectGuildId)) {
      setSelectedGuildId((current) => current === selectedReport.subjectGuildId ? current : selectedReport.subjectGuildId!);
      return;
    }
    if (guilds[0]?.id) {
      setSelectedGuildId((current) => current || guilds[0].id);
    }
  }, [guilds, selectedReport]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedReport) {
      setReportHistory([]);
      return;
    }

    api.adminAudit.list({ limit: 30, targetType: 'report', targetId: selectedReport.id })
      .then((response) => {
        if (cancelled) return;
        const items = ((Array.isArray(response) ? response : (response as any)?.items ?? []) as any[]).map((item, index) => ({
          id: item.id ?? `report-history-${index}`,
          action: item.action ?? 'REPORT_UPDATED',
          description: item.description ?? '',
          actor: item.actor ?? 'system',
          createdAt: item.timestamp ?? item.createdAt ?? new Date().toISOString(),
          targetType: item.targetType ?? null,
          targetId: item.targetId ?? null,
          metadata: item.metadata ?? null,
        }));
        setReportHistory(items);
      })
      .catch(() => {
        if (!cancelled) setReportHistory([]);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedReport]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedGuildId) {
      setAppeals([]);
      setAppealError('');
      return;
    }

    setAppealsLoading(true);
    setAppealError('');
    api.banAppeals.list(selectedGuildId, { status: appealFilter === 'all' ? 'all' : 'pending' })
      .then((response) => {
        if (cancelled) return;
        const items = (Array.isArray(response) ? response : []) as any[];
        setAppeals(items.map((appeal) => ({
          id: appeal.id ?? `${appeal.userId}-appeal`,
          userId: appeal.userId,
          username: appeal.username ?? 'unknown',
          displayName: appeal.displayName ?? appeal.username ?? 'Unknown user',
          avatarHash: appeal.avatarHash ?? null,
          reason: appeal.reason ?? null,
          appealStatus: appeal.appealStatus ?? null,
          appealText: appeal.appealText ?? null,
          appealSubmittedAt: appeal.appealSubmittedAt ?? appeal.createdAt ?? null,
          appealReviewedAt: appeal.appealReviewedAt ?? null,
          reviewedByName: appeal.reviewedByName ?? null,
        })));
      })
      .catch(() => {
        if (!cancelled) {
          setAppeals([]);
          setAppealError('Appeals are only visible for guilds where you can review bans.');
        }
      })
      .finally(() => {
        if (!cancelled) setAppealsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [appealFilter, selectedGuildId]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedGuildId || !selectedReport?.subjectUserId) {
      setContextLoading(false);
      setModNote('');
      setWarningHistory([]);
      setBanHistory([]);
      return;
    }

    setContextLoading(true);
    Promise.all([
      api.guilds.getModNote(selectedGuildId, selectedReport.subjectUserId).catch(() => ({ content: '' })),
      api.guilds.getMemberWarnings(selectedGuildId, selectedReport.subjectUserId).catch(() => []),
      api.guilds.getBans(selectedGuildId).catch(() => []),
    ])
      .then(([noteResponse, warningsResponse, bansResponse]) => {
        if (cancelled) return;
        setModNote(noteResponse?.content ?? '');
        setWarningHistory(
          ((warningsResponse as any[]) ?? [])
            .map((warning) => ({ id: warning.id, reason: warning.reason ?? 'No reason provided', createdAt: warning.createdAt ?? new Date().toISOString() }))
            .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
        );
        setBanHistory(((bansResponse as any[]) ?? []).filter((ban) => ban.userId === selectedReport.subjectUserId));
      })
      .finally(() => {
        if (!cancelled) setContextLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedGuildId, selectedReport]);

  const filteredReports = useMemo(() => {
    const query = reportSearch.trim().toLowerCase();
    return reports.filter((report) => {
      const matchesStatus = reportStatusFilter === 'all' || report.status === reportStatusFilter;
      const matchesQuery = !query || [
        report.id,
        report.targetName,
        report.targetPreview,
        report.reporterName,
        report.reporterUsername ?? '',
        report.reason,
      ].some((value) => value.toLowerCase().includes(query));
      return matchesStatus && matchesQuery;
    });
  }, [reportSearch, reportStatusFilter, reports]);

  const queueSummary = useMemo<QueueSummary>(() => ({
    openReports: reports.filter((report) => report.status === 'open').length,
    underReviewReports: reports.filter((report) => report.status === 'under_review').length,
    pendingBots,
    visibleAppeals: appeals.filter((appeal) => appeal.appealStatus === 'pending').length,
  }), [appeals, pendingBots, reports]);

  const selectedAppeal = useMemo(() => {
    if (!selectedReport?.subjectUserId) return null;
    return appeals.find((appeal) => appeal.userId === selectedReport.subjectUserId) ?? null;
  }, [appeals, selectedReport]);

  const recentAppealDecisions = useMemo(() => {
    return auditFeed
      .filter((entry) => entry.action.startsWith('BAN_APPEAL_'))
      .filter((entry) => {
        if (!selectedGuildId) return true;
        return (entry.metadata as Record<string, unknown> | null)?.guildId === selectedGuildId;
      })
      .slice(0, 6);
  }, [auditFeed, selectedGuildId]);

  const recentModerationFeed = useMemo(() => auditFeed.slice(0, 8), [auditFeed]);

  const handleReportAction = useCallback(async (nextStatus: ReportStatus) => {
    if (!selectedReport) return;
    setReportActionLoading(true);
    try {
      await api.reports.updateStatus(selectedReport.id, {
        status: toApiReportStatus(nextStatus),
        adminNotes: noteDraft.trim() || undefined,
      });
      setReports((current) => current.map((report) => report.id === selectedReport.id ? { ...report, status: nextStatus } : report));
      setNoteDraft('');
      addToast({ title: `${STATUS_LABELS[nextStatus]} saved`, variant: nextStatus === 'dismissed' ? 'info' : 'success' });
      await refreshWorkspace(true);
    } catch {
      addToast({ title: 'Failed to update report', variant: 'error' });
    } finally {
      setReportActionLoading(false);
    }
  }, [addToast, noteDraft, refreshWorkspace, selectedReport]);

  const handleSaveModNote = useCallback(async () => {
    if (!selectedGuildId || !selectedReport?.subjectUserId) return;
    setModNoteSaving(true);
    try {
      await api.guilds.setModNote(selectedGuildId, selectedReport.subjectUserId, modNote);
      addToast({ title: 'Moderator note saved', variant: 'success' });
    } catch {
      addToast({ title: 'Failed to save moderator note', variant: 'error' });
    } finally {
      setModNoteSaving(false);
    }
  }, [addToast, modNote, selectedGuildId, selectedReport]);

  const handleAppealReview = useCallback(async (userId: string, status: 'approved' | 'denied') => {
    if (!selectedGuildId) return;
    try {
      await api.banAppeals.review(selectedGuildId, userId, status);
      addToast({ title: status === 'approved' ? 'Appeal approved' : 'Appeal denied', variant: status === 'approved' ? 'success' : 'info' });
      await refreshWorkspace(true);
    } catch {
      addToast({ title: `Failed to ${status === 'approved' ? 'approve' : 'deny'} appeal`, variant: 'error' });
    }
  }, [addToast, refreshWorkspace, selectedGuildId]);

  const cards = useMemo(() => [
    {
      label: 'Open reports',
      value: queueSummary.openReports,
      description: 'Fresh cases still waiting for a first pass.',
      icon: AlertTriangle,
      accent: 'var(--warning)',
    },
    {
      label: 'Under review',
      value: queueSummary.underReviewReports,
      description: 'Reports that already have a moderator actively working them.',
      icon: Clock3,
      accent: 'var(--accent-blue)',
    },
    {
      label: 'Visible appeals',
      value: queueSummary.visibleAppeals,
      description: selectedGuildId ? 'Pending ban appeals for the guild in focus.' : 'Pick a guild to inspect appeals.',
      icon: FileText,
      accent: 'var(--accent-purple)',
    },
    {
      label: 'Pending bot listings',
      value: queueSummary.pendingBots,
      description: 'Adjacent trust queue that still feeds into moderation operations.',
      icon: Bot,
      accent: 'var(--accent-primary)',
    },
  ], [queueSummary, selectedGuildId]);

  return (
    <div className="main-content-wrapper" style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-primary)' }}>
      <div style={{ maxWidth: '1160px', margin: '0 auto', padding: '48px 24px 64px', display: 'grid', gap: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'grid', gap: '10px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)', fontSize: '13px', fontWeight: 700 }}>
              <Sparkles size={14} />
              Moderation workspace
            </div>
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
              Unify the queue, the context, and the audit trail
            </h1>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6, maxWidth: '760px' }}>
              Start with the report queue, pull in guild-level moderator context, then close the case with an action history and appeal view that stays attached to the same workflow.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <Link to="/admin/reports" style={{ textDecoration: 'none', color: 'var(--accent-primary)', fontSize: '13px', fontWeight: 700 }}>
              Open full reports list
            </Link>
            <button
              onClick={() => void refreshWorkspace(true)}
              disabled={refreshing}
              style={{
                border: '1px solid var(--stroke)',
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                borderRadius: '12px',
                padding: '10px 14px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: refreshing ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
              Refresh
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {cards.map(({ label, value, description, icon: Icon, accent }) => (
            <div
              key={label}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--stroke)',
                borderRadius: '16px',
                padding: '18px',
                display: 'grid',
                gap: '10px',
              }}
            >
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${accent}22`, color: accent }}>
                <Icon size={18} />
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {label}
              </div>
              <div style={{ fontSize: '30px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {loading ? '—' : value}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {description}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.9fr) minmax(0, 1.1fr)', gap: '16px' }}>
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '16px', padding: '20px', display: 'grid', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={18} color="var(--accent-primary)" />
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Recommended moderation flow</h2>
            </div>
            {WORKFLOW_STEPS.map((step, index) => (
              <a
                key={step.title}
                href={step.href}
                style={{
                  textDecoration: 'none',
                  color: 'inherit',
                  display: 'grid',
                  gridTemplateColumns: '36px 1fr',
                  gap: '12px',
                  alignItems: 'start',
                  padding: '12px 0',
                  borderTop: index === 0 ? 'none' : '1px solid var(--stroke)',
                }}
              >
                <div style={{ width: '36px', height: '36px', borderRadius: '999px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${step.accent}22`, color: step.accent, fontWeight: 700 }}>
                  {index + 1}
                </div>
                <div style={{ display: 'grid', gap: '4px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{step.title}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{step.description}</div>
                </div>
              </a>
            ))}
          </div>

          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '16px', padding: '20px', display: 'grid', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} color="var(--accent-primary)" />
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Recent moderation activity</h2>
            </div>
            {recentModerationFeed.length === 0 && !loading ? (
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No moderation events have been logged yet.</div>
            ) : (
              recentModerationFeed.map((entry) => (
                <div key={entry.id} style={{ display: 'grid', gap: '4px', paddingBottom: '12px', borderBottom: '1px solid var(--stroke)' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{moderationLabel(entry)}</div>
                  {entry.description && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{entry.description}</div>}
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {entry.actor} · {formatRelative(entry.createdAt)}
                  </div>
                </div>
              ))
            )}
            <Link to="/admin/audit" style={{ color: 'var(--accent-primary)', fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>
              Open the full audit log
            </Link>
          </div>
        </div>

        <div id="report-queue" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.95fr) minmax(0, 1.05fr)', gap: '16px' }}>
          <section style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '18px', padding: '20px', display: 'grid', gap: '16px', minHeight: '620px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Report queue</h2>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Pick the next report, then keep the action and note attached to the same record.
                </p>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700 }}>{filteredReports.length} visible</span>
            </div>

            <div style={{ display: 'grid', gap: '12px' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  value={reportSearch}
                  onChange={(event) => setReportSearch(event.target.value)}
                  placeholder="Search reports, targets, reporters, or reasons"
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 38px',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--stroke)',
                    borderRadius: '12px',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <Filter size={14} color="var(--text-muted)" />
                {(['all', 'open', 'under_review', 'resolved', 'dismissed'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setReportStatusFilter(status)}
                    style={{
                      border: '1px solid',
                      borderColor: reportStatusFilter === status ? 'var(--accent-primary)' : 'var(--stroke)',
                      background: reportStatusFilter === status ? 'var(--accent-primary)' : 'transparent',
                      color: reportStatusFilter === status ? '#fff' : 'var(--text-secondary)',
                      borderRadius: '999px',
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {status === 'all' ? 'All' : STATUS_LABELS[status]}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gap: '12px', alignContent: 'start' }}>
              {loading ? (
                <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>Loading moderation queue…</div>
              ) : filteredReports.length === 0 ? (
                <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>No reports match the current filters.</div>
              ) : (
                filteredReports.map((report) => {
                  const badge = statusBadgeStyles(report.status);
                  const selected = report.id === selectedReport?.id;
                  return (
                    <button
                      key={report.id}
                      onClick={() => setSelectedReportId(report.id)}
                      style={{
                        textAlign: 'left',
                        border: selected ? '1px solid var(--accent-primary)' : '1px solid var(--stroke)',
                        background: selected ? 'rgba(99,102,241,0.08)' : 'var(--bg-primary)',
                        borderRadius: '16px',
                        padding: '16px',
                        display: 'grid',
                        gap: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'monospace' }}>#{report.id}</span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, background: badge.background, color: badge.color }}>
                              {STATUS_LABELS[report.status]}
                            </span>
                          </div>
                          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{report.targetName}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.5 }}>{report.targetPreview || report.reason}</div>
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatRelative(report.reportedDate)}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Avatar userId={report.reporterId || `reporter-${report.id}`} avatarHash={report.reporterAvatarHash} displayName={report.reporterName} size={28} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{report.reporterName}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{report.reporterUsername ? `@${report.reporterUsername}` : 'Reporter'}</div>
                        </div>
                        <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '999px', padding: '4px 8px' }}>
                          {report.reason}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <section style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '18px', padding: '20px', display: 'grid', gap: '18px', minHeight: '620px' }}>
            {!selectedReport ? (
              <div style={{ alignSelf: 'center', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                Pick a report to load moderator context.
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'grid', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>{selectedReport.targetName}</h2>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: statusBadgeStyles(selectedReport.status).color, background: statusBadgeStyles(selectedReport.status).background, borderRadius: '999px', padding: '4px 10px' }}>
                        {STATUS_LABELS[selectedReport.status]}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, maxWidth: '620px' }}>
                      {selectedReport.targetPreview || 'No extra target preview was captured for this report.'}
                    </div>
                  </div>

                  <Link to="/admin/reports" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--accent-primary)', fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>
                    Full report tools
                    <ExternalLink size={13} />
                  </Link>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '12px' }}>
                  <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--stroke)', borderRadius: '16px', padding: '16px', display: 'grid', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Avatar userId={selectedReport.reporterId || `reporter-${selectedReport.id}`} avatarHash={selectedReport.reporterAvatarHash} displayName={selectedReport.reporterName} size={36} />
                      <div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reporter</div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedReport.reporterName}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{selectedReport.reporterUsername ? `@${selectedReport.reporterUsername}` : 'Reporter handle unavailable'}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Submitted {formatDateTime(selectedReport.reportedDate)}</div>
                  </div>

                  <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--stroke)', borderRadius: '16px', padding: '16px', display: 'grid', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Avatar userId={selectedReport.subjectUserId ?? `target-${selectedReport.id}`} avatarHash={selectedReport.targetAvatarHash} displayName={selectedReport.targetName} size={36} />
                      <div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Target</div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedReport.targetName}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{selectedReport.targetType} report</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '999px', padding: '4px 10px' }}>
                        Reason: {selectedReport.reason}
                      </span>
                      {selectedReport.subjectGuildId && (
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '999px', padding: '4px 10px' }}>
                          Guild-linked context available
                        </span>
                      )}
                      {selectedAppeal && (
                        <span style={{ fontSize: '12px', color: 'var(--accent-purple)', background: 'rgba(139,92,246,0.12)', borderRadius: '999px', padding: '4px 10px' }}>
                          Appeal {selectedAppeal.appealStatus}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: '12px' }}>
                  <label htmlFor="moderation-note" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Moderator note attached to this action
                  </label>
                  <textarea
                    id="moderation-note"
                    value={noteDraft}
                    onChange={(event) => setNoteDraft(event.target.value)}
                    rows={4}
                    placeholder="Add the rationale or next step that should stay visible in audit history."
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '12px 14px',
                      borderRadius: '14px',
                      border: '1px solid var(--stroke)',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {ACTION_CHOICES.map((action) => (
                    <button
                      key={action.key}
                      onClick={() => void handleReportAction(action.key)}
                      disabled={reportActionLoading || selectedReport.status === action.key}
                      style={{
                        border: `1px solid ${action.tone}`,
                        background: selectedReport.status === action.key ? `${action.tone}22` : 'transparent',
                        color: action.tone,
                        borderRadius: '12px',
                        padding: '10px 14px',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: reportActionLoading || selectedReport.status === action.key ? 'not-allowed' : 'pointer',
                        opacity: reportActionLoading || selectedReport.status === action.key ? 0.55 : 1,
                      }}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'grid', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock3 size={16} color="var(--accent-primary)" />
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Case timeline</h3>
                  </div>
                  {reportHistory.length === 0 ? (
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No audit history has been logged for this report yet.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: '10px' }}>
                      {reportHistory.map((entry) => (
                        <div key={entry.id} style={{ background: 'var(--bg-primary)', border: '1px solid var(--stroke)', borderRadius: '14px', padding: '14px', display: 'grid', gap: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{moderationLabel(entry)}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatRelative(entry.createdAt)}</div>
                          </div>
                          {entry.description && <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{entry.description}</div>}
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{entry.actor}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </div>

        <div id="moderator-context" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px' }}>
          <section style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '18px', padding: '20px', display: 'grid', gap: '16px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Moderator context</h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                Pull warnings, ban state, and moderator notes into the same place you triage the report.
              </p>
            </div>

            <div style={{ display: 'grid', gap: '12px' }}>
              <label htmlFor="workspace-guild" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Guild context
              </label>
              <select
                id="workspace-guild"
                value={selectedGuildId}
                onChange={(event) => setSelectedGuildId(event.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--stroke)',
                  borderRadius: '12px',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                }}
              >
                <option value="">Select a guild…</option>
                {guilds.map((guild) => (
                  <option key={guild.id} value={guild.id}>{guild.name}</option>
                ))}
              </select>
            </div>

            {!selectedReport?.subjectUserId ? (
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                This report does not expose a specific user target, so guild-level moderator notes and warning history are unavailable.
              </div>
            ) : contextLoading ? (
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading moderator context…</div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }}>
                  <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--stroke)', borderRadius: '14px', padding: '14px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Warnings</div>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '8px' }}>{warningHistory.length}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Recorded in this guild</div>
                  </div>
                  <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--stroke)', borderRadius: '14px', padding: '14px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ban state</div>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: banHistory.length > 0 ? 'var(--error)' : 'var(--success)', marginTop: '8px' }}>{banHistory.length > 0 ? 'Banned' : 'Clear'}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>{banHistory[0]?.reason ?? 'No active guild ban found'}</div>
                  </div>
                  <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--stroke)', borderRadius: '14px', padding: '14px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Appeal status</div>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: selectedAppeal?.appealStatus === 'pending' ? 'var(--accent-purple)' : 'var(--text-primary)', marginTop: '8px', textTransform: 'capitalize' }}>
                      {selectedAppeal?.appealStatus ?? 'None'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      {selectedAppeal ? `Filed ${formatRelative(selectedAppeal.appealSubmittedAt)}` : 'No visible appeal for this user in the selected guild'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: '10px' }}>
                  <label htmlFor="guild-mod-note" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Guild moderator note
                  </label>
                  <textarea
                    id="guild-mod-note"
                    value={modNote}
                    onChange={(event) => setModNote(event.target.value)}
                    rows={4}
                    placeholder="Private guild note for moderators"
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '12px 14px',
                      borderRadius: '14px',
                      border: '1px solid var(--stroke)',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Use this to keep future moderators in the same context.</div>
                    <button
                      onClick={() => void handleSaveModNote()}
                      disabled={modNoteSaving || !selectedGuildId}
                      style={{
                        border: '1px solid var(--accent-primary)',
                        background: 'var(--accent-primary)',
                        color: '#fff',
                        borderRadius: '12px',
                        padding: '10px 14px',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: modNoteSaving || !selectedGuildId ? 'not-allowed' : 'pointer',
                        opacity: modNoteSaving || !selectedGuildId ? 0.55 : 1,
                      }}
                    >
                      {modNoteSaving ? 'Saving…' : 'Save note'}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Incident history</h3>
                  {warningHistory.length === 0 && banHistory.length === 0 ? (
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No warnings or active bans are recorded for this user in the selected guild.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: '10px' }}>
                      {banHistory.map((ban) => (
                        <div key={`${ban.userId}-ban`} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '14px', padding: '14px', display: 'grid', gap: '4px' }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--error)' }}>Active ban</div>
                          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{ban.reason ?? 'No ban reason recorded.'}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{formatDateTime(ban.bannedAt)}</div>
                        </div>
                      ))}
                      {warningHistory.map((warning) => (
                        <div key={warning.id} style={{ background: 'var(--bg-primary)', border: '1px solid var(--stroke)', borderRadius: '14px', padding: '14px', display: 'grid', gap: '4px' }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Warning</div>
                          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{warning.reason}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{formatDateTime(warning.createdAt)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </section>

          <section id="appeals-and-history" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '18px', padding: '20px', display: 'grid', gap: '16px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Appeals and action visibility</h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                Keep the ban appeal queue and the last decisions next to the report flow instead of hidden in separate utilities.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {(['pending', 'all'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setAppealFilter(filter)}
                    style={{
                      border: '1px solid',
                      borderColor: appealFilter === filter ? 'var(--accent-primary)' : 'var(--stroke)',
                      background: appealFilter === filter ? 'var(--accent-primary)' : 'transparent',
                      color: appealFilter === filter ? '#fff' : 'var(--text-secondary)',
                      borderRadius: '999px',
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {filter === 'pending' ? 'Pending only' : 'All visible'}
                  </button>
                ))}
              </div>
              {selectedGuildId ? (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Guild in focus: {guilds.find((guild) => guild.id === selectedGuildId)?.name ?? 'Unknown guild'}</div>
              ) : (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Pick a guild to inspect appeals.</div>
              )}
            </div>

            <div style={{ display: 'grid', gap: '12px' }}>
              {appealsLoading ? (
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading appeals…</div>
              ) : appealError ? (
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>{appealError}</div>
              ) : appeals.length === 0 ? (
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No appeals match the current guild and filter.</div>
              ) : (
                appeals.map((appeal) => (
                  <div key={appeal.id} style={{ background: selectedAppeal?.id === appeal.id ? 'rgba(99,102,241,0.08)' : 'var(--bg-primary)', border: selectedAppeal?.id === appeal.id ? '1px solid var(--accent-primary)' : '1px solid var(--stroke)', borderRadius: '16px', padding: '16px', display: 'grid', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <Avatar userId={appeal.userId} avatarHash={appeal.avatarHash} displayName={appeal.displayName} size={34} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{appeal.displayName}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>@{appeal.username}</div>
                        </div>
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: appeal.appealStatus === 'pending' ? 'var(--accent-purple)' : appeal.appealStatus === 'approved' ? 'var(--success)' : 'var(--text-secondary)', background: appeal.appealStatus === 'pending' ? 'rgba(139,92,246,0.12)' : appeal.appealStatus === 'approved' ? 'rgba(34,197,94,0.12)' : 'rgba(100,116,139,0.14)', borderRadius: '999px', padding: '4px 10px' }}>
                        {appeal.appealStatus ?? 'Unknown'}
                      </span>
                    </div>

                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{appeal.appealText ?? 'No appeal message captured.'}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Submitted {formatDateTime(appeal.appealSubmittedAt)}
                      {appeal.reviewedByName ? ` · Reviewed by ${appeal.reviewedByName}` : ''}
                    </div>
                    {appeal.reason && <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Original ban reason: {appeal.reason}</div>}

                    {appeal.appealStatus === 'pending' && (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => void handleAppealReview(appeal.userId, 'approved')}
                          style={{ border: '1px solid var(--success)', background: 'transparent', color: 'var(--success)', borderRadius: '12px', padding: '8px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                          <CheckCircle2 size={14} />
                          Approve
                        </button>
                        <button
                          onClick={() => void handleAppealReview(appeal.userId, 'denied')}
                          style={{ border: '1px solid var(--error)', background: 'transparent', color: 'var(--error)', borderRadius: '12px', padding: '8px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                          <XCircle size={14} />
                          Deny
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'grid', gap: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Recent appeal decisions</h3>
              {recentAppealDecisions.length === 0 ? (
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No recent appeal decisions are visible for the current guild scope.</div>
              ) : (
                recentAppealDecisions.map((entry) => (
                  <div key={entry.id} style={{ background: 'var(--bg-primary)', border: '1px solid var(--stroke)', borderRadius: '14px', padding: '14px', display: 'grid', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{moderationLabel(entry)}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatRelative(entry.createdAt)}</div>
                    </div>
                    {entry.description && <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{entry.description}</div>}
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{entry.actor}</div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
