import { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { api } from '../../../lib/api';
import type { Guild } from '../../../lib/api';

type Range = 7 | 30 | 90;

type InsightsData = {
    memberCount: number;
    memberGrowth7d: number;
    messages7d: number;
    topChannels: Array<{ channelId: string; name: string; messages: number }>;
    hourlyMessages: number[];
    dailyMessages: number[];
    dailyJoins: number[];
    activeUsers24h: number;
    dateLabels: string[];
};

const RANGE_OPTIONS: Range[] = [7, 30, 90];

const statCard = (accentColor: string): React.CSSProperties => ({
    background: 'var(--bg-tertiary)',
    padding: 16,
    borderRadius: 8,
    border: '1px solid var(--stroke)',
    position: 'relative',
    overflow: 'hidden',
    borderTop: `3px solid ${accentColor}`,
});

function MiniBarChart({ values, labels, color }: { values: number[]; labels: string[]; color: string }) {
    const max = Math.max(...values, 1);
    const visible = values.slice(-14); // show last 14 bars max
    const visibleLabels = labels.slice(-14);
    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 40, marginTop: 8 }}>
            {visible.map((v, i) => (
                <div
                    key={i}
                    title={`${visibleLabels[i]}: ${v}`}
                    style={{
                        flex: 1,
                        height: `${Math.max(4, (v / max) * 100)}%`,
                        background: color,
                        opacity: 0.7,
                        borderRadius: 2,
                        minWidth: 0,
                    }}
                />
            ))}
        </div>
    );
}

