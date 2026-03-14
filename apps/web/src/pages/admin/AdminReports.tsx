import { useState, useEffect } from 'react';
import {
  Flag,
  CheckCircle2,
  Clock,
  XCircle,
  Search,
  Filter,
  AlertTriangle,
  User,
  MessageSquare,
  Shield,
  Eye,
  Ban,
} from 'lucide-react';
import { useToast } from '../../components/ui/ToastManager';
import { api } from '../../lib/api';

type ReportStatus = 'open' | 'under_review' | 'resolved' | 'dismissed';
type TargetType = 'message' | 'user' | 'guild';
type Priority = 'high' | 'medium' | 'low';
type ReportReason = 'Harassment' | 'Spam' | 'NSFW' | 'Impersonation' | 'Other';

interface Report {
  id: string;
  targetType: TargetType;
  reason: ReportReason;
  reporter: string;
  details: string;
  reportedDate: string;
  status: ReportStatus;
  priority: Priority;
  targetName: string;
}



const STATUS_LABELS: Record<ReportStatus, string> = {
  open: 'Open',
  under_review: 'Under Review',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
};

const ACTION_OPTIONS = [
  { key: 'warn', label: 'Warn User', icon: AlertTriangle, color: 'var(--warning)' },
  { key: 'mute', label: 'Mute User', icon: Clock, color: 'var(--accent-blue)' },
  { key: 'ban', label: 'Ban User', icon: Ban, color: 'var(--error)' },
  { key: 'delete', label: 'Delete Content', icon: XCircle, color: 'var(--error)' },
  { key: 'escalate', label: 'Escalate', icon: Shield, color: 'var(--accent-purple)' },
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function TargetBadge({ type }: { type: TargetType }) {
  const config: Record<TargetType, { label: string; color: string; bg: string; Icon: any }> = {
    message: { label: 'Message', color: 'var(--accent-blue)', bg: 'rgba(59,130,246,0.12)', Icon: MessageSquare },
    user: { label: 'User', color: 'var(--accent-purple)', bg: 'rgba(139,92,246,0.12)', Icon: User },
    guild: { label: 'Guild', color: 'var(--success)', bg: 'rgba(34,197,94,0.12)', Icon: Shield },
  };
  const { label, color, bg, Icon } = config[type];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: 'var(--radius-sm)',
        background: bg,
        color,
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.02em',
      }}
    >
      <Icon size={11} />
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: ReportStatus }) {
  const config: Record<ReportStatus, { color: string; bg: string }> = {
    open: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    under_review: { color: 'var(--accent-blue)', bg: 'rgba(59,130,246,0.12)' },
    resolved: { color: 'var(--success)', bg: 'rgba(34,197,94,0.12)' },
    dismissed: { color: 'var(--text-muted)', bg: 'rgba(100,116,139,0.12)' },
  };
  const { color, bg } = config[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: 'var(--radius-sm)',
        background: bg,
        color,
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.03em',
      }}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function PriorityDot({ priority }: { priority: Priority }) {
  const colors: Record<Priority, string> = {
    high: 'var(--error)',
    medium: '#f59e0b',
    low: 'var(--text-muted)',
  };
  return (
    <span
      title={`${priority.charAt(0).toUpperCase() + priority.slice(1)} Priority`}
      style={{
        display: 'inline-block',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: colors[priority],
        flexShrink: 0,
      }}
    />
  );
}

