import { useState, useEffect } from 'react';
import { Trophy, TrendingUp, TrendingDown, Minus, Crown, MessageSquare, Zap, Star, Users, Settings2, ChevronDown } from 'lucide-react';
import { useToast } from '../../components/ui/ToastManager';
import { api } from '../../lib/api';

type Metric = 'xp' | 'messages' | 'fame' | 'invites' | 'events';
type Timeframe = 'weekly' | 'monthly' | 'alltime';

const METRICS: { key: Metric; label: string; icon: React.ReactNode; unit: string }[] = [
    { key: 'xp', label: 'Experience', icon: <Zap size={14} />, unit: 'XP' },
    { key: 'messages', label: 'Messages Sent', icon: <MessageSquare size={14} />, unit: 'msgs' },
    { key: 'fame', label: 'FAME Score', icon: <Star size={14} />, unit: 'FAME' },
    { key: 'invites', label: 'Invites', icon: <Users size={14} />, unit: 'inv' },
    { key: 'events', label: 'Events Attended', icon: <Trophy size={14} />, unit: 'events' },
];

const TIMEFRAMES: { key: Timeframe; label: string }[] = [
    { key: 'weekly', label: 'This Week' },
    { key: 'monthly', label: 'This Month' },
    { key: 'alltime', label: 'All Time' },
];

type UserEntry = {
    rank: number;
    username: string;
    displayName: string;
    avatar: string;
    color: string;
    change: 'up' | 'down' | 'same' | 'new';
    scores: Record<Metric, Record<Timeframe, number>>;
    roles: string[];
    isCurrentUser?: boolean;
};

const AVATAR_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#f97316'];
function userColor(userId: string): string {
    return AVATAR_COLORS[userId.charCodeAt(0) % AVATAR_COLORS.length];
}

const medalColor = (rank: number) => rank === 1 ? '#f59e0b' : rank === 2 ? '#d1d5db' : rank === 3 ? '#b45309' : '';

