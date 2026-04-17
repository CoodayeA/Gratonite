import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Bot, FileText, Shield, Sparkles } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../components/ui/ToastManager';

type ReportStatus = 'open' | 'under_review' | 'resolved' | 'dismissed';
type BotStatus = 'pending' | 'approved' | 'rejected';

type QueueSummary = {
  openReports: number;
  underReviewReports: number;
  pendingBots: number;
  recentAudit: Array<{ id: string; action: string; actor: string; createdAt: string }>;
};

const WORKFLOW_STEPS = [
  {
    title: 'Triage reports',
    description: 'Start with open reports, confirm target type, and attach the right moderator note before acting.',
    href: '/admin/reports',
    accent: 'var(--warning)',
  },
  {
    title: 'Check action history',
    description: 'Use the audit log to confirm whether the same user, guild, or listing has already been reviewed.',
    href: '/admin/audit',
    accent: 'var(--accent-purple)',
  },
  {
    title: 'Resolve adjacent queues',
    description: 'If the incident touches bots or federated abuse, finish the handoff from the same workspace instead of bouncing around.',
    href: '/admin/bot-moderation',
    accent: 'var(--accent-blue)',
  },
];

function formatRelative(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(1, Math.floor(ms / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AdminModerationWorkspace() {
  const { addToast } = useToast();
  const [summary, setSummary] = useState<QueueSummary>({
    openReports: 0,
    underReviewReports: 0,
    pendingBots: 0,
    recentAudit: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [reportsResponse, botsResponse, auditResponse] = await Promise.all([
          api.reports.list({ limit: 200 }),
          api.adminBotStore.list({ limit: 200 }),
          api.adminAudit.list({ limit: 20 }),
        ]);

        if (cancelled) return;

        const reports = (Array.isArray(reportsResponse) ? reportsResponse : (reportsResponse as any)?.items ?? []) as Array<{ status?: ReportStatus }>;
        const bots = (Array.isArray(botsResponse) ? botsResponse : (botsResponse as any)?.items ?? []) as Array<{ status?: BotStatus }>;
        const audit = (Array.isArray(auditResponse) ? auditResponse : (auditResponse as any)?.items ?? []) as Array<{ id?: string; action?: string; actor?: string; createdAt?: string; timestamp?: string }>;

        setSummary({
          openReports: reports.filter((report) => report.status === 'open').length,
          underReviewReports: reports.filter((report) => report.status === 'under_review').length,
          pendingBots: bots.filter((bot) => bot.status === 'pending').length,
          recentAudit: audit.slice(0, 6).map((entry, index) => ({
            id: entry.id ?? `audit-${index}`,
            action: entry.action ?? 'Moderation event',
            actor: entry.actor ?? 'system',
            createdAt: entry.createdAt ?? entry.timestamp ?? new Date().toISOString(),
          })),
        });
      } catch {
        if (!cancelled) {
          addToast({ title: 'Failed to load moderation workspace', variant: 'error' });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [addToast]);

  const cards = useMemo(() => [
    {
      label: 'Open reports',
      value: summary.openReports,
      description: 'Fresh items that still need a first pass.',
      icon: AlertTriangle,
      href: '/admin/reports',
      accent: 'var(--warning)',
    },
    {
      label: 'Under review',
      value: summary.underReviewReports,
      description: 'Cases already being worked but not closed.',
      icon: Shield,
      href: '/admin/reports',
      accent: 'var(--accent-blue)',
    },
    {
      label: 'Pending bot listings',
      value: summary.pendingBots,
      description: 'Listings that still need moderation before they go live.',
      icon: Bot,
      href: '/admin/bot-moderation',
      accent: 'var(--accent-purple)',
    },
  ], [summary]);

  return (
    <div className="main-content-wrapper" style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-primary)' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '48px 24px', display: 'grid', gap: '24px' }}>
        <div style={{ display: 'grid', gap: '10px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)', fontSize: '13px', fontWeight: 700 }}>
            <Sparkles size={14} />
            Moderation workspace
          </div>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
            One place to triage, act, and double-check your history
          </h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
            Start with the queue, confirm the history, then move into the specific tool you need without losing context.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {cards.map(({ label, value, description, icon: Icon, href, accent }) => (
            <Link
              key={label}
              to={href}
              style={{
                textDecoration: 'none',
                color: 'inherit',
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
            </Link>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 0.9fr)', gap: '16px' }}>
          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '16px', padding: '20px', display: 'grid', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={18} color="var(--accent-primary)" />
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Recommended moderation flow</h2>
            </div>
            {WORKFLOW_STEPS.map((step, index) => (
              <Link
                key={step.title}
                to={step.href}
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
              </Link>
            ))}
          </div>

          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '16px', padding: '20px', display: 'grid', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} color="var(--accent-primary)" />
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Recent action history</h2>
            </div>
            {summary.recentAudit.length === 0 && !loading ? (
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                No recent audit activity was returned.
              </div>
            ) : (
              summary.recentAudit.map((entry) => (
                <div key={entry.id} style={{ display: 'grid', gap: '4px', paddingBottom: '12px', borderBottom: '1px solid var(--stroke)' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{entry.action}</div>
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
      </div>
    </div>
  );
}
