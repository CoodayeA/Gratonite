import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { api } from '../../../lib/api';

function GuildStickersPanel({ guildId, addToast }: { guildId: string; addToast: (t: any) => void }) {
    const [stickers, setStickers] = useState<Array<{ id: string; name: string; assetUrl: string; description: string | null; tags: string[] }>>([]);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState('');
    const [newUrl, setNewUrl] = useState('');
    const [newDesc, setNewDesc] = useState('');

    useEffect(() => {
        api.stickers.getGuildStickers(guildId).then(data => setStickers(Array.isArray(data) ? data : [])).catch(() => { addToast({ title: 'Failed to load stickers', variant: 'error' }); }).finally(() => setLoading(false));
    }, [guildId]);

    const handleCreate = async () => {
        if (!newName.trim() || !newUrl.trim()) {
            addToast({ title: 'Name and URL are required', variant: 'error' });
            return;
        }
        try {
            const sticker = await api.post(`/guilds/${guildId}/stickers`, { name: newName.trim(), assetUrl: newUrl.trim(), description: newDesc.trim() || null, tags: [] });
            setStickers(prev => [...prev, sticker as any]);
            setNewName('');
            setNewUrl('');
            setNewDesc('');
            addToast({ title: 'Sticker created', variant: 'success' });
        } catch {
            addToast({ title: 'Failed to create sticker', variant: 'error' });
        }
    };

    const handleDelete = async (stickerId: string) => {
        try {
            await api.delete(`/guilds/${guildId}/stickers/${stickerId}`);
            setStickers(prev => prev.filter(s => s.id !== stickerId));
            addToast({ title: 'Sticker deleted', variant: 'success' });
        } catch {
            addToast({ title: 'Failed to delete sticker', variant: 'error' });
        }
    };

    return (
        <>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Stickers</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px' }}>
                Manage custom stickers for your server. Members can use them in the sticker picker.
            </p>

            <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '10px', padding: '20px', marginBottom: '24px' }}>
                <div style={{ fontSize: '12px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '12px' }}>ADD STICKER</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                    <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Sticker name" style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                    <input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="Image URL (PNG, GIF, WebP)" style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                    <input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description (optional)" style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '14px', outline: 'none' }} />
                </div>
                <button onClick={handleCreate} style={{ padding: '8px 18px', borderRadius: '8px', background: 'var(--accent-primary)', border: 'none', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                    Add Sticker
                </button>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>Loading stickers...</div>
            ) : stickers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    <p style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 4px' }}>No stickers yet</p>
                    <p style={{ fontSize: '13px', margin: 0 }}>Add stickers above for your server members to use.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
                    {stickers.map(sticker => (
                        <div key={sticker.id} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '10px', padding: '12px', textAlign: 'center', position: 'relative' }}>
                            <img src={sticker.assetUrl} alt={sticker.name} style={{ width: '80px', height: '80px', objectFit: 'contain', borderRadius: '8px', marginBottom: '8px' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{sticker.name}</div>
                            {sticker.description && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{sticker.description}</div>}
                            <button onClick={() => handleDelete(sticker.id)} style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(239, 68, 68, 0.15)', border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ef4444' }}>
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}

export default GuildStickersPanel;
