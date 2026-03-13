import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Activity, Search, Filter, ShieldAlert, X, Calendar, User, Zap, Settings, UserPlus, Trash2, Hash, Shield, UserMinus, UserX } from 'lucide-react';
import { useToast } from '../../components/ui/ToastManager';
import { api } from '../../lib/api';

// ---------------------------------------------------------------------------
// Action types matching the backend AuditActionTypes enum
// ---------------------------------------------------------------------------

const AUDIT_ACTIONS = [
    'all',
    'CHANNEL_CREATE',
    'CHANNEL_UPDATE',
    'CHANNEL_DELETE',
    'ROLE_CREATE',
    'ROLE_UPDATE',
    'ROLE_DELETE',
    'MEMBER_KICK',
    'MEMBER_BAN',
    'MEMBER_UNBAN',
    'GUILD_UPDATE',
] as const;

type ActionFilter = typeof AUDIT_ACTIONS[number];

const ACTION_LABELS: Record<string, string> = {
    CHANNEL_CREATE: 'Channel Created',
    CHANNEL_UPDATE: 'Channel Updated',
    CHANNEL_DELETE: 'Channel Deleted',
    ROLE_CREATE: 'Role Created',
    ROLE_UPDATE: 'Role Updated',
    ROLE_DELETE: 'Role Deleted',
    MEMBER_KICK: 'Member Kicked',
    MEMBER_BAN: 'Member Banned',
    MEMBER_UNBAN: 'Member Unbanned',
    GUILD_UPDATE: 'Guild Updated',
};

const ACTION_ICON_MAP: Record<string, typeof ShieldAlert> = {
    CHANNEL_CREATE: Hash,
    CHANNEL_UPDATE: Hash,
    CHANNEL_DELETE: Trash2,
    ROLE_CREATE: Shield,
    ROLE_UPDATE: Settings,
    ROLE_DELETE: Trash2,
    MEMBER_KICK: UserMinus,
    MEMBER_BAN: ShieldAlert,
    MEMBER_UNBAN: UserPlus,
    GUILD_UPDATE: Settings,
};

const ACTION_COLOR_MAP: Record<string, string> = {
    CHANNEL_CREATE: 'var(--success)',
    CHANNEL_UPDATE: 'var(--accent-primary)',
    CHANNEL_DELETE: 'var(--error)',
    ROLE_CREATE: 'var(--accent-purple, #9b59b6)',
    ROLE_UPDATE: 'var(--accent-primary)',
    ROLE_DELETE: 'var(--error)',
    MEMBER_KICK: 'var(--warning)',
    MEMBER_BAN: 'var(--error)',
    MEMBER_UNBAN: 'var(--success)',
    GUILD_UPDATE: 'var(--accent-primary)',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AuditLogEntry = {
    id: string;
    action: string;
    description: string;
    targetId: string | null;
    targetType: string | null;
    changes: Record<string, unknown> | null;
    reason: string | null;
    userName: string;
    userDisplayName: string | null;
    userAvatarHash: string | null;
    createdAt: string;
};

type UserFilterOption = 'all' | string;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatActionDescription(entry: AuditLogEntry): string {
    const changes = entry.changes as Record<string, unknown> | null;
    switch (entry.action) {
        case 'CHANNEL_CREATE':
            return `created channel #${changes?.name ?? 'unknown'}`;
        case 'CHANNEL_UPDATE':
            return `updated channel${changes?.name ? ` #${changes.name}` : ''}`;
        case 'CHANNEL_DELETE':
            return `deleted channel #${changes?.name ?? 'unknown'}`;
        case 'ROLE_CREATE':
            return `created role ${changes?.name ?? 'unknown'}`;
        case 'ROLE_UPDATE':
            return `updated role${changes?.name ? ` ${changes.name}` : ''}`;
        case 'ROLE_DELETE':
            return `deleted role ${changes?.name ?? 'unknown'}`;
        case 'MEMBER_KICK':
            return 'kicked a member';
        case 'MEMBER_BAN':
            return 'banned a member';
        case 'MEMBER_UNBAN':
            return 'unbanned a member';
        case 'GUILD_UPDATE': {
            const parts: string[] = [];
            if (changes?.name) parts.push(`name to "${changes.name}"`);
            if (changes?.description !== undefined) parts.push('description');
            if (changes?.isDiscoverable !== undefined) parts.push(`discoverability to ${changes.isDiscoverable ? 'on' : 'off'}`);
            return parts.length > 0 ? `updated guild ${parts.join(', ')}` : 'updated guild settings';
        }
        default:
            return entry.action;
    }
}

function formatRelativeTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffDay > 7) return date.toLocaleDateString();
    if (diffDay > 0) return `${diffDay}d ago`;
    if (diffHr > 0) return `${diffHr}h ago`;
    if (diffMin > 0) return `${diffMin}m ago`;
    return 'just now';
}

function userInitial(name: string): string {
    return name.charAt(0).toUpperCase();
}

