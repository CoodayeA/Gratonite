/**
 * AdminDashboard.tsx — Admin landing page with links to all admin tools.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield, Users, FileText, MessageSquare, Globe, Bot, Server,
  Search, UserPlus, Check, X, AlertTriangle, Palette, Activity, Database,
  Download, Zap, ChevronDown, ChevronUp, Workflow,
} from 'lucide-react';
import { api } from '../../lib/api';
import { ApiRequestError } from '../../lib/api/_core';
import { useToast } from '../../components/ui/ToastManager';

const API_BASE = (import.meta.env.VITE_API_URL ?? '/api/v1').replace(/\/api\/v1$/, '');

type AdminNavItem = {
  label: string;
  description: string;
  icon: typeof Shield;
  color: string;
  path?: string;
  href?: string;
};

const ADMIN_SECTIONS: { title: string; items: AdminNavItem[] }[] = [
  {
    title: 'Trust & Safety',
    items: [
      { label: 'Moderation Workspace', description: 'Start with the live queues, then fan out into reports, audit history, and bot review', icon: Workflow, path: '/admin/moderation-workspace', color: '#8b5cf6' },
      { label: 'Federation', description: 'Manage federated instances, verification requests, and abuse reports', icon: Globe, path: '/admin/federation', color: '#6366f1' },
      { label: 'User Reports', description: 'Review reports submitted by users', icon: AlertTriangle, path: '/admin/reports', color: '#ef4444' },
      { label: 'Bot Moderation', description: 'Review and manage bot listings', icon: Bot, path: '/admin/bot-moderation', color: '#f59e0b' },
    ],
  },
  {
    title: 'Content & Marketplace',
    items: [
      { label: 'Portals', description: 'Manage Discover listings, featured portals, and rankings', icon: Server, path: '/admin/portals', color: '#10b981' },
      { label: 'Cosmetics', description: 'Review and approve user-submitted marketplace items', icon: Palette, path: '/admin/cosmetics', color: '#f59e0b' },
      { label: 'Feedback', description: 'Read user feedback and feature requests', icon: MessageSquare, path: '/admin/feedback', color: '#3b82f6' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Team', description: 'Manage admin team members and roles', icon: Users, path: '/admin/team', color: '#8b5cf6' },
      { label: 'Audit Log', description: 'View all admin actions and changes', icon: FileText, path: '/admin/audit', color: '#6b7280' },
      {
        label: 'Self-host backups',
        description: 'Backup and restore runbook (opens documentation)',
        icon: Database,
        color: '#0ea5e9',
        href: 'https://gratonite.chat/docs/self-hosting',
      },
    ],
  },
];

type HealthPayload = {
  status?: string;
  version?: string;
  uptime?: number;
  db?: { connected?: boolean };
  redis?: { connected?: boolean };
  memory?: { rss?: number; heapUsed?: number };
};

type SystemHealthPayload = {
  disk: { freeMb: number; totalMb: number; path: string } | null;
  livekit: { configured: boolean; reachable: boolean | null; url: string | null };
  db: { ok: boolean };
  redis: { ok: boolean };
  memory?: { rssMb: number; heapUsedMb: number; heapTotalMb: number };
  cpu?: { loadAvg1m: number; loadAvg5m: number; loadAvg15m: number };
  queues?: { name: string; waiting: number; active: number; failed: number }[];
  snapshotAt?: string;
};

export default function AdminDashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [promoting, setPromoting] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealthPayload | null>(null);
  const [systemHealthError, setSystemHealthError] = useState<string | null>(null);
  const [healthHistory, setHealthHistory] = useState<SystemHealthPayload[]>([]);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [preflightResult, setPreflightResult] = useState<{ checks: { id: string; label: string; ok: boolean | null; value?: string; info?: boolean }[]; allOk: boolean; checkedAt: string } | null>(null);
  const [preflightOpen, setPreflightOpen] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setHealthLoading(true);
      setHealthError(null);
      try {
        const res = await fetch(`${API_BASE}/health`, { credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as HealthPayload;
        if (!cancelled) setHealth(data);
      } catch (e) {
        if (!cancelled) {
          setHealth(null);
          setHealthError(e instanceof Error ? e.message : 'Failed to load health');
        }
      } finally {
        if (!cancelled) setHealthLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSystemHealthError(null);
      try {
        const data = await api.get<SystemHealthPayload>('/admin/system-health');
        if (!cancelled) {
          setSystemHealth(data);
          // Fetch history for sparklines (best-effort)
          try {
            const hist = await api.get<{ history: SystemHealthPayload[] }>('/admin/system-health/history');
            if (!cancelled) setHealthHistory(hist.history ?? []);
          } catch { /* non-fatal */ }
        }
      } catch (e: unknown) {
        if (!cancelled) {
          if (e instanceof ApiRequestError && e.status === 403) {
            setSystemHealth(null);
            setSystemHealthError('');
            return;
          }
          const msg = e instanceof Error ? e.message : 'Unavailable';
          setSystemHealth(null);
          setSystemHealthError(msg);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const copyText = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      addToast({ title: `${label} copied`, variant: 'success' });
    } catch {
      addToast({ title: 'Copy failed', variant: 'error' });
    }
  };

  const searchUsers = async (query: string) => {
    if (query.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const results = await api.users.searchUsers(query);
      setSearchResults(results.slice(0, 10));
    } catch { setSearchResults([]); }
    setSearching(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => searchUsers(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const promoteToAdmin = async (userId: string, username: string) => {
    if (!confirm(`Are you sure you want to make @${username} an admin? They will have full access to all admin tools.`)) return;
    setPromoting(userId);
    try {
      await api.patch(`/admin/users/${userId}/promote`, {});
      addToast({ title: `@${username} is now an admin`, variant: 'success' });
      setSearchQuery('');
      setSearchResults([]);
    } catch (err: any) {
      addToast({ title: `Failed: ${err?.message || 'Unknown error'}`, variant: 'error' });
    }
    setPromoting(null);
  };

  const downloadDiagnostics = async () => {
    setDiagnosticsLoading(true);
    try {
      const bundle = await api.get<any>('/admin/diagnostics/bundle');
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gratonite-diagnostics-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      addToast({ title: 'Diagnostics bundle downloaded', variant: 'success' });
    } catch {
      addToast({ title: 'Failed to generate diagnostics', variant: 'error' });
    }
    setDiagnosticsLoading(false);
  };

  const runPreflight = async () => {
    setPreflightLoading(true);
    try {
      const result = await api.get<any>('/admin/upgrade/preflight');
      setPreflightResult(result);
      setPreflightOpen(true);
    } catch {
      addToast({ title: 'Failed to run preflight checks', variant: 'error' });
    }
    setPreflightLoading(false);
  };

  // Derive active alerts from system health
  const activeAlerts: { id: string; label: string; level: 'warning' | 'critical' }[] = [];
  if (systemHealth) {
    if (systemHealth.disk && (systemHealth.disk.freeMb / systemHealth.disk.totalMb) < 0.1) {
      activeAlerts.push({ id: 'disk-critical', label: `Disk critically low: ${systemHealth.disk.freeMb} MB free`, level: 'critical' });
    } else if (systemHealth.disk && (systemHealth.disk.freeMb / systemHealth.disk.totalMb) < 0.25) {
      activeAlerts.push({ id: 'disk-warning', label: `Disk space low: ${systemHealth.disk.freeMb} MB free`, level: 'warning' });
    }
    if (!systemHealth.db.ok) activeAlerts.push({ id: 'db', label: 'Database connection failed', level: 'critical' });
    if (!systemHealth.redis.ok) activeAlerts.push({ id: 'redis', label: 'Redis connection failed', level: 'critical' });
    if (systemHealth.cpu && systemHealth.cpu.loadAvg1m > 4) {
      activeAlerts.push({ id: 'cpu-critical', label: `CPU load critical: ${systemHealth.cpu.loadAvg1m} (1m avg)`, level: 'critical' });
    } else if (systemHealth.cpu && systemHealth.cpu.loadAvg1m > 2) {
      activeAlerts.push({ id: 'cpu-warning', label: `CPU load elevated: ${systemHealth.cpu.loadAvg1m} (1m avg)`, level: 'warning' });
    }
    if (systemHealth.queues) {
      const failedQueues = systemHealth.queues.filter(q => q.failed > 100);
      failedQueues.forEach(q => activeAlerts.push({ id: `queue-${q.name}`, label: `Queue "${q.name}" has ${q.failed} failed jobs`, level: 'warning' }));
    }
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '32px', color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '32px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={24} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, fontFamily: 'var(--font-display)' }}>Admin Dashboard</h1>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>Manage your Gratonite instance</p>
          </div>
        </div>

        {/* Instance API health (public /health — operators need a quick signal) */}
        <div style={{ background: 'var(--bg-secondary, #1a1a2e)', borderRadius: '14px', border: '1px solid var(--stroke, #2a2a3e)', padding: '20px', marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Activity size={18} color="#10b981" />
            <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>Instance API status</h2>
          </div>
          {healthLoading && (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>Loading health…</p>
          )}
          {!healthLoading && healthError && (
            <p style={{ fontSize: '13px', color: '#f87171', margin: 0 }}>{healthError}</p>
          )}
          {!healthLoading && !healthError && health && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px', fontSize: '13px' }}>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Overall</div>
                <div style={{ fontWeight: 600, color: health.status === 'ok' ? '#34d399' : '#fbbf24' }}>{health.status ?? '—'}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Database</div>
                <div style={{ fontWeight: 600, color: health.db?.connected ? '#34d399' : '#f87171' }}>{health.db?.connected ? 'Connected' : 'Down'}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Redis</div>
                <div style={{ fontWeight: 600, color: health.redis?.connected ? '#34d399' : '#f87171' }}>{health.redis?.connected ? 'Connected' : 'Down'}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>API version</div>
                <div style={{ fontWeight: 600 }}>{health.version ?? '—'}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Uptime</div>
                <div style={{ fontWeight: 600 }}>{health.uptime != null ? `${Math.floor(health.uptime / 3600)}h` : '—'}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Memory (RSS)</div>
                <div style={{ fontWeight: 600 }}>{health.memory?.rss != null ? `${health.memory.rss} MB` : '—'}</div>
              </div>
            </div>
          )}
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '12px 0 0', lineHeight: 1.4 }}>
            Source: <code style={{ fontSize: '10px' }}>{API_BASE}/health</code>. Platform admins also see extended metrics below.
          </p>
        </div>

        {systemHealth && (
          <div style={{ background: 'var(--bg-secondary, #1a1a2e)', borderRadius: '14px', border: '1px solid var(--stroke, #2a2a3e)', padding: '20px', marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Database size={18} color="#0ea5e9" />
              <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>Operator metrics</h2>
              {systemHealth.snapshotAt && (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  Snapshot: {new Date(systemHealth.snapshotAt).toLocaleTimeString()}
                </span>
              )}
            </div>

            {/* Active Alerts */}
            {activeAlerts.length > 0 && (
              <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>⚡ Active Alerts</div>
                {activeAlerts.map(alert => (
                  <div key={alert.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', background: alert.level === 'critical' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', border: `1px solid ${alert.level === 'critical' ? '#ef4444' : '#f59e0b'}` }}>
                    <AlertTriangle size={14} color={alert.level === 'critical' ? '#ef4444' : '#f59e0b'} />
                    <span style={{ fontSize: '12px', fontWeight: 500, color: alert.level === 'critical' ? '#f87171' : '#fbbf24' }}>{alert.label}</span>
                  </div>
                ))}
              </div>
            )}
            {activeAlerts.length === 0 && (
              <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)' }}>
                <Check size={14} color="#34d399" />
                <span style={{ fontSize: '12px', fontWeight: 500, color: '#34d399' }}>All systems nominal — no active alerts</span>
              </div>
            )}

            {/* Alert thresholds legend */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', fontSize: '11px', color: 'var(--text-muted)' }}>
              <span>⚠ Warning thresholds: Disk &lt;25%, CPU &gt;2.0, Queue failed &gt;100</span>
              <span style={{ color: '#f87171' }}>🔴 Critical: Disk &lt;10%, CPU &gt;4.0, DB/Redis down</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', fontSize: '13px' }}>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Disk free</div>
                <div style={{ fontWeight: 600 }}>
                  {systemHealth.disk ? `${systemHealth.disk.freeMb} MB / ${systemHealth.disk.totalMb} MB` : '—'}
                </div>
                {systemHealth.disk && (
                  <div style={{ marginTop: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px' }}>
                      <span>Used</span>
                      <span>{Math.round((1 - systemHealth.disk.freeMb / systemHealth.disk.totalMb) * 100)}%</span>
                    </div>
                    <div style={{ height: '6px', borderRadius: '3px', background: 'var(--bg-tertiary)', overflow: 'hidden', position: 'relative' }}>
                      <div style={{ height: '100%', borderRadius: '3px', background: (systemHealth.disk.freeMb / systemHealth.disk.totalMb) < 0.1 ? '#ef4444' : (systemHealth.disk.freeMb / systemHealth.disk.totalMb) < 0.25 ? '#f59e0b' : '#10b981', width: `${(1 - systemHealth.disk.freeMb / systemHealth.disk.totalMb) * 100}%` }} />
                      {/* Warning threshold line at 75% */}
                      <div style={{ position: 'absolute', top: 0, bottom: 0, left: '75%', width: '1px', background: '#f59e0b', opacity: 0.7 }} title="Warning threshold (75% used)" />
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{systemHealth.disk.path}</div>
                  </div>
                )}
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>LiveKit</div>
                <div style={{ fontWeight: 600, color: !systemHealth.livekit.configured ? 'var(--text-muted)' : systemHealth.livekit.reachable === null ? 'var(--text-primary)' : systemHealth.livekit.reachable ? '#34d399' : '#f87171' }}>
                  {!systemHealth.livekit.configured ? 'Not configured' : systemHealth.livekit.reachable === null ? 'Configured' : systemHealth.livekit.reachable ? 'Reachable' : 'Unreachable'}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>DB ping</div>
                <div style={{ fontWeight: 600, color: systemHealth.db.ok ? '#34d399' : '#f87171' }}>{systemHealth.db.ok ? 'OK' : 'Fail'}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Critical threshold: down</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Redis ping</div>
                <div style={{ fontWeight: 600, color: systemHealth.redis.ok ? '#34d399' : '#f87171' }}>{systemHealth.redis.ok ? 'OK' : 'Fail'}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Critical threshold: down</div>
              </div>
              {systemHealth.memory && (
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Memory (RSS)</div>
                  <div style={{ fontWeight: 600 }}>{systemHealth.memory.rssMb} MB</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Heap {systemHealth.memory.heapUsedMb}/{systemHealth.memory.heapTotalMb} MB</div>
                </div>
              )}
              {systemHealth.cpu && (
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>CPU load avg</div>
                  <div style={{ fontWeight: 600, color: systemHealth.cpu.loadAvg1m > 4 ? '#f87171' : systemHealth.cpu.loadAvg1m > 2 ? '#fbbf24' : '#34d399' }}>
                    {systemHealth.cpu.loadAvg1m}
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '4px' }}>1m avg</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{systemHealth.cpu.loadAvg5m} / {systemHealth.cpu.loadAvg15m} (5m/15m)</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>⚠ &gt;2.0 · 🔴 &gt;4.0</div>
                </div>
              )}
            </div>
            {systemHealth.queues && systemHealth.queues.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                  BullMQ Queues
                  <span style={{ marginLeft: '8px', fontSize: '10px', fontWeight: 400 }}>(w=waiting, a=active, f=failed · ⚠ f&gt;100)</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {systemHealth.queues.map(q => (
                    <div key={q.name} style={{ padding: '6px 10px', borderRadius: '8px', background: q.failed > 100 ? 'rgba(245,158,11,0.1)' : 'var(--bg-tertiary)', border: `1px solid ${q.failed > 100 ? '#f59e0b' : 'transparent'}`, fontSize: '12px' }}>
                      <span style={{ fontWeight: 600 }}>{q.name}</span>
                      <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>
                        {q.waiting >= 0 ? `${q.waiting}w ${q.active}a` : '?'}
                        {q.failed > 0 && <span style={{ color: q.failed > 100 ? '#fbbf24' : '#f87171', marginLeft: '4px' }}>{q.failed}f</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {healthHistory.length > 1 && systemHealth.memory && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                  Memory trend — RSS (MB), last {healthHistory.length} snapshots
                </div>
                <svg width="100%" height="40" viewBox={`0 0 ${Math.max(healthHistory.length * 12, 1)} 40`} preserveAspectRatio="none" style={{ display: 'block' }}>
                  {(() => {
                    const vals = [...healthHistory].reverse().map(h => h.memory?.rssMb ?? 0);
                    const max = Math.max(...vals, 1);
                    const min = Math.min(...vals, 0);
                    const range = max - min || 1;
                    const pts = vals.map((v, i) => `${i * 12},${36 - ((v - min) / range) * 30}`).join(' ');
                    return (
                      <>
                        <polyline points={pts} fill="none" stroke="#0ea5e9" strokeWidth="1.5" />
                        {vals.map((v, i) => (
                          <circle key={i} cx={i * 12} cy={36 - ((v - min) / range) * 30} r="2" fill="#0ea5e9" opacity="0.8">
                            <title>{v} MB</title>
                          </circle>
                        ))}
                        <text x="0" y="38" fill="var(--text-muted)" fontSize="8" fontFamily="monospace">{min}MB</text>
                        <text x="0" y="8" fill="var(--text-muted)" fontSize="8" fontFamily="monospace">{max}MB</text>
                      </>
                    );
                  })()}
                </svg>
              </div>
            )}
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '12px 0 0', lineHeight: 1.4 }}>
              <code style={{ fontSize: '10px' }}>GET /api/v1/admin/system-health</code> (platform admin only). Disk path: {systemHealth.disk?.path ?? '—'}.
            </p>
          </div>
        )}
        {systemHealthError && (
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '-20px 0 28px' }}>{systemHealthError}</p>
        )}

        {/* Diagnostics Bundle */}
        {systemHealth && (
          <div style={{ background: 'var(--bg-secondary, #1a1a2e)', borderRadius: '14px', border: '1px solid var(--stroke, #2a2a3e)', padding: '20px', marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Download size={18} color="#6366f1" />
              <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>Diagnostics Bundle</h2>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.45 }}>
              Download a JSON bundle containing system info, error counts (24h), slow query metrics, and active connection data. Use when troubleshooting or filing support requests.
            </p>
            <button
              type="button"
              onClick={() => void downloadDiagnostics()}
              disabled={diagnosticsLoading}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 18px', borderRadius: '8px', border: 'none', background: diagnosticsLoading ? 'var(--bg-tertiary)' : '#6366f1', color: diagnosticsLoading ? 'var(--text-muted)' : '#fff', fontSize: '13px', fontWeight: 600, cursor: diagnosticsLoading ? 'not-allowed' : 'pointer' }}
            >
              <Download size={14} />
              {diagnosticsLoading ? 'Collecting...' : 'Download Bundle'}
            </button>
          </div>
        )}

        {/* Upgrade Preflight */}
        {systemHealth && (
          <div style={{ background: 'var(--bg-secondary, #1a1a2e)', borderRadius: '14px', border: '1px solid var(--stroke, #2a2a3e)', padding: '20px', marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Zap size={18} color="#f59e0b" />
              <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>Upgrade Preflight</h2>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.45 }}>
              Run preflight checks before upgrading your instance. Verifies disk space, database connectivity, Redis, and active session count.
            </p>
            <button
              type="button"
              onClick={() => void runPreflight()}
              disabled={preflightLoading}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 18px', borderRadius: '8px', border: 'none', background: preflightLoading ? 'var(--bg-tertiary)' : '#f59e0b', color: preflightLoading ? 'var(--text-muted)' : '#000', fontSize: '13px', fontWeight: 600, cursor: preflightLoading ? 'not-allowed' : 'pointer', marginBottom: preflightResult ? '12px' : '0' }}
            >
              <Zap size={14} />
              {preflightLoading ? 'Running checks...' : 'Run Preflight Checks'}
            </button>
            {preflightResult && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <button type="button" onClick={() => setPreflightOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: 0 }}>
                    {preflightOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {preflightOpen ? 'Hide' : 'Show'} results
                  </button>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: preflightResult.allOk ? '#34d399' : '#f87171' }}>
                    {preflightResult.allOk ? '✓ All checks passed' : '⚠ Some checks failed'}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    {new Date(preflightResult.checkedAt).toLocaleTimeString()}
                  </span>
                </div>
                {preflightOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {preflightResult.checks.map(c => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-tertiary)', fontSize: '13px' }}>
                        {c.info ? (
                          <Activity size={14} color="#0ea5e9" />
                        ) : c.ok === true ? (
                          <Check size={14} color="#34d399" />
                        ) : c.ok === false ? (
                          <X size={14} color="#f87171" />
                        ) : (
                          <AlertTriangle size={14} color="#f59e0b" />
                        )}
                        <span style={{ flex: 1 }}>{c.label}</span>
                        {c.value && <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{c.value}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div style={{ background: 'var(--bg-secondary, #1a1a2e)', borderRadius: '14px', border: '1px solid var(--stroke, #2a2a3e)', padding: '20px', marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Database size={18} color="#10b981" />
            <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>Self-host backup hints</h2>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: 1.45 }}>
            Copy a generic Postgres dump command for your compose stack. Adjust service and database names to match your deployment.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <button
              type="button"
              onClick={() => void copyText('Docs link', 'https://gratonite.chat/docs/self-hosting')}
              style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--stroke)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              Copy docs URL
            </button>
            <button
              type="button"
              onClick={() => void copyText(
                'pg_dump example',
                'docker compose -f deploy/docker-compose.production.yml exec -T postgres pg_dump -U gratonite -Fc > gratonite-backup.dump',
              )}
              style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--stroke)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              Copy pg_dump example
            </button>
          </div>
        </div>

        {/* Quick Action: Promote User to Admin */}
        <div style={{ background: 'var(--bg-secondary, #1a1a2e)', borderRadius: '14px', border: '1px solid var(--stroke, #2a2a3e)', padding: '20px', marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <UserPlus size={18} color="#8b5cf6" />
            <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>Grant Admin Access</h2>
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Search by username..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px',
                background: 'var(--bg-primary)', border: '1px solid var(--stroke)',
                color: 'var(--text-primary)', fontSize: '13px', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          {searchResults.length > 0 && (
            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {searchResults.map(user => (
                <div key={user.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-tertiary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, overflow: 'hidden' }}>
                      {user.avatarHash ? (
                        <img src={`${API_BASE}/files/${user.avatarHash}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        user.username?.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '13px' }}>{user.displayName || user.username}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '6px' }}>@{user.username}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => promoteToAdmin(user.id, user.username)}
                    disabled={promoting === user.id}
                    style={{
                      padding: '5px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                      background: '#8b5cf6', color: '#fff', border: 'none', cursor: 'pointer',
                      opacity: promoting === user.id ? 0.5 : 1,
                    }}
                  >
                    {promoting === user.id ? 'Promoting...' : 'Make Admin'}
                  </button>
                </div>
              ))}
            </div>
          )}
          {searching && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>Searching...</p>}
        </div>

        {/* Admin Sections */}
        {ADMIN_SECTIONS.map(section => (
          <div key={section.title} style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>{section.title}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
              {section.items.map(item => {
                const inner = (
                  <div style={{
                    background: 'var(--bg-secondary, #1a1a2e)', borderRadius: '12px',
                    border: '1px solid var(--stroke, #2a2a3e)', padding: '18px',
                    transition: 'all 0.15s', cursor: 'pointer',
                    display: 'flex', alignItems: 'flex-start', gap: '14px',
                  }} className="hover-lift">
                    <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: `${item.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <item.icon size={18} color={item.color} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 4px' }}>{item.label}</h3>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>{item.description}</p>
                    </div>
                  </div>
                );
                const key = item.path ?? item.href ?? item.label;
                if (item.href) {
                  return (
                    <a key={key} href={item.href} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
                      {inner}
                    </a>
                  );
                }
                return (
                  <Link key={key} to={item.path!} style={{ textDecoration: 'none', color: 'inherit' }}>
                    {inner}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

      </div>
    </div>
  );
}