function GuildInsightsPanel({ guildId, guild }: { guildId: string; guild?: Guild }) {
    const [range, setRange] = useState<Range>(7);
    const [data, setData] = useState<InsightsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);

        // Use async/await inside the effect so that synchronous throws from
        // assertGuildId (invalid guildId) are captured by the try/catch and
        // always reset the loading state via finally.
        const run = async () => {
            try {
                const d = await api.guilds.getInsights(guildId, range);
                if (!cancelled) setData(d);
            } catch (err) {
                if (!cancelled) {
                    setData(null);
                    setError(err instanceof Error ? err.message : 'Unable to load server insights.');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        run();
        return () => { cancelled = true; };
    }, [guildId, range, reloadKey]);

    const rangeSelector = (
        <div style={{ display: 'flex', gap: 4 }}>
            {RANGE_OPTIONS.map(r => (
                <button
                    key={r}
                    onClick={() => setRange(r)}
                    style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        border: '1px solid var(--stroke)',
                        background: range === r ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                        color: range === r ? '#fff' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 600,
                    }}
                >
                    {r}d
                </button>
            ))}
        </div>
    );

    if (loading) {
        return (
            <div style={{ padding: '32px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Server Insights</h2>
                    {rangeSelector}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: 'var(--text-muted)', padding: '32px 0' }}>
                <RefreshCw size={18} style={{ animation: 'spin 0.9s linear infinite', opacity: 0.7 }} />
                <span style={{ fontSize: '14px' }}>Loading insights…</span>
            </div>
            </div>
        );
    }

    if (error) {
        // On failure, fall back to basic guild stats from the guild prop if available.
        const hasGuildFallback = guild && (guild.memberCount !== undefined || guild.createdAt);
        return (
            <div style={{ padding: '32px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Server Insights</h2>
                    {rangeSelector}
                </div>
                <div style={{ textAlign: 'center', marginBottom: hasGuildFallback ? 28 : 0 }}>
                    <div style={{ color: 'var(--text-secondary)', marginBottom: 12, fontSize: 14 }}>{error}</div>
                    <button
                        onClick={() => setReloadKey(v => v + 1)}
                        style={{
                            padding: '8px 14px',
                            borderRadius: 8,
                            border: '1px solid var(--stroke)',
                            background: 'var(--bg-elevated)',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: 13,
                        }}
                    >
                        Retry
                    </button>
                </div>
                {hasGuildFallback && (
                    <>
                        <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>Basic Server Info</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            {guild!.memberCount !== undefined && (
                                <div style={statCard('#6366f1')}>
                                    <div style={{ fontSize: 28, fontWeight: 700 }}>{guild!.memberCount.toLocaleString()}</div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Total Members</div>
                                </div>
                            )}
                            {guild!.createdAt && (
                                <div style={statCard('#f59e0b')}>
                                    <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>
                                        {new Date(guild!.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                    </div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Server Created</div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        );
    }

    if (!data) {
        return (
            <div style={{ padding: '48px 0', textAlign: 'center' }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: 6 }}>No insights data available yet.</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Data will appear once your server has activity.</div>
            </div>
        );
    }

    const totalJoins = data.dailyJoins.reduce((a, b) => a + b, 0);
    const topMax = data.topChannels.length > 0 ? data.topChannels[0].messages : 1;
    const CHANNEL_COLORS = ['#6366f1', '#f59e0b', '#22c55e', '#ec4899', '#10b981'];

    return (
        <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <h2 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Server Insights</h2>
                {rangeSelector}
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px' }}>
                Analytics overview · past {range} days
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                <div style={statCard('#6366f1')}>
                    <div style={{ fontSize: 32, fontWeight: 700 }}>{data.memberCount.toLocaleString()}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Total Members</div>
                    {data.memberGrowth7d !== 0 && (
                        <div style={{ color: data.memberGrowth7d > 0 ? '#43b581' : '#f04747', fontSize: 12, marginTop: 4, fontWeight: 600 }}>
                            {data.memberGrowth7d > 0 ? '↑' : '↓'} {data.memberGrowth7d > 0 ? '+' : ''}{data.memberGrowth7d} this week
                        </div>
                    )}
                </div>

                <div style={statCard('#f59e0b')}>
                    <div style={{ fontSize: 32, fontWeight: 700 }}>{data.messages7d.toLocaleString()}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Messages (7d)</div>
                    {data.dailyMessages.length > 0 && (
                        <MiniBarChart values={data.dailyMessages} labels={data.dateLabels} color="#f59e0b" />
                    )}
                </div>

                {data.activeUsers24h > 0 && (
                    <div style={statCard('#22c55e')}>
                        <div style={{ fontSize: 32, fontWeight: 700 }}>{data.activeUsers24h.toLocaleString()}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Active Users (24h)</div>
                    </div>
                )}

                {totalJoins > 0 && (
                    <div style={statCard('#ec4899')}>
                        <div style={{ fontSize: 32, fontWeight: 700 }}>+{totalJoins.toLocaleString()}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>New Joins ({range}d)</div>
                        {data.dailyJoins.length > 0 && (
                            <MiniBarChart values={data.dailyJoins} labels={data.dateLabels} color="#ec4899" />
                        )}
                    </div>
                )}
            </div>

            {data.topChannels.length > 0 && (
                <>
                    <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: 12 }}>Top Channels</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {data.topChannels.map((ch, i) => {
                            const pct = topMax > 0 ? (ch.messages / topMax) * 100 : 0;
                            const barColor = CHANNEL_COLORS[i % CHANNEL_COLORS.length];
                            return (
                                <div key={ch.channelId} style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-tertiary)', padding: '10px 16px', borderRadius: 6, border: '1px solid var(--stroke)', overflow: 'hidden' }}>
                                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: barColor, opacity: 0.1, borderRadius: 6 }} />
                                    <span style={{ position: 'relative', zIndex: 1 }}>
                                        <span style={{ color: 'var(--text-muted)', marginRight: 6, fontSize: 12 }}>#{i + 1}</span>
                                        #{ch.name}
                                    </span>
                                    <span style={{ color: 'var(--text-muted)', position: 'relative', zIndex: 1, fontWeight: 600, fontSize: 13 }}>{ch.messages.toLocaleString()}</span>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </>
    );
}

export default GuildInsightsPanel;
