import { useState, useEffect } from 'react';
import {
  MessageSquare,
  CheckCircle2,
  Clock,
  Archive,
  Search,
  Filter,
  ChevronDown,
  Eye,
  Star,
} from 'lucide-react';
import { useToast } from '../../components/ui/ToastManager';
import { api } from '../../lib/api';

type FeedbackStatus = 'New' | 'In Progress' | 'Resolved' | 'Archived';
type FeedbackCategory = 'Bug Report' | 'Feature Request' | 'General' | 'UX Issue';

interface FeedbackItem {
  id: string;
  category: FeedbackCategory;
  subject: string;
  body: string;
  user: string;
  email: string;
  submittedAt: string;
  status: FeedbackStatus;
  starred: boolean;
}

const INITIAL_FEEDBACK: FeedbackItem[] = [];

const CATEGORY_COLORS: Record<FeedbackCategory, { bg: string; color: string }> = {
  'Bug Report': { bg: 'rgba(239,68,68,0.12)', color: 'var(--error)' },
  'Feature Request': { bg: 'rgba(59,130,246,0.12)', color: 'var(--accent-blue)' },
  'General': { bg: 'rgba(156,163,175,0.15)', color: 'var(--text-secondary)' },
  'UX Issue': { bg: 'rgba(139,92,246,0.12)', color: 'var(--accent-purple)' },
};

const STATUS_STYLES: Record<FeedbackStatus, { bg: string; color: string; label: string }> = {
  'New': { bg: 'rgba(59,130,246,0.12)', color: 'var(--accent-blue)', label: 'New' },
  'In Progress': { bg: 'rgba(234,179,8,0.12)', color: 'var(--warning)', label: 'In Progress' },
  'Resolved': { bg: 'rgba(34,197,94,0.12)', color: 'var(--success)', label: 'Resolved' },
  'Archived': { bg: 'rgba(156,163,175,0.12)', color: 'var(--text-muted)', label: 'Archived' },
};

