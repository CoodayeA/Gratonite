/**
 * AdminDashboard.tsx — Admin landing page with links to all admin tools.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield, Users, FileText, MessageSquare, Globe, Bot, Server,
  Search, UserPlus, Check, X, AlertTriangle,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../components/ui/ToastManager';

const API_BASE = (import.meta.env.VITE_API_URL ?? '/api/v1').replace(/\/api\/v1$/, '');

const ADMIN_SECTIONS = [
  {
    title: 'Trust & Safety',
    items: [
      { label: 'Federation', description: 'Manage federated instances, verification requests, and abuse reports', icon: Globe, path: '/app/admin/federation', color: '#6366f1' },
      { label: 'User Reports', description: 'Review reports submitted by users', icon: AlertTriangle, path: '/app/admin/reports', color: '#ef4444' },
      { label: 'Bot Moderation', description: 'Review and manage bot listings', icon: Bot, path: '/app/admin/bot-moderation', color: '#f59e0b' },
    ],
  },
  {
    title: 'Content',
    items: [
      { label: 'Portals', description: 'Manage Discover listings, featured portals, and rankings', icon: Server, path: '/app/admin/portals', color: '#10b981' },
      { label: 'Feedback', description: 'Read user feedback and feature requests', icon: MessageSquare, path: '/app/admin/feedback', color: '#3b82f6' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Team', description: 'Manage admin team members and roles', icon: Users, path: '/app/admin/team', color: '#8b5cf6' },
      { label: 'Audit Log', description: 'View all admin actions and changes', icon: FileText, path: '/app/admin/audit', color: '#6b7280' },
    ],
  },
];

export default function AdminDashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [promoting, setPromoting] = useState<string | null>(null);
  const { addToast } = useToast();

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
              {section.items.map(item => (
                <Link key={item.path} to={item.path} style={{ textDecoration: 'none', color: 'inherit' }}>
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
                </Link>
              ))}
            </div>
          </div>
        ))}

      </div>
    </div>
  );
}
