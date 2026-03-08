import { useState, useEffect } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { Activity, Users, MessageSquare, ArrowUpRight, ArrowDownRight, TrendingUp, Hash, Star, Calendar, BarChart2, Clock, Zap, Shield, Loader2, AlertCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../components/ui/ToastManager';

const PERIODS = ['7d', '30d', '90d', 'All'] as const;
type Period = typeof PERIODS[number];

// ── Helpers ──────────────────────────────────────────────────────────────────

const AdminAnalytics = () => {
    const { hasCustomBg } = useOutletContext<{ hasCustomBg: boolean }>();
    const { addToast } = useToast();
    const { guildId } = useParams<{ guildId: string }>();
    const [period, setPeriod] = useState<Period>('7d');

    // Data state
    const [guild, setGuild] = useState<any>(null);
    const [members, setMembers] = useState<any[]>([]);
    const [events, setEvents] = useState<any[]>([]);
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [channels, setChannels] = useState<any[]>([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAll = () => {
        if (!guildId) return;
        setLoading(true);
        setError(null);

        const leaderboardPeriod = period === '7d' ? 'week' : period === '30d' ? 'month' : 'all';

        Promise.all([
            api.guilds.get(guildId),
            api.guilds.getMembers(guildId, { limit: 100 }),
            api.events.list(guildId),
            api.leaderboard.get(leaderboardPeriod),
            api.channels.getGuildChannels(guildId),
        ])
            .then(([guildData, memberData, eventData, lbData, channelData]) => {
                setGuild(guildData);
                setMembers(memberData);
                setEvents(eventData);
                setLeaderboard(lbData);
                setChannels(channelData.filter((c: any) => c.type === 'text' || c.type === 'TEXT'));
            })
            .catch(err => {
                setError(err.message ?? 'Failed to load analytics.');
                addToast({ title: 'Error loading analytics', description: err.message ?? 'Something went wrong.', variant: 'error' });
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchAll();
    }, [guildId, period]);

    // ── Derived values ───────────────────────────────────────────────────────

    const totalMembers = guild?.memberCount ?? members.length;
    const onlineCount = members.filter((m: any) => m.status === 'online' || m.status === 'idle').length;
    const upcomingEvents = events.filter((e: any) => e.status !== 'COMPLETED' && e.status !== 'CANCELLED');
    const completedEvents = events.filter((e: any) => e.status === 'COMPLETED');
    const topMembers = leaderboard.slice(0, 5);

    // Top channels — just list names, no fabricated message counts
    const topChannels = channels.slice(0, 5).map((ch) => ({
        name: ch.name,
    }));

    const kpis = [
        { label: 'Total Members', value: totalMembers.toLocaleString(), delta: `${totalMembers} total`, up: true, icon: <Users size={16} />, color: 'var(--accent-primary)' },
        { label: 'Online Now', value: onlineCount > 0 ? onlineCount.toLocaleString() : '—', delta: 'Live count', up: true, icon: <Activity size={16} />, color: '#10b981' },
        { label: 'Upcoming Events', value: upcomingEvents.length.toString(), delta: `${completedEvents.length} completed`, up: upcomingEvents.length > 0, icon: <Calendar size={16} />, color: '#f59e0b' },
        { label: 'Leaderboard Size', value: leaderboard.length.toString(), delta: 'Active contributors', up: leaderboard.length > 0, icon: <MessageSquare size={16} />, color: '#6366f1' },
    ];

    // ── Render ───────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <main className={`main-view ${hasCustomBg ? 'has-custom-bg' : ''}`} style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
                <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-primary)' }} />
                <p style={{ color: 'var(--text-muted)' }}>Loading analytics...</p>
            </main>
        );
    }

    if (error) {
        return (
            <main className={`main-view ${hasCustomBg ? 'has-custom-bg' : ''}`} style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
                <AlertCircle size={32} color="var(--error)" />
                <p style={{ color: 'var(--error)', fontSize: '15px' }}>{error}</p>
                <button onClick={fetchAll} className="auth-button" style={{ width: 'auto', padding: '0 24px', height: '36px', margin: 0 }}>
                    Retry
                </button>
            </main>
        );
    }

    return (
        <main className={`main-view ${hasCustomBg ? 'has-custom-bg' : ''}`} style={{ padding: '0', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            {/* Header */}
            <div style={{ padding: '28px 32px', borderBottom: '1px solid var(--stroke)', background: 'var(--bg-elevated)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <div>
                    <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Activity size={22} color="var(--accent-primary)" /> Server Insights
                        {guild && <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '4px' }}>— {guild.name}</span>}
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Activity, growth, and engagement analytics for your portal.</p>
                </div>
                {/* Period selector */}
                <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '4px', gap: '2px', border: '1px solid var(--stroke)' }}>
                    {PERIODS.map(p => (
                        <button key={p} onClick={() => setPeriod(p)} style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: period === p ? 'var(--accent-primary)' : 'transparent', color: period === p ? '#000' : 'var(--text-secondary)', fontWeight: 600, fontSize: '13px', cursor: 'pointer', transition: 'all 0.15s' }}>
                            {p}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto', flex: 1 }}>
                {/* KPI Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                    {kpis.map(kpi => (
                        <div key={kpi.label} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '14px', padding: '20px', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: kpi.color }} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', marginBottom: '10px', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
                                <span style={{ color: kpi.color }}>{kpi.icon}</span> {kpi.label}
                            </div>
                            <div style={{ fontSize: '28px', fontWeight: 800, marginBottom: '6px', fontFamily: 'var(--font-display)' }}>{kpi.value}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: kpi.up ? '#10b981' : 'var(--error)', fontSize: '12px', fontWeight: 600 }}>
                                {kpi.up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                                {kpi.delta}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Charts Row — empty state until tracking is configured */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
                    {/* Member Growth */}
                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '14px', padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}><TrendingUp size={16} color="var(--accent-primary)" /> Membership Growth</h3>
                        </div>
                        <div style={{ height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px', flexDirection: 'column', gap: '8px' }}>
                            <TrendingUp size={28} style={{ opacity: 0.3 }} />
                            <span>Growth data will appear here once tracking is configured.</span>
                        </div>
                    </div>

                    {/* Activity by Hour */}
                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '14px', padding: '24px' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}><Clock size={16} color="#6366f1" /> Activity by Hour (UTC)</h3>
                        <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px', flexDirection: 'column', gap: '8px' }}>
                            <Clock size={24} style={{ opacity: 0.3 }} />
                            <span>No activity data available yet.</span>
                        </div>
                    </div>
                </div>

                {/* Message Volume + Top Channels */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
                    {/* Message Volume */}
                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '14px', padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}><BarChart2 size={16} color="#6366f1" /> Message Volume</h3>
                        </div>
                        <div style={{ height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px', flexDirection: 'column', gap: '8px' }}>
                            <BarChart2 size={28} style={{ opacity: 0.3 }} />
                            <span>Analytics data will appear here once tracking is configured.</span>
                        </div>
                    </div>

                    {/* Top Channels */}
                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '14px', padding: '24px' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}><Hash size={16} color="#10b981" /> Channels</h3>
                        {topChannels.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No channels found.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {topChannels.map(ch => (
                                    <div key={ch.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '6px', background: 'var(--bg-tertiary)', fontSize: '13px', fontWeight: 500 }}>
                                        <Hash size={14} color="var(--text-muted)" /> #{ch.name}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Top Members + Recent Events */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    {/* Top Members */}
                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '14px', padding: '24px' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}><Star size={16} color="#f59e0b" /> Most Active Members</h3>
                        {topMembers.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No leaderboard data yet.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {topMembers.map((m: any, i: number) => (
                                    <div key={m.userId ?? m.username} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', borderRadius: '8px', background: 'var(--bg-tertiary)' }}>
                                        <span style={{ width: '20px', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>#{m.rank ?? i + 1}</span>
                                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                                            {(m.displayName ?? m.username ?? '?').charAt(0).toUpperCase()}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600, fontSize: '14px' }}>{m.displayName ?? m.username}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{(m.fameReceived ?? 0).toLocaleString()} FAME • {((m.fameReceived ?? 0) * 200).toLocaleString()} Gratonites</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Recent Events */}
                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '14px', padding: '24px' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}><Calendar size={16} color="#ec4899" /> Recent Events</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {events.length === 0 ? (
                                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No events found.</p>
                            ) : (
                                events.slice(0, 4).map((ev: any) => (
                                    <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)' }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '2px' }}>{ev.name}</div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{ev.startTime ? new Date(ev.startTime).toLocaleDateString() : 'TBD'} • {ev.entityType ?? 'Event'}</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontWeight: 700, color: 'var(--accent-primary)', fontSize: '16px' }}>{ev.subscriberCount ?? ev.attendees ?? '—'}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>interested</div>
                                        </div>
                                    </div>
                                ))
                            )}

                            <div style={{ marginTop: '8px', padding: '12px', borderRadius: '8px', background: 'rgba(82, 109, 245, 0.08)', border: '1px solid var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Total events this period</span>
                                <span style={{ fontWeight: 700, fontSize: '18px', color: 'var(--accent-primary)' }}>{events.length}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Health Summary */}
                <div style={{ background: 'linear-gradient(135deg, rgba(82, 109, 245, 0.06), rgba(16, 185, 129, 0.06))', border: '1px solid var(--stroke)', borderRadius: '14px', padding: '24px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Zap size={16} color="#f59e0b" /> Portal Health Score
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '13px', flexDirection: 'column', gap: '8px' }}>
                        <Shield size={28} style={{ opacity: 0.3 }} />
                        <span>Health scores will appear here once tracking is configured.</span>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default AdminAnalytics;
