import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Shield, AlertTriangle, Ban, Clock, MessageSquare, Activity, Filter, RefreshCw } from 'lucide-react';
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

    useEffect(() => {
        if (!guildId) return;
        setLoading(true);
        Promise.all([
            api.guilds.getAuditLog(guildId, { limit: 50 }).catch(() => []),
            Promise.resolve([]),
            api.guilds.getBans(guildId).catch(() => []),
        ]).then(([auditLog, warns, bannedUsers]) => {
            setRecentActions((auditLog as any[]).map((e: any) => ({
                id: e.id,
                action: e.action,
                userName: e.userDisplayName || e.userName || 'Unknown',
                targetName: e.targetId || '',
                reason: e.reason,
                createdAt: e.createdAt,
            })));
            setWarnings((warns as any[]).map((w: any) => ({
                id: w.id,
                userId: w.userId,
                username: w.username || w.userDisplayName || 'Unknown',
                reason: w.reason || 'No reason',
                createdAt: w.createdAt,
            })));
            setBans(bannedUsers as BannedUser[]);
            setLoading(false);
        });
    }, [guildId]);

    const tabs = [
        { key: 'overview' as const, label: 'Overview', icon: Activity },
        { key: 'actions' as const, label: 'Actions', icon: Shield },
        { key: 'bans' as const, label: 'Bans', icon: Ban },
        { key: 'automod' as const, label: 'Automod', icon: Filter },
    ];

    // Generate mock chart data from recent actions
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
                    onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 500); }}
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
