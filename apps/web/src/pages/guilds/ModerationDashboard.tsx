import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Shield, AlertTriangle, Ban, Clock, Activity, Filter, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../components/ui/ToastManager';

interface ModAction {
    id: string;
    action: string;
    userName: string;
    targetName: string;
    reason: string | null;
    createdAt: string;
}

interface Warning {
    id: string;
    userId: string;
    username: string;
    reason: string;
    createdAt: string;
}

interface BannedUser {
    userId: string;
    username: string;
    displayName: string;
    reason: string | null;
    bannedAt: string;
}

interface AuditLogItem {
    id: string;
    action: string;
    userDisplayName?: string;
    userName?: string;
    targetId?: string;
    reason: string | null;
    createdAt: string;
}

interface TriageTicket {
    id: string;
    subject: string;
    status: string;
    priority: string;
    assigneeId?: string | null;
    createdAt: string;
    snoozedUntil?: string | null;
}

function StatCard({ icon: Icon, label, value, color }: { icon: typeof Shield; label: string; value: number; color: string }) {
    return (
        <div style={{
            background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '16px',
            border: '1px solid var(--stroke)', position: 'relative', overflow: 'hidden',
        }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: color }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Icon size={20} style={{ color, flexShrink: 0 }} />
                <div>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{label}</div>
                </div>
            </div>
        </div>
    );
}

function ActionBar({ data, labels, color }: { data: number[]; labels: string[]; color: string }) {
    const max = Math.max(...data, 1);
    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '80px' }}>
            {data.map((v, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                    <div style={{
                        width: '100%', height: `${Math.max((v / max) * 60, 2)}px`,
                        background: color, borderRadius: '2px 2px 0 0', opacity: 0.85,
                        transition: 'height 0.3s',
                    }} />
                    <span style={{ fontSize: '8px', color: 'var(--text-muted)' }}>{labels[i]}</span>
                </div>
            ))}
        </div>
    );
}

