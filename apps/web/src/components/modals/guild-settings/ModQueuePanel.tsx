import { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import LoadingRow from '../../ui/LoadingRow';

function ModQueuePanel({ guildId, addToast }: { guildId: string; addToast: (t: any) => void }) {
    const [items, setItems] = useState<any[]>([]);
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [statusFilter, setStatusFilter] = useState('pending');
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            const data = await api.modQueue.list(guildId, statusFilter);
            setItems(data.items || []);
            setCounts(data.counts || {});
        } catch { addToast({ title: 'Failed to load mod queue', variant: 'error' }); } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, [guildId, statusFilter]);

    const resolve = async (itemId: string, status: 'approved' | 'rejected') => {
        try {
            await api.modQueue.resolve(guildId, itemId, status);
            setItems(prev => prev.filter(i => i.id !== itemId));
            addToast({ title: `Item ${status}`, variant: 'success' });
        } catch { addToast({ title: 'Failed to resolve', variant: 'error' }); }
    };

    return (
        <>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Moderation Queue</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px' }}>
                Review flagged content and take action. {counts.pending || 0} pending items.
            </p>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                {['pending', 'approved', 'rejected'].map(s => (
                    <button key={s} onClick={() => setStatusFilter(s)} style={{
                        padding: '6px 14px', borderRadius: '20px', border: 'none', fontSize: '12px', fontWeight: 600,
                        background: statusFilter === s ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                        color: statusFilter === s ? '#000' : 'var(--text-secondary)', cursor: 'pointer', textTransform: 'capitalize',
                    }}>{s} ({counts[s] || 0})</button>
                ))}
            </div>

            {loading ? (
                <div style={{ padding: '48px 16px' }}><LoadingRow inline /></div>
            ) : items.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>No items in this queue.</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {items.map(item => (
                        <div key={item.id} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '10px', padding: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px' }}>{item.type}</span>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{new Date(item.createdAt).toLocaleString()}</span>
                            </div>
                            <p style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '12px', wordBreak: 'break-word' }}>{item.content || 'No details'}</p>
                            {item.reporterUsername && <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>Reported by: {item.reporterUsername}</p>}
                            {statusFilter === 'pending' && (
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button onClick={() => resolve(item.id, 'approved')} style={{ padding: '6px 16px', borderRadius: '6px', background: '#10b981', border: 'none', color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Approve</button>
                                    <button onClick={() => resolve(item.id, 'rejected')} style={{ padding: '6px 16px', borderRadius: '6px', background: '#ef4444', border: 'none', color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Reject</button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}

export default ModQueuePanel;
