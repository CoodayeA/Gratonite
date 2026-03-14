import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Search, Users, ChevronDown, Download, Shield, X } from 'lucide-react';
import { useToast } from '../../components/ui/ToastManager';
import { api, type PresenceStatus } from '../../lib/api';
import Avatar from '../../components/ui/Avatar';
import UserProfilePopover, { type PopoverUserInput } from '../../components/ui/UserProfilePopover';

interface Member {
    userId: string;
    username?: string;
    displayName?: string;
    nickname: string | null;
    avatarHash?: string | null;
    roleIds?: string[];
    roles?: string[];
    status?: PresenceStatus;
    joinedAt: string;
}

interface Role {
    id: string;
    name: string;
    color: string;
    position: number;
}

type SortKey = 'name' | 'joinDate' | 'status';
type StatusFilter = 'all' | 'online' | 'idle' | 'dnd' | 'offline';

const STATUS_COLORS: Record<string, string> = {
    online: '#43b581',
    idle: '#faa61a',
    dnd: '#f04747',
    offline: '#747f8d',
};

const STATUS_LABELS: Record<string, string> = {
    online: 'Online',
    idle: 'Idle',
    dnd: 'Do Not Disturb',
    offline: 'Offline',
    invisible: 'Offline',
};

const BATCH = 50;