export default function AdminReports() {
  const { addToast } = useToast();
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ReportStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | TargetType>('all');
  const [expandedAction, setExpandedAction] = useState<string | null>(null);
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    api.reports.list({ limit: 200 }).then(res => {
      const raw: any[] = Array.isArray(res) ? res : ((res as any).items ?? []) as any[];
      const priorityMap: Record<string, Priority> = { high: 'high', medium: 'medium', low: 'low' };
      setReports(raw.flatMap((r: any) => {
        const id = typeof r.id === 'string' && r.id.trim().length > 0 ? r.id : null;
        if (!id) return [];
        return [{
        id,
        targetType: (['message', 'user', 'guild'].includes(r.targetType) ? r.targetType : 'message') as TargetType,
        reason: r.reason ?? 'Other',
        reporter: r.reporterName ?? r.reporter ?? 'Unknown',
        details: r.details ?? r.description ?? '',
        reportedDate: r.createdAt ?? r.reportedDate ?? new Date().toISOString(),
        status: (['open', 'under_review', 'resolved', 'dismissed'].includes(r.status) ? r.status : 'open') as ReportStatus,
        priority: priorityMap[r.priority] ?? 'medium',
        targetName: r.targetName ?? r.targetId ?? '',
      }];
    }));
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to load reports';
      setError(msg);
      addToast({ title: 'Failed to load reports', variant: 'error' });
    }).finally(() => {
      setIsLoading(false);
    });
  }, []);

  const stats = {
    total: reports.length,
    open: reports.filter(r => r.status === 'open').length,
    under_review: reports.filter(r => r.status === 'under_review').length,
    resolved: reports.filter(r => r.status === 'resolved').length,
    dismissed: reports.filter(r => r.status === 'dismissed').length,
  };

  const filtered = reports.filter(r => {
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesType = typeFilter === 'all' || r.targetType === typeFilter;
    const matchesSearch =
      search === '' ||
      r.id.toLowerCase().includes(search.toLowerCase()) ||
      r.reporter.toLowerCase().includes(search.toLowerCase()) ||
      r.reason.toLowerCase().includes(search.toLowerCase()) ||
      r.targetName.toLowerCase().includes(search.toLowerCase()) ||
      r.details.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesType && matchesSearch;
  });

  function handleDismiss(reportId: string) {
    setReports(prev =>
      prev.map(r => (r.id === reportId ? { ...r, status: 'dismissed' as ReportStatus } : r))
    );
    setExpandedAction(null);
    api.reports.updateStatus(reportId, { status: 'dismissed' }).catch(() => { addToast({ title: 'Failed to dismiss report', variant: 'error' }); });
    addToast({ title: `Report #${reportId} dismissed.`, variant: 'info' });
  }

  function handleAction(reportId: string, actionKey: string) {
    const actionLabel = ACTION_OPTIONS.find(a => a.key === actionKey)?.label ?? actionKey;
    setReports(prev =>
      prev.map(r => (r.id === reportId ? { ...r, status: 'resolved' as ReportStatus } : r))
    );
    setExpandedAction(null);
    api.reports.updateStatus(reportId, { status: 'resolved', adminNotes: `Action taken: ${actionLabel}` }).catch(() => { addToast({ title: 'Failed to apply action', variant: 'error' }); });
    const messages: Record<string, string> = {
      warn: `User warned for report #${reportId}.`,
      mute: `User muted for report #${reportId}.`,
      ban: `User banned for report #${reportId}.`,
      delete: `Content deleted for report #${reportId}.`,
      escalate: `Report #${reportId} escalated to senior admins.`,
    };
    addToast({ title: messages[actionKey] ?? `${actionLabel} applied to #${reportId}.`, variant: actionKey === 'ban' ? 'error' : 'success' });
  }

  const statusTabs: Array<{ key: 'all' | ReportStatus; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'open', label: 'Open' },
    { key: 'under_review', label: 'Under Review' },
    { key: 'resolved', label: 'Resolved' },
    { key: 'dismissed', label: 'Dismissed' },
  ];

  const typeTabs: Array<{ key: 'all' | TargetType; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'message', label: 'Message' },
    { key: 'user', label: 'User' },
    { key: 'guild', label: 'Guild' },
  ];

  if (isLoading) {
    return (
      <div className="main-content-wrapper" style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading reports…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="main-content-wrapper" style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--error)', fontSize: '14px' }}>{error}</div>
      </div>
    );
  }

  return (
    <div className="main-content-wrapper" style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-primary)' }}>
      <div className="content-padding" style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 24px', width: '100%' }}>

        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(239,68,68,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Flag size={18} color="var(--error)" />
            </div>
            <h1
              style={{
                fontSize: '24px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-display)',
                margin: 0,
              }}
            >
              Content Reports
            </h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0, paddingLeft: '48px' }}>
            Review reported content across the platform
          </p>
        </div>

        {/* Stats Row */}
        <div
          className="grid-mobile-2"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '12px',
            marginBottom: '28px',
          }}
        >
          {[
            { label: 'Total Reports', value: stats.total, color: 'var(--text-primary)', Icon: Flag },
            { label: 'Open', value: stats.open, color: '#f59e0b', Icon: AlertTriangle },
            { label: 'Under Review', value: stats.under_review, color: 'var(--accent-blue)', Icon: Clock },
            { label: 'Resolved', value: stats.resolved, color: 'var(--success)', Icon: CheckCircle2 },
            { label: 'Dismissed', value: stats.dismissed, color: 'var(--text-muted)', Icon: XCircle },
          ].map(({ label, value, color, Icon }) => (
            <div
              key={label}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--stroke)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
                <Icon size={14} color={color} />
              </div>
              <span style={{ fontSize: '24px', fontWeight: 700, color, lineHeight: 1 }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Search + Filters */}
        <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search
              size={16}
              color="var(--text-muted)"
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            />
            <input
              type="text"
              placeholder="Search by ID, reporter, reason, or target..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px 10px 38px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--stroke)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Status Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <Filter size={14} color="var(--text-muted)" style={{ marginRight: '4px' }} />
            {statusTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid',
                  borderColor: statusFilter === tab.key ? 'var(--accent-primary)' : 'var(--stroke)',
                  background: statusFilter === tab.key ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                  color: statusFilter === tab.key ? '#fff' : 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            ))}

            <div style={{ width: '1px', height: '20px', background: 'var(--stroke)', margin: '0 4px' }} />

            {typeTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setTypeFilter(tab.key)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid',
                  borderColor: typeFilter === tab.key ? 'var(--accent-blue)' : 'var(--stroke)',
                  background: typeFilter === tab.key ? 'rgba(59,130,246,0.15)' : 'var(--bg-elevated)',
                  color: typeFilter === tab.key ? 'var(--accent-blue)' : 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Report Count */}
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px', margin: '0 0 16px 0' }}>
          {filtered.length} report{filtered.length !== 1 ? 's' : ''} found
        </p>

        {/* Report List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.length === 0 && (
            <div
              style={{
                padding: '48px 24px',
                textAlign: 'center',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--stroke)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-muted)',
                fontSize: '14px',
              }}
            >
              No reports match your current filters.
            </div>
          )}

          {filtered.map(report => (
            <div
              key={report.id}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--stroke)',
                borderRadius: 'var(--radius-md)',
                padding: '18px 20px',
                boxShadow: 'var(--shadow-panel)',
              }}
            >
              {/* Top Row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                <PriorityDot priority={report.priority} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        fontFamily: 'monospace',
                      }}
                    >
                      #{report.id}
                    </span>
                    <TargetBadge type={report.targetType} />
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        background: 'var(--bg-tertiary)',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--stroke)',
                      }}
                    >
                      {report.reason}
                    </span>
                    <StatusBadge status={report.status} />
                  </div>

                  <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '4px' }}>
                    {report.targetName}
                  </div>

                  <p
                    style={{
                      fontSize: '13px',
                      color: 'var(--text-secondary)',
                      margin: 0,
                      lineHeight: 1.5,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {report.details}
                  </p>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>
                    Reported by
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                    {report.reporter}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {formatDate(report.reportedDate)}
                  </div>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '12px', borderTop: '1px solid var(--stroke)' }}>
                <button
                  onClick={() =>
                    setExpandedAction(expandedAction === report.id ? null : report.id)
                  }
                  onMouseEnter={() => setHoveredBtn(`action-${report.id}`)}
                  onMouseLeave={() => setHoveredBtn(null)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--accent-primary)',
                    background: hoveredBtn === `action-${report.id}` ? 'var(--accent-primary)' : 'transparent',
                    color: hoveredBtn === `action-${report.id}` ? '#fff' : 'var(--accent-primary)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <Shield size={13} />
                  Take Action
                </button>

                <button
                  onClick={() => handleDismiss(report.id)}
                  onMouseEnter={() => setHoveredBtn(`dismiss-${report.id}`)}
                  onMouseLeave={() => setHoveredBtn(null)}
                  disabled={report.status === 'dismissed'}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--stroke)',
                    background: hoveredBtn === `dismiss-${report.id}` ? 'var(--bg-tertiary)' : 'transparent',
                    color: report.status === 'dismissed' ? 'var(--text-muted)' : 'var(--text-secondary)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: report.status === 'dismissed' ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    opacity: report.status === 'dismissed' ? 0.5 : 1,
                  }}
                >
                  <XCircle size={13} />
                  Dismiss
                </button>

                <button
                  onMouseEnter={() => setHoveredBtn(`view-${report.id}`)}
                  onMouseLeave={() => setHoveredBtn(null)}
                  onClick={() => addToast({ title: `Viewing target: ${report.targetName}`, variant: 'info' })}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--stroke)',
                    background: hoveredBtn === `view-${report.id}` ? 'var(--bg-tertiary)' : 'transparent',
                    color: 'var(--text-secondary)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <Eye size={13} />
                  View Target
                </button>

                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <PriorityDot priority={report.priority} />
                  {report.priority.charAt(0).toUpperCase() + report.priority.slice(1)} Priority
                </span>
              </div>

              {/* Inline Action Panel */}
              {expandedAction === report.id && (
                <div
                  style={{
                    marginTop: '12px',
                    padding: '14px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--stroke)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <p
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      marginBottom: '10px',
                      margin: '0 0 10px 0',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Resolution Options
                  </p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {ACTION_OPTIONS.map(({ key, label, icon: Icon, color }) => (
                      <button
                        key={key}
                        onClick={() => handleAction(report.id, key)}
                        onMouseEnter={() => setHoveredBtn(`opt-${report.id}-${key}`)}
                        onMouseLeave={() => setHoveredBtn(null)}
                        style={{
                          padding: '7px 14px',
                          borderRadius: 'var(--radius-sm)',
                          border: `1px solid ${color}`,
                          background: hoveredBtn === `opt-${report.id}-${key}` ? color : 'transparent',
                          color: hoveredBtn === `opt-${report.id}-${key}` ? '#fff' : color,
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
                        <Icon size={13} />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
