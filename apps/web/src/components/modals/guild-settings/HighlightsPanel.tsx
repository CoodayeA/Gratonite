import { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import LoadingRow from '../../ui/LoadingRow';

function HighlightsPanel({ guildId, addToast }: { guildId: string; addToast: (t: any) => void }) {
    const [highlights, setHighlights] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        api.guildHighlights.list(guildId).then(setHighlights).catch(() => {}).finally(() => setLoading(false));
    }, [guildId]);

    const generate = async () => {
        setGenerating(true);
        try {
            const h = await api.guildHighlights.generate(guildId);
            setHighlights(prev => [h, ...prev.filter(x => x.weekStart !== h.weekStart)]);
            addToast({ title: 'Highlights generated', variant: 'success' });
        } catch { addToast({ title: 'Failed to generate', variant: 'error' }); }
        finally { setGenerating(false); }
    };

    return (
        <>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Community Highlights</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px' }}>Weekly digest of top activity in your server.</p>

            <button onClick={generate} disabled={generating} style={{ padding: '10px 24px', borderRadius: '8px', background: 'var(--accent-primary)', border: 'none', color: '#000', fontWeight: 600, cursor: 'pointer', fontSize: '13px', marginBottom: '24px' }}>
                {generating ? 'Generating...' : 'Generate This Week'}
            </button>

            {loading ? (
                <div style={{ padding: '48px 16px' }}><LoadingRow inline /></div>
            ) : highlights.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>No highlights yet. Generate one above.</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {highlights.map(h => (
                        <div key={h.id || h.weekStart} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <h3 style={{ fontWeight: 600, fontSize: '15px' }}>Week of {h.weekStart}</h3>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{h.messageCount} messages</span>
                            </div>
                            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                <div style={{ flex: 1, minWidth: '200px' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>Most Active Members</div>
                                    {(h.activeMembers || []).map((m: any, i: number) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '13px' }}>
                                            <span style={{ color: 'var(--text-primary)' }}>{m.displayName || m.username}</span>
                                            <span style={{ color: 'var(--text-muted)' }}>{m.messageCount} msgs</span>
                                        </div>
                                    ))}
                                    {(h.activeMembers || []).length === 0 && <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No data</p>}
                                </div>
                                <div style={{ background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '16px', minWidth: '120px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--accent-primary)' }}>{h.memberCount}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Members</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}

export default HighlightsPanel;