const MemberDirectory = () => {
    const { guildId } = useParams<{ guildId: string }>();
    const { addToast } = useToast();

    const [members, setMembers] = useState<Member[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [hasMore, setHasMore] = useState(true);
    const offsetRef = useRef(0);

    // Filters
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
    const [sortBy, setSortBy] = useState<SortKey>('name');
    const [showRoleDropdown, setShowRoleDropdown] = useState(false);

    // Profile popover
    const [profileUser, setProfileUser] = useState<PopoverUserInput | null>(null);
    const [profilePos, setProfilePos] = useState<{ x: number; y: number } | null>(null);

    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
    const roleDropdownRef = useRef<HTMLDivElement>(null);

    // Close role dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target as Node)) {
                setShowRoleDropdown(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Fetch roles once
    useEffect(() => {
        if (!guildId) return;
        api.guilds.getRoles(guildId).then((data: any[]) => {
            const mapped: Role[] = data.map(r => ({
                id: r.id,
                name: r.name,
                color: r.color || '#99aab5',
                position: r.position ?? 0,
            })).sort((a, b) => b.position - a.position);
            setRoles(mapped);
        }).catch(() => {});
    }, [guildId]);

    // Fetch members
    const fetchMembers = useCallback(async (reset = false) => {
        if (!guildId) return;
        const offset = reset ? 0 : offsetRef.current;
        if (reset) {
            setIsLoading(true);
            setHasMore(true);
        }

        try {
            const params: any = { limit: BATCH, offset };
            if (search.trim()) params.search = search.trim();
            if (statusFilter === 'online') params.status = 'online';
            else if (statusFilter === 'offline') params.status = 'offline';

            const data = await api.guilds.getMembers(guildId, params);
            const mapped: Member[] = data.map((m: any) => ({
                userId: m.userId,
                username: m.username,
                displayName: m.displayName,
                nickname: m.nickname,
                avatarHash: m.avatarHash,
                roleIds: m.roleIds || m.roles || [],
                status: m.status || 'offline',
                joinedAt: m.joinedAt,
            }));

            if (reset) {
                setMembers(mapped);
                offsetRef.current = mapped.length;
            } else {
                setMembers(prev => [...prev, ...mapped]);
                offsetRef.current = offset + mapped.length;
            }

            if (mapped.length < BATCH) setHasMore(false);
        } catch {
            addToast({ title: 'Failed to load members', variant: 'error' });
        } finally {
            setIsLoading(false);
        }
    }, [guildId, search, statusFilter, addToast]);

    // Refetch on filter change (debounced for search)
    useEffect(() => {
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = setTimeout(() => {
            fetchMembers(true);
        }, search ? 300 : 0);
        return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
    }, [fetchMembers, search, statusFilter]);

    // Sort and filter
    const filtered = members.filter(m => {
        if (selectedRoles.length > 0) {
            const memberRoles = m.roleIds || [];
            if (!selectedRoles.some(r => memberRoles.includes(r))) return false;
        }
        return true;
    });

    const sorted = [...filtered].sort((a, b) => {
        if (sortBy === 'name') {
            const aName = (a.displayName || a.nickname || a.username || '').toLowerCase();
            const bName = (b.displayName || b.nickname || b.username || '').toLowerCase();
            return aName.localeCompare(bName);
        }
        if (sortBy === 'joinDate') {
            return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
        }
        if (sortBy === 'status') {
            const order: Record<string, number> = { online: 0, idle: 1, dnd: 2, offline: 3 };
            return (order[a.status || 'offline'] ?? 3) - (order[b.status || 'offline'] ?? 3);
        }
        return 0;
    });

    const handleExportCSV = () => {
        const header = 'Username,Display Name,Status,Joined At,Roles';
        const rows = sorted.map(m => {
            const name = (m.displayName || m.nickname || '').replace(/"/g, '""');
            const uname = (m.username || '').replace(/"/g, '""');
            const memberRoleNames = (m.roleIds || []).map(rid => roles.find(r => r.id === rid)?.name || rid).join('; ');
            return `"${uname}","${name}","${m.status || 'offline'}","${m.joinedAt}","${memberRoleNames}"`;
        });
        const csv = [header, ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `members-${guildId}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        addToast({ title: 'Members exported', variant: 'success' });
    };

    const handleMemberClick = (member: Member, e: React.MouseEvent) => {
        const name = member.displayName || member.nickname || member.username || 'Unknown';
        setProfileUser({
            id: member.userId,
            name,
            handle: member.username || member.userId,
            avatarHash: member.avatarHash,
            status: member.status || 'offline',
            guildId,
        });
        setProfilePos({ x: e.clientX, y: e.clientY });
    };

    const inputStyle: React.CSSProperties = {
        height: '36px',
        padding: '0 12px 0 34px',
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--stroke)',
        borderRadius: '8px',
        color: 'var(--text-primary)',
        outline: 'none',
        fontSize: '13px',
        width: '260px',
    };

    const selectStyle: React.CSSProperties = {
        height: '36px',
        padding: '0 12px',
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--stroke)',
        borderRadius: '8px',
        color: 'var(--text-primary)',
        outline: 'none',
        fontSize: '12px',
        cursor: 'pointer',
        appearance: 'auto',
    };

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', overflow: 'hidden' }}>
            <header className="channel-header glass-panel">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Users size={20} color="var(--text-muted)" />
                    <h2 style={{ fontSize: '15px', fontWeight: 600 }}>members</h2>
                </div>
            </header>

            <div style={{ flex: 1, overflowY: 'auto', padding: '32px 48px' }}>
                <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <div>
                            <h1 style={{ fontSize: '28px', fontWeight: 600, fontFamily: 'var(--font-display)', marginBottom: '4px' }}>Member Directory</h1>
                            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{members.length} members loaded</p>
                        </div>
                        <button onClick={handleExportCSV} style={{ padding: '8px 16px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '8px', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600 }}>
                            <Download size={14} /> Export CSV
                        </button>
                    </div>

                    {/* Filters */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                        {/* Search */}
                        <div style={{ position: 'relative' }}>
                            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search members..."
                                style={inputStyle}
                            />
                        </div>

                        {/* Status Filter */}
                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)} style={selectStyle}>
                            <option value="all">All Statuses</option>
                            <option value="online">Online</option>
                            <option value="idle">Idle</option>
                            <option value="dnd">Do Not Disturb</option>
                            <option value="offline">Offline</option>
                        </select>

                        {/* Role Filter */}
                        <div ref={roleDropdownRef} style={{ position: 'relative' }}>
                            <button onClick={() => setShowRoleDropdown(p => !p)} style={{ ...selectStyle, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', paddingRight: '8px' }}>
                                <Shield size={12} />
                                {selectedRoles.length > 0 ? `${selectedRoles.length} role${selectedRoles.length > 1 ? 's' : ''}` : 'All Roles'}
                                <ChevronDown size={12} />
                            </button>
                            {showRoleDropdown && (
                                <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '8px', padding: '6px', zIndex: 100, minWidth: '200px', maxHeight: '240px', overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                                    {selectedRoles.length > 0 && (
                                        <button onClick={() => setSelectedRoles([])} style={{ width: '100%', padding: '6px 8px', background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '11px', fontWeight: 600, textAlign: 'left', marginBottom: '4px' }}>
                                            Clear selection
                                        </button>
                                    )}
                                    {roles.map(role => (
                                        <label key={role.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
                                            <input
                                                type="checkbox"
                                                checked={selectedRoles.includes(role.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedRoles(prev => [...prev, role.id]);
                                                    else setSelectedRoles(prev => prev.filter(r => r !== role.id));
                                                }}
                                                style={{ accentColor: role.color }}
                                            />
                                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: role.color, flexShrink: 0 }} />
                                            <span style={{ color: 'var(--text-primary)' }}>{role.name}</span>
                                        </label>
                                    ))}
                                    {roles.length === 0 && (
                                        <div style={{ padding: '8px', color: 'var(--text-muted)', fontSize: '12px' }}>No roles found</div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Sort */}
                        <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)} style={selectStyle}>
                            <option value="name">Sort: Name</option>
                            <option value="joinDate">Sort: Join Date</option>
                            <option value="status">Sort: Status</option>
                        </select>

                        {/* Active filter pills */}
                        {(selectedRoles.length > 0 || statusFilter !== 'all' || search) && (
                            <button onClick={() => { setSearch(''); setStatusFilter('all'); setSelectedRoles([]); }} style={{ padding: '6px 12px', background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.3)', borderRadius: '16px', color: 'var(--error)', cursor: 'pointer', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <X size={10} /> Clear Filters
                            </button>
                        )}
                    </div>

                    {/* Member list */}
                    {isLoading && members.length === 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 0', color: 'var(--text-muted)' }}>
                            Loading members...
                        </div>
                    ) : sorted.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '64px 0' }}>
                            <Users size={48} color="var(--text-muted)" style={{ marginBottom: '16px', opacity: 0.5 }} />
                            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>No members found</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Try adjusting your filters.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {/* Table header */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 200px', padding: '8px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--stroke)' }}>
                                <span>Member</span>
                                <span>Status</span>
                                <span>Joined</span>
                            </div>

                            {sorted.map(member => {
                                const name = member.displayName || member.nickname || member.username || 'Unknown';
                                const memberRoles = (member.roleIds || []).map(rid => roles.find(r => r.id === rid)).filter(Boolean) as Role[];
                                const statusColor = STATUS_COLORS[member.status || 'offline'] || STATUS_COLORS.offline;
                                const statusLabel = STATUS_LABELS[member.status || 'offline'] || 'Offline';

                                return (
                                    <div
                                        key={member.userId}
                                        onClick={(e) => handleMemberClick(member, e)}
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 120px 200px',
                                            padding: '10px 16px',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            alignItems: 'center',
                                            transition: 'background 0.1s',
                                        }}
                                        onMouseOver={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                                        onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}
                                    >
                                        {/* Member info */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                                            <Avatar
                                                userId={member.userId}
                                                avatarHash={member.avatarHash}
                                                displayName={name}
                                                size={36}
                                                status={member.status}
                                            />
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontSize: '14px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {name}
                                                </div>
                                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '2px' }}>
                                                    {member.username && (
                                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>@{member.username}</span>
                                                    )}
                                                    {memberRoles.slice(0, 3).map(role => (
                                                        <span key={role.id} style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '10px', background: `${role.color}22`, color: role.color, fontWeight: 600, border: `1px solid ${role.color}44` }}>
                                                            {role.name}
                                                        </span>
                                                    ))}
                                                    {memberRoles.length > 3 && (
                                                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>+{memberRoles.length - 3}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
                                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{statusLabel}</span>
                                        </div>

                                        {/* Join date */}
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                            {new Date(member.joinedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </span>
                                    </div>
                                );
                            })}

                            {/* Load more */}
                            {hasMore && (
                                <button
                                    onClick={() => fetchMembers(false)}
                                    disabled={isLoading}
                                    style={{
                                        padding: '12px',
                                        background: 'var(--bg-tertiary)',
                                        border: '1px solid var(--stroke)',
                                        borderRadius: '8px',
                                        color: 'var(--text-secondary)',
                                        cursor: isLoading ? 'wait' : 'pointer',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        marginTop: '8px',
                                    }}
                                >
                                    {isLoading ? 'Loading...' : 'Load More Members'}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Profile Popover */}
            {profileUser && profilePos && (
                <UserProfilePopover
                    user={profileUser}
                    position={profilePos}
                    onClose={() => { setProfileUser(null); setProfilePos(null); }}
                />
            )}
        </div>
    );
};

export default MemberDirectory;
