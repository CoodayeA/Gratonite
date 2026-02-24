import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type BetaBugReportInboxItem } from '@/lib/api';
import { formatTimestamp, getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/auth.store';

type BugStatus = 'open' | 'triaged' | 'resolved' | 'dismissed';

const STATUS_OPTIONS: BugStatus[] = ['open', 'triaged', 'resolved', 'dismissed'];

export function BugInboxPage() {
  const user = useAuthStore((s) => s.user);
  const [items, setItems] = useState<BetaBugReportInboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<BugStatus | 'all'>('open');
  const [adminView, setAdminView] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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
    <div className="bug-inbox-page">
      <div className="bug-inbox-header">
        <div>
          <h1 className="bug-inbox-title">Bug Inbox</h1>
          <p className="bug-inbox-muted">Review and triage tester reports from the in-app bug modal.</p>
        </div>
        <div className="bug-inbox-actions">
          <label className="bug-inbox-filter">
            <span>Status</span>
            <select
              className="settings-select"
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
        <div className="bug-inbox-error">
          Bug inbox admin access is not enabled for this account. Configure `BUG_REPORT_ADMIN_USERNAMES` or `BUG_REPORT_ADMIN_USER_IDS`.
        </div>
      )}
      {error && <div className="bug-inbox-error">{error}</div>}

      {loading ? (
        <div className="bug-inbox-muted">Loading reports...</div>
      ) : items.length === 0 ? (
        <div className="bug-inbox-muted">No reports found for this filter.</div>
      ) : (
        <div className="bug-inbox-list">
          {items.map((item) => (
            <article key={item.id} className="bug-inbox-card">
              <div className="bug-inbox-card-head">
                <div>
                  <div className="bug-inbox-card-title">{item.title}</div>
                  <div className="bug-inbox-card-meta">
                    {item.reporterProfile?.displayName ?? item.reporterId} • {formatTimestamp(item.createdAt)} • {item.id}
                  </div>
                </div>
                <div className={`bug-inbox-status bug-inbox-status-${item.status}`}>{item.status}</div>
              </div>

              <p className="bug-inbox-summary">{item.summary}</p>

              <div className="bug-inbox-grid">
                <div><strong>Route:</strong> {item.route ?? 'n/a'}</div>
                <div><strong>Channel:</strong> {item.channelLabel ?? 'n/a'}</div>
                <div><strong>Viewport:</strong> {item.viewport ?? 'n/a'}</div>
                <div><strong>User Agent:</strong> {item.userAgent ?? 'n/a'}</div>
              </div>

              {(item.steps || item.expected || item.actual) && (
                <div className="bug-inbox-sections">
                  {item.steps && (
                    <div>
                      <div className="bug-inbox-section-label">Steps</div>
                      <pre className="bug-inbox-pre">{item.steps}</pre>
                    </div>
                  )}
                  {item.expected && (
                    <div>
                      <div className="bug-inbox-section-label">Expected</div>
                      <pre className="bug-inbox-pre">{item.expected}</pre>
                    </div>
                  )}
                  {item.actual && (
                    <div>
                      <div className="bug-inbox-section-label">Actual</div>
                      <pre className="bug-inbox-pre">{item.actual}</pre>
                    </div>
                  )}
                </div>
              )}

              <div className="bug-inbox-card-foot">
                <a href={item.pageUrl ?? '#'} target="_blank" rel="noreferrer" className="bug-inbox-link">
                  {item.pageUrl ? 'Open reported page' : 'No page URL'}
                </a>
                <div className="bug-inbox-status-actions">
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