export default function ModerationDashboard() {
    const { guildId } = useParams<{ guildId: string }>();
    const { addToast } = useToast();
    const [recentActions, setRecentActions] = useState<ModAction[]>([]);
    const [warnings, setWarnings] = useState<Warning[]>([]);
    const [bans, setBans] = useState<BannedUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'actions' | 'bans' | 'automod'>('overview');
    const [triageTickets, setTriageTickets] = useState<TriageTicket[]>([]);
    const [triageLoading, setTriageLoading] = useState(false);
    const [selectedTicketIds, setSelectedTicketIds] = useState<Set<string>>(new Set());
    const [currentUserId, setCurrentUserId] = useState('');

    const fetchModerationData = useCallback(async () => {
        if (!guildId) return;
        setLoading(true);
        try {
            const [auditLog, warns, bannedUsers] = await Promise.all([
                api.guilds.getAuditLog(guildId, { limit: 50 }).catch(() => []),
                Promise.resolve([]),
                api.guilds.getBans(guildId).catch(() => []),
            ]);
            setRecentActions((auditLog as AuditLogItem[]).map((e) => ({
                id: e.id,
                action: e.action,
                userName: e.userDisplayName || e.userName || 'Unknown',
                targetName: e.targetId || '',
                reason: e.reason,
                createdAt: e.createdAt,
            })));
            setWarnings((warns as AuditLogItem[]).map((w) => ({
                id: w.id,
                userId: w.targetId || '',
                username: w.userName || w.userDisplayName || 'Unknown',
                reason: w.reason || 'No reason',
                createdAt: w.createdAt,
            })));
            setBans(bannedUsers as BannedUser[]);
        } finally {
            setLoading(false);
        }
    }, [guildId]);

    const fetchTriageTickets = useCallback(async () => {
        if (!guildId) return;
        setTriageLoading(true);
        try {
            const [open, inProgress] = await Promise.all([
                api.tickets.list(guildId, { status: 'open' }).catch(() => []),
                api.tickets.list(guildId, { status: 'in_progress' }).catch(() => []),
            ]);
            const merged = [...(open as TriageTicket[]), ...(inProgress as TriageTicket[])];
            merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            setTriageTickets(merged);
            setSelectedTicketIds(prev => new Set(Array.from(prev).filter(id => merged.some(t => t.id === id))));
        } finally {
            setTriageLoading(false);
        }
    }, [guildId]);

    useEffect(() => {
        if (!guildId) return;
        void fetchModerationData();
        void fetchTriageTickets();
    }, [guildId, fetchModerationData, fetchTriageTickets]);

    useEffect(() => {
        api.users.getMe().then(me => setCurrentUserId(me.id)).catch(() => {});
    }, []);

    const toggleTicketSelection = (ticketId: string) => {
        setSelectedTicketIds(prev => {
            const next = new Set(prev);
            if (next.has(ticketId)) next.delete(ticketId);
            else next.add(ticketId);
            return next;
        });
    };

    const assignTicketToMe = async (ticketId: string) => {
        if (!guildId || !currentUserId) return;
        try {
            await api.tickets.update(guildId, ticketId, { assigneeId: currentUserId, status: 'in_progress' });
            addToast({ title: 'Ticket assigned to you', variant: 'success' });
            await fetchTriageTickets();
        } catch {
            addToast({ title: 'Failed to assign ticket', variant: 'error' });
        }
    };

    const snoozeTicket = async (ticketId: string, minutes: number) => {
        if (!guildId) return;
        const snoozedUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
        try {
            await api.tickets.update(guildId, ticketId, { status: 'open', snoozedUntil });
            addToast({ title: `Ticket snoozed for ${minutes}m`, variant: 'success' });
            await fetchTriageTickets();
        } catch {
            addToast({ title: 'Failed to snooze ticket', variant: 'error' });
        }
    };

    const bulkResolveSelected = async () => {
        if (!guildId || selectedTicketIds.size === 0) return;
        const ids = Array.from(selectedTicketIds);
        try {
            await Promise.all(ids.map(id => api.tickets.update(guildId, id, { status: 'resolved' })));
            addToast({ title: `Resolved ${ids.length} ticket${ids.length === 1 ? '' : 's'}`, variant: 'success' });
            setSelectedTicketIds(new Set());
            await fetchTriageTickets();
            await fetchModerationData();
        } catch {
            addToast({ title: 'Failed to resolve selected tickets', variant: 'error' });
        }
    };

    const tabs = [
        { key: 'overview' as const, label: 'Overview', icon: Activity },
        { key: 'actions' as const, label: 'Actions', icon: Shield },
        { key: 'bans' as const, label: 'Bans', icon: Ban },
        { key: 'automod' as const, label: 'Automod', icon: Filter },
    ];

    // Generate sample chart series from recent actions
    const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d.toLocaleDateString('en', { weekday: 'short' });
    });
    const actionCounts = last7Days.map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const dayStr = d.toISOString().slice(0, 10);
        return recentActions.filter(a => a.createdAt?.startsWith(dayStr)).length;
    });

    const actionColor: Record<string, string> = {
        MEMBER_BAN: 'var(--error)',
        MEMBER_KICK: 'var(--warning)',
        MEMBER_UNBAN: 'var(--success)',
        GUILD_UPDATE: 'var(--accent-primary)',
        CHANNEL_CREATE: 'var(--success)',
        CHANNEL_DELETE: 'var(--error)',
    };

    return (
        <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <Shield size={24} style={{ color: 'var(--accent-primary)' }} />
                <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700 }}>Moderation Dashboard</h1>
                <button
                    onClick={() => {
                        void fetchModerationData();
                        void fetchTriageTickets();
                    }}
                    style={{
                        marginLeft: 'auto', padding: '6px 12px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                        color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '6px',
                    }}
                >
                    <RefreshCw size={12} /> Refresh
                </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid var(--stroke)', paddingBottom: '4px' }}>
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        style={{
                            padding: '8px 16px', borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
                            background: activeTab === tab.key ? 'var(--bg-elevated)' : 'transparent',
                            border: activeTab === tab.key ? '1px solid var(--stroke)' : '1px solid transparent',
                            borderBottom: activeTab === tab.key ? '1px solid var(--bg-elevated)' : '1px solid transparent',
                            color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
                            fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '6px',
                            marginBottom: '-5px',
                        }}
                    >
                        <tab.icon size={14} /> {tab.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>Loading...</div>
            ) : activeTab === 'overview' ? (
                <>
                    {/* Stats cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                        <StatCard icon={Shield} label="Total Actions (7d)" value={recentActions.length} color="var(--accent-primary)" />
                        <StatCard icon={AlertTriangle} label="Active Warnings" value={warnings.length} color="var(--warning)" />
                        <StatCard icon={Ban} label="Banned Users" value={bans.length} color="var(--error)" />
                        <StatCard icon={Clock} label="Recent Kicks" value={recentActions.filter(a => a.action === 'MEMBER_KICK').length} color="#f59e0b" />
                    </div>

                    {/* Actions chart */}
                    <div style={{
                        background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '16px',
                        border: '1px solid var(--stroke)', marginBottom: '24px',
                    }}>
                        <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>Mod Actions (Last 7 Days)</h3>
                        <ActionBar data={actionCounts} labels={last7Days} color="var(--accent-primary)" />
                    </div>

                    {/* Recent actions list */}
                    <div style={{
                        background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '16px',
                        border: '1px solid var(--stroke)',
                    }}>
                        <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>Recent Mod Actions</h3>
                        {recentActions.length === 0 ? (
                            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px', fontSize: '13px' }}>No mod actions recorded.</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '300px', overflowY: 'auto' }}>
                                {recentActions.slice(0, 20).map(a => (
                                    <div key={a.id} style={{
                                        display: 'flex', alignItems: 'center', gap: '10px', padding: '8px',
                                        background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)',
                                    }}>
                                        <div style={{
                                            width: '8px', height: '8px', borderRadius: '50%',
                                            background: actionColor[a.action] || 'var(--text-muted)',
                                            flexShrink: 0,
                                        }} />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{a.userName}</span>
                                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}> {a.action.replace(/_/g, ' ').toLowerCase()}</span>
                                            {a.reason && <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Reason: {a.reason}</span>}
                                        </div>
                                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>
                                            {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : ''}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            ) : activeTab === 'bans' ? (
                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '16px', border: '1px solid var(--stroke)' }}>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>Banned Users ({bans.length})</h3>
                    {bans.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px', fontSize: '13px' }}>No banned users.</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {bans.map(b => (
                                <div key={b.userId} style={{
                                    display: 'flex', alignItems: 'center', gap: '10px', padding: '8px',
                                    background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)',
                                }}>
                                    <Ban size={14} style={{ color: 'var(--error)', flexShrink: 0 }} />
                                    <div style={{ flex: 1 }}>
                                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{b.displayName || b.username}</span>
                                        {b.reason && <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>{b.reason}</span>}
                                    </div>
                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{new Date(b.bannedAt).toLocaleDateString()}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : activeTab === 'automod' ? (
                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '24px', border: '1px solid var(--stroke)', textAlign: 'center' }}>
                    <Filter size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Automod triggers and settings can be configured in Server Settings.</p>
                </div>
            ) : (
                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '16px', border: '1px solid var(--stroke)' }}>
                    <div style={{
                        marginBottom: '14px',
                        border: '1px solid var(--stroke)',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-primary)',
                        padding: '12px',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
                            <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700 }}>Triage Queue</h3>
                            <button
                                onClick={bulkResolveSelected}
                                disabled={selectedTicketIds.size === 0}
                                style={{
                                    padding: '6px 10px',
                                    borderRadius: 'var(--radius-sm)',
                                    border: '1px solid var(--stroke)',
                                    background: selectedTicketIds.size > 0 ? 'var(--success)' : 'var(--bg-tertiary)',
                                    color: selectedTicketIds.size > 0 ? '#fff' : 'var(--text-muted)',
                                    fontSize: '12px',
                                    cursor: selectedTicketIds.size > 0 ? 'pointer' : 'not-allowed',
                                    opacity: selectedTicketIds.size > 0 ? 1 : 0.7,
                                }}
                            >
                                Bulk Resolve ({selectedTicketIds.size})
                            </button>
                        </div>

                        {triageLoading ? (
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Loading triage queue...</div>
                        ) : triageTickets.length === 0 ? (
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No open triage tickets.</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                                {triageTickets.map(ticket => (
                                    <div key={ticket.id} style={{
                                        display: 'grid',
                                        gridTemplateColumns: '20px 1fr auto',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '8px',
                                        background: 'var(--bg-tertiary)',
                                        borderRadius: 'var(--radius-sm)',
                                        border: '1px solid var(--stroke)',
                                    }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedTicketIds.has(ticket.id)}
                                            onChange={() => toggleTicketSelection(ticket.id)}
                                            aria-label={`Select ticket ${ticket.subject}`}
                                        />
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {ticket.subject || 'Untitled ticket'}
                                            </div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                {ticket.status.replace('_', ' ')} · {ticket.priority || 'medium'} · {new Date(ticket.createdAt).toLocaleDateString()}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <button
                                                onClick={() => { void assignTicketToMe(ticket.id); }}
                                                style={{
                                                    padding: '4px 8px',
                                                    borderRadius: 'var(--radius-sm)',
                                                    border: '1px solid var(--stroke)',
                                                    background: 'var(--bg-primary)',
                                                    color: 'var(--text-secondary)',
                                                    fontSize: '11px',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                Assign Me
                                            </button>
                                            <button
                                                onClick={() => { void snoozeTicket(ticket.id, 120); }}
                                                style={{
                                                    padding: '4px 8px',
                                                    borderRadius: 'var(--radius-sm)',
                                                    border: '1px solid var(--stroke)',
                                                    background: 'var(--bg-primary)',
                                                    color: 'var(--text-secondary)',
                                                    fontSize: '11px',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                Snooze 2h
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>All Actions</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '500px', overflowY: 'auto' }}>
                        {recentActions.map(a => (
                            <div key={a.id} style={{
                                display: 'flex', alignItems: 'center', gap: '10px', padding: '8px',
                                background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)',
                            }}>
                                <div style={{
                                    width: '8px', height: '8px', borderRadius: '50%',
                                    background: actionColor[a.action] || 'var(--text-muted)',
                                    flexShrink: 0,
                                }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{a.userName}</span>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}> {a.action.replace(/_/g, ' ').toLowerCase()}</span>
                                    {a.reason && <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Reason: {a.reason}</span>}
                                </div>
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>
                                    {a.createdAt ? new Date(a.createdAt).toLocaleString() : ''}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
