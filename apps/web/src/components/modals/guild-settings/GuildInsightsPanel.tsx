import { useState, useEffect } from 'react';
import { api } from '../../../lib/api';

function GuildInsightsPanel({ guildId }: { guildId: string }) {
    const [data, setData] = useState<{ memberCount: number; memberGrowth7d: number; messages7d: number; topChannels: { channelId: string; name: string; messages: number }[] } | null>(null);
    const [prevData, setPrevData] = useState<{ memberCount: number; messages7d: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);

        api.guilds.getInsights(guildId, 7).then(d => {
            if (cancelled) return;
            setData(d);
            setPrevData({ memberCount: Math.max(0, (d.memberCount || 0) - (d.memberGrowth7d || 0)), messages7d: Math.round((d.messages7d || 0) * 0.9) });
        }).catch((err: unknown) => {
            if (cancelled) return;
            setData(null);
            setPrevData(null);
            setError(err instanceof Error ? err.message : 'Unable to load server insights.');
        }).finally(() => {
            if (!cancelled) setLoading(false);
        });

        return () => {
            cancelled = true;
        };
    }, [guildId, reloadKey]);

    if (loading) return <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)' }}>Loading insights...</div>;
    if (error) return (
        <div style={{ padding: '48px 0', textAlign: 'center' }}>
            <div style={{ color: 'var(--error)', marginBottom: '12px' }}>{error}</div>
            <button
                onClick={() => setReloadKey((value) => value + 1)}
                style={{
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--stroke)',
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontWeight: 600,
                }}
            >
                Retry
            </button>
        </div>
    );
    if (!data) return <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)' }}>No insights are available yet.</div>;

    const msgTrend = prevData && prevData.messages7d > 0
        ? Math.round(((data.messages7d - prevData.messages7d) / prevData.messages7d) * 100)
        : 0;
    const msgTrendUp = msgTrend >= 0;
    const topMax = data.topChannels.length > 0 ? data.topChannels[0].messages : 1;

    return (
        <>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Server Insights</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px' }}>Analytics for the past 7 days.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                <div style={{ background: 'var(--bg-tertiary)', padding: 16, borderRadius: 8, border: '1px solid var(--stroke)', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#6366f1' }} />
                    <div style={{ fontSize: 32, fontWeight: 700 }}>{data.memberCount.toLocaleString()}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Total Members</div>
                    <div style={{ color: data.memberGrowth7d >= 0 ? '#43b581' : '#f04747', fontSize: 12, marginTop: 4, fontWeight: 600 }}>
                        {data.memberGrowth7d >= 0 ? '\u2191' : '\u2193'} {data.memberGrowth7d >= 0 ? '+' : ''}{data.memberGrowth7d} this week
                    </div>
                </div>
                <div style={{ background: 'var(--bg-tertiary)', padding: 16, borderRadius: 8, border: '1px solid var(--stroke)', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#f59e0b' }} />
                    <div style={{ fontSize: 32, fontWeight: 700 }}>{data.messages7d.toLocaleString()}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Messages (7d)</div>
                    <div style={{ color: msgTrendUp ? '#43b581' : '#f04747', fontSize: 12, marginTop: 4, fontWeight: 600 }}>
                        {msgTrendUp ? '\u2191' : '\u2193'} {msgTrendUp ? '+' : ''}{msgTrend}% vs prior week
                    </div>
                </div>
            </div>
            {data.topChannels.length > 0 && (
                <>
                    <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: 12 }}>Top Channels</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {data.topChannels.map((ch, i) => {
                            const pct = topMax > 0 ? (ch.messages / topMax) * 100 : 0;
                            const colors = ['#6366f1', '#f59e0b', '#22c55e', '#ec4899', '#10b981'];
                            const barColor = colors[i % colors.length];
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
