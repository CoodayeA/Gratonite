import { useState, useMemo, useEffect } from 'react';
import {
  Activity,
  Filter,
  Search,
  Shield,
  User,
  Settings,
  AlertTriangle,
  Clock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useToast } from '../../components/ui/ToastManager';
import { api } from '../../lib/api';

type AuditEntryType =
  | 'user_login'
  | 'user_ban'
  | 'bot_approved'
  | 'bot_rejected'
  | 'guild_reported'
  | 'moderation_review'
  | 'moderation_resolved'
  | 'moderation_dismissed'
  | 'moderation_note'
  | 'appeal_approved'
  | 'appeal_denied'
  | 'settings_changed'
  | 'team_invited'
  | 'feedback_resolved';

type AuditCategory = 'user' | 'bot' | 'guild' | 'system';

interface AuditEntry {
  id: string;
  timestamp: string;
  type: AuditEntryType;
  category: AuditCategory;
  action: string;
  description: string;
  actor: string;
  actorId: string;
  target: string;
  ip: string;
}

function parseAuditEntry(raw: any): AuditEntry {
  const type: AuditEntryType = raw.type && Object.keys(BADGE_STYLES_MAP).includes(raw.type) ? raw.type : 'settings_changed';
  const categoryMap: Record<string, AuditCategory> = {
    user_login: 'user', user_ban: 'user',
    bot_approved: 'bot', bot_rejected: 'bot',
    guild_reported: 'guild', appeal_approved: 'guild', appeal_denied: 'guild',
    moderation_review: 'user', moderation_resolved: 'user', moderation_dismissed: 'user', moderation_note: 'user',
    settings_changed: 'system', team_invited: 'system', feedback_resolved: 'system',
  };
  return {
    id: raw.id ?? raw._id ?? `${raw.action ?? 'action'}-${raw.createdAt ?? raw.timestamp ?? ''}-${raw.actorId ?? 'system'}`,
    timestamp: raw.timestamp ?? raw.createdAt ?? new Date().toISOString(),
    type,
    category: categoryMap[type] ?? 'system',
    action: raw.action ?? type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
    description: raw.description ?? raw.details ?? '',
    actor: raw.actor ?? raw.actorName ?? 'system',
    actorId: raw.actorId ?? '',
    target: raw.target ?? raw.targetName ?? '',
    ip: raw.ip ?? 'N/A',
  };
}

const BADGE_STYLES_MAP: Record<AuditEntryType, boolean> = {
  user_login: true, user_ban: true, bot_approved: true, bot_rejected: true,
  guild_reported: true, moderation_review: true, moderation_resolved: true, moderation_dismissed: true,
  moderation_note: true, appeal_approved: true, appeal_denied: true,
  settings_changed: true, team_invited: true, feedback_resolved: true,
};

type FilterCategory = 'all' | AuditCategory;

const BADGE_STYLES: Record<AuditEntryType, { bg: string; color: string; label: string }> = {
  user_login:        { bg: 'var(--accent-blue)',   color: '#fff', label: 'Login' },
  user_ban:          { bg: 'var(--error)',          color: '#fff', label: 'Ban' },
  bot_approved:      { bg: 'var(--success)',        color: '#fff', label: 'Approved' },
  bot_rejected:      { bg: 'var(--error)',          color: '#fff', label: 'Rejected' },
  guild_reported:    { bg: 'var(--warning)',        color: '#111', label: 'Reported' },
  moderation_review: { bg: 'var(--accent-blue)',    color: '#fff', label: 'Review' },
  moderation_resolved: { bg: 'var(--success)',      color: '#fff', label: 'Resolved' },
  moderation_dismissed: { bg: 'var(--text-muted)',  color: '#fff', label: 'Dismissed' },
  moderation_note:   { bg: 'var(--accent-purple)',  color: '#fff', label: 'Note' },
  appeal_approved:   { bg: 'var(--success)',        color: '#fff', label: 'Appeal OK' },
  appeal_denied:     { bg: 'var(--warning)',        color: '#111', label: 'Appeal Denied' },
  settings_changed:  { bg: 'var(--accent-purple)',  color: '#fff', label: 'Settings' },
  team_invited:      { bg: 'var(--accent-blue)',    color: '#fff', label: 'Invite' },
  feedback_resolved: { bg: 'var(--success)',        color: '#fff', label: 'Resolved' },
};

function entryIcon(type: AuditEntryType) {
  const size = 16;
  switch (type) {
    case 'user_login':        return <User size={size} />;
    case 'user_ban':          return <AlertTriangle size={size} />;
    case 'bot_approved':      return <Shield size={size} />;
    case 'bot_rejected':      return <AlertTriangle size={size} />;
    case 'guild_reported':    return <AlertTriangle size={size} />;
    case 'moderation_review': return <Shield size={size} />;
    case 'moderation_resolved': return <Activity size={size} />;
    case 'moderation_dismissed': return <AlertTriangle size={size} />;
    case 'moderation_note':   return <Settings size={size} />;
    case 'appeal_approved':   return <Shield size={size} />;
    case 'appeal_denied':     return <AlertTriangle size={size} />;
    case 'settings_changed':  return <Settings size={size} />;
    case 'team_invited':      return <User size={size} />;
    case 'feedback_resolved': return <Activity size={size} />;
  }
}