const Leaderboard = () => {
    const [metric, setMetric] = useState<Metric>('xp');
    const [timeframe, setTimeframe] = useState<Timeframe>('weekly');
    const [showConfig, setShowConfig] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [resetPeriod, setResetPeriod] = useState('Weekly (Monday reset)');
    const [users, setUsers] = useState<UserEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { addToast } = useToast();

    useEffect(() => {
        setIsLoading(true);
        setError(null);
        const periodMap: Record<Timeframe, 'week' | 'month' | 'all'> = {
            weekly: 'week',
            monthly: 'month',
            alltime: 'all',
        };
        api.leaderboard.get(periodMap[timeframe]).then(data => {
            const mapped: UserEntry[] = data.map(entry => ({
                rank: entry.rank,
                username: entry.username,
                displayName: entry.displayName,
                avatar: (entry.displayName || entry.username).charAt(0).toUpperCase(),
                color: userColor(entry.userId),
                change: 'same' as const,
                scores: {
                    xp: { weekly: entry.fameReceived, monthly: entry.fameReceived, alltime: entry.fameReceived },
                    messages: { weekly: 0, monthly: 0, alltime: 0 },
                    fame: { weekly: entry.fameReceived, monthly: entry.fameReceived, alltime: entry.fameReceived },
                    invites: { weekly: 0, monthly: 0, alltime: 0 },
                    events: { weekly: 0, monthly: 0, alltime: 0 },
                },
                roles: [],
                isCurrentUser: false,
            }));
            setUsers(mapped);
        }).catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : 'Failed to load leaderboard';
            setError(msg);
            addToast({ title: 'Failed to load leaderboard', variant: 'error' });
        }).finally(() => {
            setIsLoading(false);
        });
    }, [timeframe]);

    const sorted = [...users].sort((a, b) => b.scores[metric][timeframe] - a.scores[metric][timeframe])
        .map((u, i) => ({ ...u, displayRank: i + 1 }));

    const topThree = sorted.slice(0, 3);
    const rest = sorted.slice(3);
    const currentMetric = METRICS.find(m => m.key === metric)!;

    // Loading state
    if (isLoading) {
        return (
            <div style={{ flex: 1, padding: '32px 48px', overflowY: 'auto', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading leaderboard…</div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div style={{ flex: 1, padding: '32px 48px', overflowY: 'auto', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ color: 'var(--error)', fontSize: '14px' }}>{error}</div>
            </div>
        );
    }

    // Guard: show empty state when no data
    if (sorted.length === 0) {
        return (
            <div style={{ flex: 1, padding: '32px 48px', overflowY: 'auto', background: 'var(--bg-primary)' }}>
                <div style={{ maxWidth: '860px', margin: '0 auto', textAlign: 'center', paddingTop: '80px' }}>
                    <div style={{ width: '72px', height: '72px', margin: '0 auto 14px', background: 'var(--bg-tertiary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--stroke)' }}>
                        <Trophy size={36} color="var(--text-muted)" />
                    </div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: '8px' }}>No Rankings Yet</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Leaderboard data will appear once members start earning XP.</p>
                </div>
            </div>
        );
    }

    const formatScore = (val: number) => val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toString();

    return (
        <div style={{ flex: 1, padding: '32px 48px', overflowY: 'auto', background: 'var(--bg-primary)' }}>
            <div style={{ maxWidth: '860px', margin: '0 auto' }}>
                {/* Header */}
                <header style={{ marginBottom: '36px', textAlign: 'center' }}>
                    <div style={{ width: '72px', height: '72px', margin: '0 auto 14px', background: 'var(--bg-tertiary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--stroke)' }}>
                        <Trophy size={36} color="#f59e0b" />
                    </div>
                    <h1 style={{ fontSize: '26px', fontWeight: 700, fontFamily: 'var(--font-display)', marginBottom: '6px' }}>Portal Leaderboard</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Chat, attend events, and earn FAME to climb the ranks.</p>
                </header>

                {/* Controls */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '12px' }}>
                    {/* Metric selector */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {METRICS.map(m => (
                            <button key={m.key} onClick={() => setMetric(m.key)} style={{ padding: '7px 14px', borderRadius: '8px', border: `1px solid ${metric === m.key ? 'var(--accent-primary)' : 'var(--stroke)'}`, background: metric === m.key ? 'rgba(82, 109, 245, 0.12)' : 'var(--bg-tertiary)', color: metric === m.key ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: 600, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s' }}>
                                {m.icon} {m.label}
                            </button>
                        ))}
                    </div>

                    {/* Timeframe + config */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '3px', border: '1px solid var(--stroke)' }}>
                            {TIMEFRAMES.map(t => (
                                <button key={t.key} onClick={() => setTimeframe(t.key)} style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', background: timeframe === t.key ? 'var(--accent-primary)' : 'transparent', color: timeframe === t.key ? '#000' : 'var(--text-secondary)', fontWeight: 600, fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s' }}>
                                    {t.label}
                                </button>
                            ))}
                        </div>
                        <button onClick={() => setShowConfig(!showConfig)} style={{ padding: '8px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 600 }}>
                            <Settings2 size={14} /> Config <ChevronDown size={12} style={{ transform: showConfig ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
                        </button>
                    </div>
                </div>

                {/* Admin Config Panel */}
                {showConfig && (
                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--accent-primary)', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
                        <h4 style={{ fontWeight: 600, fontSize: '14px', marginBottom: '12px', color: 'var(--accent-primary)' }}>Admin: Configure Tracked Metrics</h4>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>Choose which metrics appear on the leaderboard. Members can only see enabled metrics.</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                            {METRICS.map(m => (
                                <label key={m.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--stroke)', cursor: 'pointer', fontSize: '13px' }}>
                                    <input type="checkbox" defaultChecked style={{ accentColor: 'var(--accent-primary)' }} />
                                    {m.icon} {m.label}
                                </label>
                            ))}
                        </div>
                        <div style={{ marginTop: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Reset period:</label>
                            <select value={resetPeriod} onChange={e => setResetPeriod(e.target.value)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '6px', color: 'var(--text-primary)', padding: '6px 10px', fontSize: '13px' }}>
                                <option>Weekly (Monday reset)</option>
                                <option>Monthly (1st of month)</option>
                                <option>Never (manual reset)</option>
                            </select>
                            <button onClick={() => { addToast({ title: 'Config Saved', description: 'Leaderboard settings updated.', variant: 'success' }); setShowConfig(false); }} style={{ padding: '6px 16px', borderRadius: '6px', background: 'var(--accent-primary)', border: 'none', color: '#000', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>Save Config</button>
                        </div>
                    </div>
                )}

                {/* Podium */}
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '16px', marginBottom: '56px', height: '260px' }}>
                    {/* Rank 2 */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '150px' }}>
                        <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ width: '76px', height: '76px', borderRadius: '50%', background: topThree[1].color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', fontWeight: 'bold', border: '4px solid var(--bg-primary)', boxShadow: `0 8px 16px rgba(0,0,0,0.2), 0 0 0 2px ${medalColor(2)}`, position: 'relative', color: 'white' }}>
                                {topThree[1].avatar}
                                <div style={{ position: 'absolute', bottom: -12, background: medalColor(2), color: 'black', width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 900 }}>2</div>
                            </div>
                            <span style={{ marginTop: '20px', fontWeight: 600, fontSize: '15px' }}>{topThree[1].displayName}</span>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>{currentMetric.icon} {formatScore(topThree[1].scores[metric][timeframe])} {currentMetric.unit}</span>
                        </div>
                        <div style={{ width: '100%', height: '110px', background: 'var(--bg-elevated)', borderTopLeftRadius: '12px', borderTopRightRadius: '12px', border: '1px solid var(--stroke)', borderBottom: 'none' }} />
                    </div>

                    {/* Rank 1 */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '170px', zIndex: 10 }}>
                        <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <Crown size={24} color="#f59e0b" style={{ marginBottom: '8px' }} />
                            <div style={{ width: '92px', height: '92px', borderRadius: '50%', background: topThree[0].color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '34px', fontWeight: 'bold', border: '4px solid var(--bg-primary)', boxShadow: `0 8px 24px rgba(0,0,0,0.3), 0 0 0 3px ${medalColor(1)}`, position: 'relative', color: 'white' }}>
                                {topThree[0].avatar}
                                <div style={{ position: 'absolute', bottom: -14, background: medalColor(1), color: 'black', width: '30px', height: '30px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 900 }}>1</div>
                            </div>
                            <span style={{ marginTop: '22px', fontWeight: 700, fontSize: '17px', color: '#f59e0b' }}>{topThree[0].displayName}</span>
                            <span style={{ fontSize: '12px', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>{currentMetric.icon} {formatScore(topThree[0].scores[metric][timeframe])} {currentMetric.unit}</span>
                        </div>
                        <div style={{ width: '100%', height: '150px', background: 'linear-gradient(to top, var(--bg-elevated), rgba(245, 158, 11, 0.08))', borderTopLeftRadius: '12px', borderTopRightRadius: '12px', border: '1px solid var(--stroke)', borderTopColor: '#f59e0b', borderBottom: 'none' }} />
                    </div>

                    {/* Rank 3 */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '150px' }}>
                        <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ width: '76px', height: '76px', borderRadius: '50%', background: topThree[2].color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', fontWeight: 'bold', border: '4px solid var(--bg-primary)', boxShadow: `0 8px 16px rgba(0,0,0,0.2), 0 0 0 2px ${medalColor(3)}`, position: 'relative', color: 'white' }}>
                                {topThree[2].avatar}
                                <div style={{ position: 'absolute', bottom: -12, background: medalColor(3), color: 'white', width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 900 }}>3</div>
                            </div>
                            <span style={{ marginTop: '20px', fontWeight: 600, fontSize: '15px' }}>{topThree[2].displayName}</span>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>{currentMetric.icon} {formatScore(topThree[2].scores[metric][timeframe])} {currentMetric.unit}</span>
                        </div>
                        <div style={{ width: '100%', height: '80px', background: 'var(--bg-elevated)', borderTopLeftRadius: '12px', borderTopRightRadius: '12px', border: '1px solid var(--stroke)', borderBottom: 'none' }} />
                    </div>
                </div>

                {/* Full Rankings Table */}
                <div style={{ background: 'var(--bg-elevated)', borderRadius: '14px', border: '1px solid var(--stroke)', overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr 100px 130px', padding: '12px 24px', borderBottom: '1px solid var(--stroke)', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <div>Rank</div>
                        <div>User</div>
                        <div style={{ textAlign: 'right' }}>Change</div>
                        <div style={{ textAlign: 'right' }}>{currentMetric.label}</div>
                    </div>

                    {rest.map((user) => (
                        <div
                            key={user.username}
                            style={{ display: 'grid', gridTemplateColumns: '56px 1fr 100px 130px', alignItems: 'center', padding: '14px 24px', borderBottom: '1px solid var(--stroke)', background: user.isCurrentUser ? 'rgba(82, 109, 245, 0.05)' : 'transparent', transition: 'background 0.15s', cursor: 'default' }}
                            onMouseOver={e => !user.isCurrentUser && (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                            onMouseOut={e => !user.isCurrentUser && (e.currentTarget.style.background = 'transparent')}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                                #{user.displayRank}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: user.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: 'white', flexShrink: 0, border: user.isCurrentUser ? '2px solid var(--accent-primary)' : '2px solid transparent' }}>
                                    {user.avatar}
                                </div>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontWeight: 600, fontSize: '15px' }}>{user.displayName}</span>
                                        {user.isCurrentUser && <span style={{ fontSize: '11px', background: 'var(--accent-primary)', color: '#000', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>You</span>}
                                    </div>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>@{user.username}</span>
                                </div>
                            </div>

                            <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                {user.change === 'up' && <><TrendingUp size={14} color="var(--success)" /><span style={{ fontSize: '12px', color: 'var(--success)' }}>↑</span></>}
                                {user.change === 'down' && <><TrendingDown size={14} color="var(--error)" /><span style={{ fontSize: '12px', color: 'var(--error)' }}>↓</span></>}
                                {user.change === 'same' && <Minus size={14} color="var(--text-muted)" />}
                                {user.change === 'new' && <span style={{ fontSize: '11px', background: '#10b981', color: 'white', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>NEW</span>}
                            </div>

                            <div style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                {currentMetric.icon}
                                {formatScore(user.scores[metric][timeframe])}
                            </div>
                        </div>
                    ))}

                    {/* Pagination */}
                    <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Showing {sorted.length} members</span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => { if (currentPage > 1) setCurrentPage(currentPage - 1); }} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', padding: '6px 14px', borderRadius: '6px', color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontSize: '13px', opacity: currentPage === 1 ? 0.5 : 1 }}>← Prev</button>
                            {[1, 2, 3].map(n => (
                                <button key={n} onClick={() => setCurrentPage(n)} style={{ background: n === currentPage ? 'var(--accent-primary)' : 'var(--bg-tertiary)', border: '1px solid var(--stroke)', padding: '6px 12px', borderRadius: '6px', color: n === currentPage ? '#000' : 'var(--text-primary)', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>{n}</button>
                            ))}
                            <button onClick={() => { if (currentPage < 3) setCurrentPage(currentPage + 1); }} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', padding: '6px 14px', borderRadius: '6px', color: currentPage === 3 ? 'var(--text-muted)' : 'var(--text-primary)', cursor: currentPage === 3 ? 'not-allowed' : 'pointer', fontSize: '13px', opacity: currentPage === 3 ? 0.5 : 1 }}>Next →</button>
                        </div>
                    </div>
                </div>

                {/* Your ranking callout */}
                <div style={{ marginTop: '24px', padding: '20px 24px', background: 'var(--bg-elevated)', borderRadius: '12px', border: '1px solid var(--accent-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--accent-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 700, color: 'white', border: '2px solid var(--accent-primary)' }}>G</div>
                        <div>
                            <div style={{ fontWeight: 600, marginBottom: '2px' }}>Your Ranking</div>
                            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>#{sorted.find(u => u.isCurrentUser)?.displayRank ?? '—'} out of {sorted.length} members</div>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 800, fontSize: '22px', color: 'var(--accent-primary)', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                            {currentMetric.icon}
                            {formatScore(sorted.find(u => u.isCurrentUser)?.scores[metric][timeframe] ?? 0)}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{currentMetric.unit} this {timeframe === 'alltime' ? 'all time' : timeframe === 'weekly' ? 'week' : 'month'}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Leaderboard;
