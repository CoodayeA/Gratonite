import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type BetaBugReportInboxItem } from '@/lib/api';
import { formatTimestamp, getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/auth.store';

type BugStatus = 'open' | 'triaged' | 'resolved' | 'dismissed';

const STATUS_OPTIONS: BugStatus[] = ['open', 'triaged', 'resolved', 'dismissed'];

const STATUS_COLORS: Record<BugStatus, string> = {
  open: '#ffd58f',
  triaged: '#9fd3ff',
  resolved: '#9ff0b5',
  dismissed: '#c8ccd6',
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = {
  page: {
    padding: '1.25rem',
    display: 'grid',
    gap: '1rem',
    height: '100%',
    minHeight: 0,
    overflowY: 'auto',
    overscrollBehavior: 'contain',
  } as React.CSSProperties,

  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap',
  } as React.CSSProperties,

  title: {
    margin: 0,
    fontSize: '1.35rem',
    fontWeight: 700,
  } as React.CSSProperties,

  muted: {
    margin: '0.35rem 0 0',
    color: 'var(--text-muted)',
  } as React.CSSProperties,

  actions: {
    display: 'flex',
    alignItems: 'end',
    gap: '0.5rem',
    flexWrap: 'wrap',
  } as React.CSSProperties,

  filter: {
    display: 'grid',
    gap: '0.25rem',
    minWidth: '9rem',
    color: 'var(--text-muted)',
    fontSize: '0.82rem',
  } as React.CSSProperties,

  select: {
    background: 'var(--bg-float)',
    border: '1px solid var(--stroke)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text)',
    padding: '6px 10px',
    fontFamily: 'inherit',
    fontSize: 13,
  } as React.CSSProperties,

  error: {
    border: '1px solid color-mix(in srgb, var(--danger) 28%, transparent)',
    background: 'var(--danger-bg)',
    color: 'var(--text)',
    padding: '0.75rem 0.9rem',
    borderRadius: 'var(--radius-lg)',
  } as React.CSSProperties,

  list: {
    display: 'grid',
    gap: '0.9rem',
  } as React.CSSProperties,

  card: {
    border: '1px solid var(--stroke)',
    background: 'color-mix(in srgb, var(--surface-2) 92%, transparent)',
    borderRadius: 'var(--radius-lg)',
    padding: '0.95rem',
    display: 'grid',
    gap: '0.75rem',
  } as React.CSSProperties,

  cardHead: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '0.75rem',
    alignItems: 'flex-start',
  } as React.CSSProperties,

  cardTitle: {
    fontWeight: 700,
    lineHeight: 1.2,
  } as React.CSSProperties,

  cardMeta: {
    color: 'var(--text-muted)',
    fontSize: '0.82rem',
    marginTop: '0.3rem',
    wordBreak: 'break-word',
  } as React.CSSProperties,

  status: {
    borderRadius: 'var(--radius-pill)',
    padding: '0.2rem 0.65rem',
    fontSize: '0.78rem',
    textTransform: 'capitalize',
    border: '1px solid var(--stroke)',
    background: 'color-mix(in srgb, var(--surface-3) 85%, transparent)',
  } as React.CSSProperties,

  summary: {
    margin: 0,
    color: 'var(--text-primary)',
    whiteSpace: 'pre-wrap',
  } as React.CSSProperties,

  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '0.45rem 0.75rem',
    color: 'var(--text-muted)',
    fontSize: '0.82rem',
  } as React.CSSProperties,

  sections: {
    display: 'grid',
    gap: '0.65rem',
  } as React.CSSProperties,

  sectionLabel: {
    color: 'var(--text-muted)',
    fontSize: '0.78rem',
    marginBottom: '0.25rem',
  } as React.CSSProperties,

  pre: {
    margin: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--stroke)',
    background: 'color-mix(in srgb, var(--surface-3) 86%, transparent)',
    padding: '0.6rem',
    fontSize: '0.82rem',
  } as React.CSSProperties,

  cardFoot: {
    display: 'flex',
    gap: '0.65rem',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
  } as React.CSSProperties,

  link: {
    color: 'var(--text-link)',
    textDecoration: 'none',
  } as React.CSSProperties,

  statusActions: {
    display: 'flex',
    gap: '0.35rem',
    flexWrap: 'wrap',
  } as React.CSSProperties,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BugInboxPage() {
  const user = useAuthStore((st) => st.user);
  const [items, setItems] = useState<BetaBugReportInboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<BugStatus | 'all'>('open');
  const [adminView, setAdminView] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.bugReports.list({
        status: statusFilter === 'all' ? undefined : statusFilter,
        limit: 100,
      });
      setItems(response.items);
      setAdminView(response.adminView);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleStatusChange(reportId: string, status: BugStatus) {
    setUpdatingId(reportId);
    setError('');
    try {
      const updated = await api.bugReports.updateStatus(reportId, status);
      setItems((prev) =>
        prev.map((item) => (item.id === reportId ? { ...item, status: updated.status, updatedAt: updated.updatedAt } : item)),
      );
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Bug Inbox</h1>
          <p style={s.muted}>Review and triage tester reports from the in-app bug modal.</p>
        </div>
        <div style={s.actions}>
          <label style={s.filter}>
            <span>Status</span>
            <select
              style={s.select}
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as BugStatus | 'all')}
            >
              <option value="all">All</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>
          <Button variant="ghost" onClick={load} disabled={loading}>Refresh</Button>
          <Link to="/settings"><Button variant="ghost">Settings</Button></Link>
          <Link to="/"><Button>App</Button></Link>
        </div>
      </div>

      {!adminView && !loading && (
        <div style={s.error}>
          Bug inbox admin access is not enabled for this account. Configure `BUG_REPORT_ADMIN_USERNAMES` or `BUG_REPORT_ADMIN_USER_IDS`.
        </div>
      )}
      {error && <div style={s.error}>{error}</div>}

      {loading ? (
        <div style={s.muted}>Loading reports...</div>
      ) : items.length === 0 ? (
        <div style={s.muted}>No reports found for this filter.</div>
      ) : (
        <div style={s.list}>
          {items.map((item) => (
            <article key={item.id} style={s.card}>
              <div style={s.cardHead}>
                <div>
                  <div style={s.cardTitle}>{item.title}</div>
                  <div style={s.cardMeta}>
                    {item.reporterProfile?.displayName ?? item.reporterId} &bull; {formatTimestamp(item.createdAt)} &bull; {item.id}
                  </div>
                </div>
                <div style={{ ...s.status, color: STATUS_COLORS[item.status as BugStatus] ?? 'var(--text-muted)' }}>
                  {item.status}
                </div>
              </div>

              <p style={s.summary}>{item.summary}</p>

              <div style={s.grid}>
                <div><strong>Route:</strong> {item.route ?? 'n/a'}</div>
                <div><strong>Channel:</strong> {item.channelLabel ?? 'n/a'}</div>
                <div><strong>Viewport:</strong> {item.viewport ?? 'n/a'}</div>
                <div><strong>User Agent:</strong> {item.userAgent ?? 'n/a'}</div>
              </div>

              {(item.steps || item.expected || item.actual) && (
                <div style={s.sections}>
                  {item.steps && (
                    <div>
                      <div style={s.sectionLabel}>Steps</div>
                      <pre style={s.pre}>{item.steps}</pre>
                    </div>
                  )}
                  {item.expected && (
                    <div>
                      <div style={s.sectionLabel}>Expected</div>
                      <pre style={s.pre}>{item.expected}</pre>
                    </div>
                  )}
                  {item.actual && (
                    <div>
                      <div style={s.sectionLabel}>Actual</div>
                      <pre style={s.pre}>{item.actual}</pre>
                    </div>
                  )}
                </div>
              )}

              <div style={s.cardFoot}>
                <a
                  href={item.pageUrl ?? '#'}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    ...s.link,
                    ...(hoveredLink === item.id ? { textDecoration: 'underline' } : {}),
                  }}
                  onMouseEnter={() => setHoveredLink(item.id)}
                  onMouseLeave={() => setHoveredLink(null)}
                >
                  {item.pageUrl ? 'Open reported page' : 'No page URL'}
                </a>
                <div style={s.statusActions}>
                  {STATUS_OPTIONS.map((status) => (
                    <Button
                      key={status}
                      size="sm"
                      variant={item.status === status ? 'primary' : 'ghost'}
                      disabled={!adminView || updatingId === item.id}
                      onClick={() => handleStatusChange(item.id, status)}
                    >
                      {status}
                    </Button>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