type FilterTab = 'All' | FeedbackStatus;

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AdminFeedback() {
  const { addToast } = useToast();
  const [items, setItems] = useState<FeedbackItem[]>(INITIAL_FEEDBACK);
  const [activeTab, setActiveTab] = useState<FilterTab>('All');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<FeedbackCategory | 'All'>('All');

  useEffect(() => {
    api.feedback.list({ limit: 200 }).then(res => {
      const raw: any[] = Array.isArray(res) ? res : (res as any).items ?? [];
      const categoryMap: Record<string, FeedbackCategory> = {
        bug: 'Bug Report', bug_report: 'Bug Report',
        feature: 'Feature Request', feature_request: 'Feature Request',
        ux: 'UX Issue', ux_issue: 'UX Issue',
        general: 'General',
      };
      const statusMap: Record<string, FeedbackStatus> = {
        new: 'New', open: 'New',
        in_progress: 'In Progress',
        resolved: 'Resolved',
        archived: 'Archived', closed: 'Archived',
      };
      setItems(raw.flatMap((r: any) => {
        const id = typeof r.id === 'string' && r.id.trim().length > 0 ? r.id : null;
        if (!id) return [];
        return [{
        id,
        category: categoryMap[(r.category ?? 'general').toLowerCase()] ?? 'General',
        subject: r.title ?? r.subject ?? '',
        body: r.body ?? r.description ?? '',
        user: r.userName ?? r.user ?? 'Unknown',
        email: r.email ?? '',
        submittedAt: r.createdAt ?? r.submittedAt ?? new Date().toISOString(),
        status: statusMap[(r.status ?? 'new').toLowerCase()] ?? 'New',
        starred: r.starred ?? false,
      }];
    }));
    }).catch(() => { addToast({ title: 'Failed to load feedback', variant: 'error' }); });
  }, []);

  const updateStatus = (id: string, status: FeedbackStatus) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, status } : item));
    const apiStatusMap: Record<FeedbackStatus, string> = {
      'New': 'new', 'In Progress': 'in_progress', 'Resolved': 'resolved', 'Archived': 'archived',
    };
    api.feedback.updateStatus(id, { status: apiStatusMap[status] }).catch(() => { addToast({ title: 'Failed to update feedback status', variant: 'error' }); });
    const labels: Record<FeedbackStatus, string> = {
      'New': 'Marked as New',
      'In Progress': 'Marked as In Progress',
      'Resolved': 'Marked as Resolved',
      'Archived': 'Feedback archived',
    };
    addToast({ title: labels[status], variant: status === 'Resolved' ? 'success' : 'info' });
  };

  const toggleStar = (id: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, starred: !item.starred } : item));
  };

  const filtered = items.filter(item => {
    const matchesTab = activeTab === 'All' || item.status === activeTab;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      item.subject.toLowerCase().includes(q) ||
      item.user.toLowerCase().includes(q) ||
      item.email.toLowerCase().includes(q) ||
      item.body.toLowerCase().includes(q);
    const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
    return matchesTab && matchesSearch && matchesCategory;
  });

  const counts = {
    total: items.length,
    New: items.filter(i => i.status === 'New').length,
    'In Progress': items.filter(i => i.status === 'In Progress').length,
    Resolved: items.filter(i => i.status === 'Resolved').length,
  };

  const tabs: FilterTab[] = ['All', 'New', 'In Progress', 'Resolved'];

  return (
    <div className="main-content-wrapper" style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-primary)' }}>
      <div className="content-padding" style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 24px', width: '100%' }}>

        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: 'var(--radius-md)',
              background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <MessageSquare size={18} color="var(--accent-primary)" />
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Feedback Inbox
            </h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0, paddingLeft: '48px' }}>
            User feedback and suggestions
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid-mobile-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '28px' }}>
          {[
            { label: 'Total Feedback', value: counts.total, icon: <MessageSquare size={16} />, color: 'var(--accent-primary)' },
            { label: 'New', value: counts.New, icon: <Eye size={16} />, color: 'var(--accent-blue)' },
            { label: 'In Progress', value: counts['In Progress'], icon: <Clock size={16} />, color: 'var(--warning)' },
            { label: 'Resolved', value: counts.Resolved, icon: <CheckCircle2 size={16} />, color: 'var(--success)' },
          ].map(stat => (
            <div key={stat.label} style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--stroke)',
              borderRadius: 'var(--radius-md)',
              padding: '16px 18px',
              boxShadow: 'var(--shadow-panel)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: stat.color }}>
                {stat.icon}
                <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {stat.label}
                </span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {/* Filter Tabs */}
          <div style={{
            display: 'flex', gap: '4px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--stroke)',
            borderRadius: 'var(--radius-sm)',
            padding: '3px',
            flexShrink: 0,
          }}>
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'calc(var(--radius-sm) - 2px)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                  transition: 'all 0.15s ease',
                  background: activeTab === tab ? 'var(--bg-elevated)' : 'transparent',
                  color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: activeTab === tab ? 'var(--shadow-panel)' : 'none',
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Search */}
          <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search feedback..."
              style={{
                width: '100%',
                padding: '8px 12px 8px 32px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--stroke)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Filter button */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button onClick={() => setShowFilterMenu(!showFilterMenu)} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px',
              background: categoryFilter !== 'All' ? 'rgba(var(--accent-primary-rgb, 88, 101, 242), 0.15)' : 'var(--bg-elevated)',
              border: `1px solid ${categoryFilter !== 'All' ? 'var(--accent-primary)' : 'var(--stroke)'}`,
              borderRadius: 'var(--radius-sm)',
              color: categoryFilter !== 'All' ? 'var(--accent-primary)' : 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}>
              <Filter size={13} />
              {categoryFilter === 'All' ? 'Filter' : categoryFilter}
              <ChevronDown size={13} style={{ transform: showFilterMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>
            {showFilterMenu && (
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-sm)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 50, minWidth: '160px', overflow: 'hidden' }}>
                {(['All', 'Bug Report', 'Feature Request', 'General', 'UX Issue'] as const).map(cat => (
                  <button key={cat} onClick={() => { setCategoryFilter(cat as any); setShowFilterMenu(false); }} style={{ display: 'block', width: '100%', padding: '8px 14px', background: categoryFilter === cat ? 'var(--bg-tertiary)' : 'transparent', border: 'none', color: categoryFilter === cat ? 'var(--accent-primary)' : 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', textAlign: 'left', fontWeight: categoryFilter === cat ? 600 : 400 }}>
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Feedback List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '48px 24px',
              color: 'var(--text-muted)', fontSize: '14px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--stroke)',
              borderRadius: 'var(--radius-md)',
            }}>
              No feedback matches your filters.
            </div>
          )}

          {filtered.map(item => {
            const isExpanded = expandedId === item.id;
            const catStyle = CATEGORY_COLORS[item.category];
            const statusStyle = STATUS_STYLES[item.status];

            return (
              <div
                key={item.id}
                style={{
                  background: 'var(--bg-elevated)',
                  border: `1px solid ${isExpanded ? 'var(--accent-primary)' : 'var(--stroke)'}`,
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-panel)',
                  transition: 'border-color 0.15s ease',
                  overflow: 'hidden',
                }}
              >
                {/* Card Header (always visible) */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  style={{
                    padding: '16px 18px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  {/* Top row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    {/* Category badge */}
                    <span style={{
                      padding: '3px 9px',
                      borderRadius: '999px',
                      fontSize: '11px',
                      fontWeight: 600,
                      letterSpacing: '0.03em',
                      background: catStyle.bg,
                      color: catStyle.color,
                      flexShrink: 0,
                    }}>
                      {item.category}
                    </span>

                    {/* Subject */}
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
                      {item.subject}
                    </span>

                    {/* Star */}
                    <button
                      onClick={e => { e.stopPropagation(); toggleStar(item.id); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', flexShrink: 0, lineHeight: 0 }}
                    >
                      <Star
                        size={15}
                        fill={item.starred ? 'var(--warning)' : 'none'}
                        color={item.starred ? 'var(--warning)' : 'var(--text-muted)'}
                      />
                    </button>

                    {/* Status badge */}
                    <span style={{
                      padding: '3px 9px',
                      borderRadius: '999px',
                      fontSize: '11px',
                      fontWeight: 600,
                      background: statusStyle.bg,
                      color: statusStyle.color,
                      flexShrink: 0,
                    }}>
                      {statusStyle.label}
                    </span>

                    {/* Chevron */}
                    <ChevronDown
                      size={15}
                      color="var(--text-muted)"
                      style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', flexShrink: 0 }}
                    />
                  </div>

                  {/* Body preview */}
                  {!isExpanded && (
                    <p style={{
                      margin: 0,
                      fontSize: '13px',
                      color: 'var(--text-secondary)',
                      lineHeight: '1.55',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}>
                      {item.body}
                    </p>
                  )}

                  {/* Meta row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{item.user}</span>
                      {' · '}
                      {item.email}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                      {formatDate(item.submittedAt)}
                    </span>
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--stroke)', padding: '18px 18px 20px' }}>
                    {/* Full body */}
                    <p style={{
                      margin: '0 0 20px',
                      fontSize: '13px',
                      color: 'var(--text-secondary)',
                      lineHeight: '1.65',
                      whiteSpace: 'pre-wrap',
                    }}>
                      {item.body}
                    </p>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <ActionButton
                        icon={<Clock size={13} />}
                        label="Mark In Progress"
                        active={item.status === 'In Progress'}
                        onClick={() => updateStatus(item.id, 'In Progress')}
                        color="var(--warning)"
                        activeBg="rgba(234,179,8,0.12)"
                      />
                      <ActionButton
                        icon={<CheckCircle2 size={13} />}
                        label="Mark Resolved"
                        active={item.status === 'Resolved'}
                        onClick={() => updateStatus(item.id, 'Resolved')}
                        color="var(--success)"
                        activeBg="rgba(34,197,94,0.12)"
                      />
                      <ActionButton
                        icon={<Archive size={13} />}
                        label="Archive"
                        active={item.status === 'Archived'}
                        onClick={() => updateStatus(item.id, 'Archived')}
                        color="var(--text-muted)"
                        activeBg="rgba(156,163,175,0.12)"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  color: string;
  activeBg: string;
}

function ActionButton({ icon, label, active, onClick, color, activeBg }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '7px 14px',
        borderRadius: 'var(--radius-sm)',
        border: `1px solid ${active ? color : 'var(--stroke)'}`,
        background: active ? activeBg : 'transparent',
        color: active ? color : 'var(--text-secondary)',
        fontSize: '12px',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
    >
      {icon}
      {label}
    </button>
  );
}
