/**
 * AdminDashboard.tsx — Admin landing page with links to all admin tools.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield, Users, FileText, MessageSquare, Globe, Bot, Server,
  Search, UserPlus, Check, X, AlertTriangle, Palette, Activity, Database,
} from 'lucide-react';
import { api } from '../../lib/api';
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

export default function AdminDashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [promoting, setPromoting] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);
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
            Source: <code style={{ fontSize: '10px' }}>{API_BASE}/health</code>. For full infrastructure (disk, LiveKit, containers), use server SSH and compose per the self-host docs.
          </p>
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