function deterministicColor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 50%, 50%)`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const AuditLog = () => {
    const { guildId } = useParams<{ guildId: string }>();
    const { addToast } = useToast();
    const [searchQuery, setSearchQuery] = useState('');
    const [showFilter, setShowFilter] = useState(false);
    const [actionFilter, setActionFilter] = useState<ActionFilter>('all');
    const [userFilter, setUserFilter] = useState<UserFilterOption>('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [page, setPage] = useState(0);
    const PAGE_SIZE = 25;
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [uniqueUsers, setUniqueUsers] = useState<string[]>([]);
    const filterRef = useRef<HTMLDivElement>(null);

    const activeFilterCount = [actionFilter !== 'all', userFilter !== 'all'].filter(Boolean).length;

    // Fetch audit logs from API
    useEffect(() => {
        if (!guildId) return;
        setLoading(true);
        api.guilds.getAuditLog(guildId, { limit: 100 }).then(res => {
            const items: any[] = Array.isArray(res) ? res : (res as any).items ?? [];
            const mapped: AuditLogEntry[] = items.map((log: any) => ({
                id: log.id,
                action: log.action ?? 'UNKNOWN',
                description: '',
                targetId: log.targetId ?? null,
                targetType: log.targetType ?? null,
                changes: log.changes ?? null,
                reason: log.reason ?? null,
                userName: log.userName ?? 'Unknown',
                userDisplayName: log.userDisplayName ?? null,
                userAvatarHash: log.userAvatarHash ?? null,
                createdAt: log.createdAt ?? '',
            }));
            setLogs(mapped);
            setUniqueUsers(Array.from(new Set(mapped.map(l => l.userName))));
        }).catch(() => {
            addToast({ title: 'Failed to load audit log', variant: 'error' });
        }).finally(() => setLoading(false));
    }, [guildId]);

    // Click outside to close filter
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
                setShowFilter(false);
            }
        };
        if (showFilter) document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [showFilter]);

    // Client-side filtering
    const filteredLogs = logs.filter(log => {
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const desc = formatActionDescription(log).toLowerCase();
            const label = (ACTION_LABELS[log.action] ?? log.action).toLowerCase();
            const user = (log.userDisplayName ?? log.userName).toLowerCase();
            if (!desc.includes(q) && !label.includes(q) && !user.includes(q)) return false;
        }
        if (actionFilter !== 'all' && log.action !== actionFilter) return false;
        if (userFilter !== 'all' && log.userName !== userFilter) return false;
        return true;
    });

    const clearFilters = () => {
        setActionFilter('all');
        setUserFilter('all');
    };

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', overflow: 'hidden' }}>
            <header className="channel-header glass-panel">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Activity size={20} color="var(--text-muted)" />
                    <h2 style={{ fontSize: '15px', fontWeight: 600 }}>audit-log</h2>
                </div>
            </header>

            <div className="content-padding" style={{ flex: 1, overflowY: 'auto', padding: '32px 48px' }}>
                <div style={{ maxWidth: '900px', margin: '0 auto' }}>

                    <div style={{ marginBottom: '32px' }}>
                        <h1 style={{ fontSize: '28px', fontWeight: 600, fontFamily: 'var(--font-display)', marginBottom: '8px' }}>Administrative Audit Log</h1>
                        <p style={{ color: 'var(--text-secondary)' }}>A chronological record of structural and administrative changes made to the guild.</p>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                placeholder="Search logs by action, user, or target..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                style={{ width: '100%', height: '40px', paddingLeft: '36px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '8px', color: 'white', outline: 'none' }}
                            />
                        </div>
                        <div ref={filterRef} style={{ position: 'relative' }}>
                            <div
                                onClick={() => setShowFilter(prev => !prev)}
                                style={{
                                    background: showFilter ? 'var(--accent-primary-alpha)' : 'var(--bg-elevated)',
                                    border: showFilter ? '1px solid var(--accent-primary)' : '1px solid var(--stroke)',
                                    borderRadius: '8px',
                                    padding: '0 16px',
                                    height: '40px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    color: showFilter ? 'var(--accent-primary)' : 'var(--text-primary)',
                                    transition: 'all 0.2s',
                                }}
                            >
                                <Filter size={14} /> Filter
                                {activeFilterCount > 0 && (
                                    <span style={{
                                        width: '18px', height: '18px', borderRadius: '50%',
                                        background: 'var(--accent-primary)', color: 'white',
                                        fontSize: '11px', fontWeight: 700,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        {activeFilterCount}
                                    </span>
                                )}
                            </div>

                            {showFilter && (
                                <div style={{
                                    position: 'absolute',
                                    top: '48px',
                                    right: 0,
                                    width: '300px',
                                    background: 'var(--bg-elevated)',
                                    border: '1px solid var(--stroke)',
                                    borderRadius: '12px',
                                    padding: '16px',
                                    boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
                                    zIndex: 30,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '16px',
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            Filters
                                        </span>
                                        {activeFilterCount > 0 && (
                                            <button onClick={clearFilters} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <X size={12} /> Clear All
                                            </button>
                                        )}
                                    </div>

                                    {/* Action Type */}
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                                            <Zap size={13} /> Action Type
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                            {AUDIT_ACTIONS.map(a => (
                                                <button
                                                    key={a}
                                                    onClick={() => setActionFilter(a)}
                                                    style={{
                                                        padding: '4px 10px',
                                                        borderRadius: '6px',
                                                        border: actionFilter === a ? '1px solid var(--accent-primary)' : '1px solid var(--stroke)',
                                                        background: actionFilter === a ? 'var(--accent-primary-alpha)' : 'var(--bg-tertiary)',
                                                        color: actionFilter === a ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                                        fontSize: '12px',
                                                        fontWeight: 500,
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s',
                                                    }}
                                                >
                                                    {a === 'all' ? 'All Actions' : (ACTION_LABELS[a] ?? a)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* User */}
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                                            <User size={13} /> User
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                            <button
                                                onClick={() => setUserFilter('all')}
                                                style={{
                                                    padding: '4px 10px',
                                                    borderRadius: '6px',
                                                    border: userFilter === 'all' ? '1px solid var(--accent-primary)' : '1px solid var(--stroke)',
                                                    background: userFilter === 'all' ? 'var(--accent-primary-alpha)' : 'var(--bg-tertiary)',
                                                    color: userFilter === 'all' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                                    fontSize: '12px',
                                                    fontWeight: 500,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s',
                                                }}
                                            >
                                                All Users
                                            </button>
                                            {uniqueUsers.map(u => (
                                                <button
                                                    key={u}
                                                    onClick={() => setUserFilter(u)}
                                                    style={{
                                                        padding: '4px 10px',
                                                        borderRadius: '6px',
                                                        border: userFilter === u ? '1px solid var(--accent-primary)' : '1px solid var(--stroke)',
                                                        background: userFilter === u ? 'var(--accent-primary-alpha)' : 'var(--bg-tertiary)',
                                                        color: userFilter === u ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                                        fontSize: '12px',
                                                        fontWeight: 500,
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s',
                                                    }}
                                                >
                                                    {u}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Active Filter Tags */}
                    {activeFilterCount > 0 && (
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                            {actionFilter !== 'all' && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '6px', background: 'var(--accent-primary-alpha)', border: '1px solid var(--accent-primary)', fontSize: '12px', fontWeight: 500, color: 'var(--accent-primary)' }}>
                                    Action: {ACTION_LABELS[actionFilter] ?? actionFilter}
                                    <X size={12} style={{ cursor: 'pointer' }} onClick={() => setActionFilter('all')} />
                                </span>
                            )}
                            {userFilter !== 'all' && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '6px', background: 'var(--accent-primary-alpha)', border: '1px solid var(--accent-primary)', fontSize: '12px', fontWeight: 500, color: 'var(--accent-primary)' }}>
                                    User: {userFilter}
                                    <X size={12} style={{ cursor: 'pointer' }} onClick={() => setUserFilter('all')} />
                                </span>
                            )}
                        </div>
                    )}

                    {/* Log Table */}
                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', overflow: 'hidden' }}>

                        {/* Table Header */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1.5fr) minmax(150px, 1fr) 200px', gap: '16px', padding: '16px 24px', borderBottom: '1px solid var(--stroke)', background: 'var(--bg-tertiary)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                            <div>Action & Target</div>
                            <div>User</div>
                            <div style={{ textAlign: 'right' }}>Date</div>
                        </div>

                        {/* Table Rows */}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {loading ? (
                                <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                                    Loading audit log...
                                </div>
                            ) : filteredLogs.length === 0 ? (
                                <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                                    No logs match the current filters.
                                </div>
                            ) : (
                                filteredLogs.map((log, index) => {
                                    const IconComp = ACTION_ICON_MAP[log.action] ?? ShieldAlert;
                                    const iconColor = ACTION_COLOR_MAP[log.action] ?? 'var(--text-muted)';
                                    const displayName = log.userDisplayName ?? log.userName;
                                    const description = formatActionDescription(log);

                                    return (
                                        <div
                                            key={log.id}
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'minmax(200px, 1.5fr) minmax(150px, 1fr) 200px',
                                                gap: '16px',
                                                padding: '16px 24px',
                                                borderBottom: index === filteredLogs.length - 1 ? 'none' : '1px solid var(--stroke)',
                                                alignItems: 'center',
                                                transition: 'background 0.2s',
                                            }}
                                            onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                            onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: iconColor, flexShrink: 0 }}>
                                                    <IconComp size={18} />
                                                </div>
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '2px' }}>
                                                        {ACTION_LABELS[log.action] ?? log.action}
                                                    </div>
                                                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {description}
                                                    </div>
                                                    {log.reason && (
                                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', fontStyle: 'italic' }}>
                                                            Reason: {log.reason}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{
                                                    width: '24px', height: '24px', borderRadius: '50%',
                                                    background: deterministicColor(displayName),
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '10px', color: 'white', fontWeight: 600, flexShrink: 0,
                                                }}>
                                                    {userInitial(displayName)}
                                                </div>
                                                <span style={{ fontSize: '14px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {displayName}
                                                </span>
                                            </div>

                                            <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'right' }}>
                                                {formatRelativeTime(log.createdAt)}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuditLog;