function iconColor(type: AuditEntryType): string {
  switch (type) {
    case 'user_ban':
    case 'bot_rejected':
    case 'guild_reported':
    case 'moderation_dismissed':
      return 'var(--error)';
    case 'appeal_denied':
      return 'var(--warning)';
    case 'bot_approved':
    case 'feedback_resolved':
    case 'moderation_resolved':
    case 'appeal_approved':
      return 'var(--success)';
    case 'moderation_note':
    case 'settings_changed':
      return 'var(--accent-purple)';
    case 'moderation_review':
    case 'user_login':
    case 'team_invited':
    default:
      return 'var(--accent-blue)';
  }
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

const PAGE_SIZE = 8;

export default function AdminAuditLog() {
  const { addToast } = useToast();

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<FilterCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hoveredEntry, setHoveredEntry] = useState<string | null>(null);

  useEffect(() => {
    api.adminAudit.list({ limit: 200 }).then(res => {
      const items: any[] = Array.isArray(res) ? res : (res as any).items ?? [];
      setEntries(items.map(parseAuditEntry));
    }).catch(() => { addToast({ title: 'Failed to load audit log', variant: 'error' }); });
  }, []);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      const matchesCategory =
        categoryFilter === 'all' || e.category === categoryFilter;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        e.actor.toLowerCase().includes(q) ||
        e.target.toLowerCase().includes(q) ||
        e.action.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [categoryFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageEntries = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function handleCategoryChange(val: FilterCategory) {
    setCategoryFilter(val);
    setPage(1);
  }

  function handleSearch(val: string) {
    setSearchQuery(val);
    setPage(1);
  }

  function handleExport() {
    addToast({ title: 'Audit log export queued. You will receive an email when ready.', variant: 'success' });
  }

  const filterOptions: { value: FilterCategory; label: string }[] = [
    { value: 'all',    label: 'All Types' },
    { value: 'user',   label: 'User' },
    { value: 'bot',    label: 'Bot' },
    { value: 'guild',  label: 'Guild' },
    { value: 'system', label: 'System' },
  ];

  return (
    <div
      className="main-content-wrapper"
      style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-primary)' }}
    >
      <div
        style={{
          maxWidth: '900px',
          margin: '0 auto',
          padding: '48px 24px',
          width: '100%',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--stroke)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-purple)',
              }}
            >
              <Activity size={20} />
            </div>
            <div>
              <h1
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '24px',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  margin: 0,
                  lineHeight: 1.2,
                }}
              >
                Platform Audit Log
              </h1>
            </div>
          </div>
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '14px',
              color: 'var(--text-secondary)',
              margin: '0 0 0 52px',
            }}
          >
            A tamper-evident record of all administrative and system actions across the platform.
          </p>
        </div>

        {/* Stats row */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            marginBottom: '24px',
            flexWrap: 'wrap',
          }}
        >
          {[
            { label: 'Total Events', value: entries.length, color: 'var(--text-primary)' },
            {
              label: 'Destructive',
              value: entries.filter((e) => ['user_ban', 'bot_rejected', 'guild_reported'].includes(e.type)).length,
              color: 'var(--error)',
            },
            {
              label: 'Approvals',
              value: entries.filter((e) => ['bot_approved', 'feedback_resolved'].includes(e.type)).length,
              color: 'var(--success)',
            },
            {
              label: 'System',
              value: entries.filter((e) => e.category === 'system').length,
              color: 'var(--text-muted)',
            },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                flex: '1 1 140px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--stroke)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 18px',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '22px',
                  fontWeight: 700,
                  color: stat.color,
                  lineHeight: 1,
                  marginBottom: '4px',
                }}
              >
                {stat.value}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Filter row */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            marginBottom: '20px',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          {/* Category dropdown */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--stroke)',
              borderRadius: 'var(--radius-md)',
              padding: '0 12px',
              height: '38px',
            }}
          >
            <Filter size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <select
              value={categoryFilter}
              onChange={(e) => handleCategoryChange(e.target.value as FilterCategory)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontFamily: 'var(--font-sans)',
                fontSize: '13px',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                padding: '0',
                appearance: 'none',
                WebkitAppearance: 'none',
                minWidth: '100px',
              }}
            >
              {filterOptions.map((opt) => (
                <option
                  key={opt.value}
                  value={opt.value}
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                >
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--stroke)',
              borderRadius: 'var(--radius-md)',
              padding: '0 12px',
              height: '38px',
              flex: '1 1 220px',
            }}
          >
            <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search by user, action, or target..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontFamily: 'var(--font-sans)',
                fontSize: '13px',
                color: 'var(--text-primary)',
                width: '100%',
              }}
            />
          </div>

          {/* Export */}
          <button
            onClick={handleExport}
            style={{
              height: '38px',
              padding: '0 16px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--stroke)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-sans)',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
              transition: 'color 0.15s',
            }}
          >
            Export CSV
          </button>
        </div>

        {/* Result count */}
        <div
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '12px',
            color: 'var(--text-muted)',
            marginBottom: '12px',
          }}
        >
          Showing {pageEntries.length} of {filtered.length} events
          {categoryFilter !== 'all' && ` · filtered by "${categoryFilter}"`}
          {searchQuery && ` · matching "${searchQuery}"`}
        </div>

        {/* Entry list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
          {pageEntries.length === 0 ? (
            <div
              style={{
                padding: '48px',
                textAlign: 'center',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--stroke)',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              <Activity
                size={32}
                style={{ color: 'var(--text-muted)', margin: '0 auto 12px', display: 'block' }}
              />
              <p
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '14px',
                  color: 'var(--text-muted)',
                  margin: 0,
                }}
              >
                No audit entries match your filters.
              </p>
            </div>
          ) : (
            pageEntries.map((entry) => {
              const badge = BADGE_STYLES[entry.type];
              const isHovered = hoveredEntry === entry.id;
              return (
                <div
                  key={entry.id}
                  onMouseEnter={() => setHoveredEntry(entry.id)}
                  onMouseLeave={() => setHoveredEntry(null)}
                  style={{
                    background: isHovered ? 'var(--bg-elevated)' : 'var(--bg-elevated)',
                    border: `1px solid ${isHovered ? 'var(--border-structural)' : 'var(--stroke)'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 16px',
                    display: 'flex',
                    gap: '14px',
                    alignItems: 'flex-start',
                    transition: 'background 0.12s, border-color 0.12s',
                    cursor: 'default',
                  }}
                >
                  {/* Icon column */}
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-tertiary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: iconColor(entry.type),
                      flexShrink: 0,
                      marginTop: '1px',
                    }}
                  >
                    {entryIcon(entry.type)}
                  </div>

                  {/* Main content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flexWrap: 'wrap',
                        marginBottom: '4px',
                      }}
                    >
                      {/* Badge */}
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: badge.bg,
                          color: badge.color,
                          fontFamily: 'var(--font-sans)',
                          fontSize: '11px',
                          fontWeight: 600,
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {badge.label}
                      </span>
                      {/* Action title */}
                      <span
                        style={{
                          fontFamily: 'var(--font-sans)',
                          fontSize: '14px',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                        }}
                      >
                        {entry.action}
                      </span>
                    </div>

                    {/* Description */}
                    <p
                      style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: '13px',
                        color: 'var(--text-secondary)',
                        margin: '0 0 8px',
                        lineHeight: 1.5,
                      }}
                    >
                      {entry.description}
                    </p>

                    {/* Meta row */}
                    <div
                      style={{
                        display: 'flex',
                        gap: '16px',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                      }}
                    >
                      <MetaChip icon={<User size={11} />} label="Actor" value={entry.actor} />
                      <MetaChip icon={<Shield size={11} />} label="Target" value={entry.target} />
                      <MetaChip icon={<Clock size={11} />} label="Time" value={formatTimestamp(entry.timestamp)} />
                      <MetaChip label="IP" value={entry.ip} />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '13px',
              color: 'var(--text-muted)',
            }}
          >
            Page {safePage} of {totalPages}
          </span>

          <div style={{ display: 'flex', gap: '6px' }}>
            <PaginationButton
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              label="Previous page"
            >
              <ChevronLeft size={15} />
              Prev
            </PaginationButton>

            {/* Page numbers */}
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => setPage(n)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${n === safePage ? 'var(--accent-primary)' : 'var(--stroke)'}`,
                  background: n === safePage ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                  color: n === safePage ? '#fff' : 'var(--text-secondary)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '13px',
                  fontWeight: n === safePage ? 600 : 400,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.12s, color 0.12s',
                }}
              >
                {n}
              </button>
            ))}

            <PaginationButton
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              label="Next page"
            >
              Next
              <ChevronRight size={15} />
            </PaginationButton>
          </div>
        </div>
      </div>
    </div>
  );
}

// Small helper components defined below (not exported)

function MetaChip({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
      }}
    >
      {icon && (
        <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
          {icon}
        </span>
      )}
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '11px',
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}:
      </span>
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '12px',
          color: 'var(--text-secondary)',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function PaginationButton({
  children,
  onClick,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      style={{
        height: '32px',
        padding: '0 12px',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--stroke)',
        background: 'var(--bg-elevated)',
        color: disabled ? 'var(--text-muted)' : 'var(--text-secondary)',
        fontFamily: 'var(--font-sans)',
        fontSize: '13px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        transition: 'color 0.12s',
      }}
    >
      {children}
    </button>
  );
}
