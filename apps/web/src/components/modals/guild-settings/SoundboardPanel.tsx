import { useState, useEffect, useRef } from 'react';
import { api } from '../../../lib/api';

function SoundboardPanel({ guildId, addToast }: { guildId: string; addToast: (t: any) => void }) {
    const [clips, setClips] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState('');
    const [newEmoji, setNewEmoji] = useState('');
    const [soundFile, setSoundFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const soundFileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        api.soundboard.list(guildId).then(setClips).catch(() => {}).finally(() => setLoading(false));
    }, [guildId]);

    return (
        <>
            <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Custom Soundboard</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '13px' }}>Upload sound clips for voice channels. Max 50 clips per server.</p>

            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
                <div style={{ fontSize: '12px', textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '12px' }}>Upload Sound Clip</div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Sound name" style={{ flex: 1, minWidth: '120px', padding: '8px 12px', borderRadius: '6px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '13px' }} />
                    <input type="text" value={newEmoji} onChange={e => setNewEmoji(e.target.value.slice(0, 4))} placeholder="Emoji" style={{ width: '60px', padding: '8px 12px', borderRadius: '6px', background: 'var(--bg-primary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '16px', textAlign: 'center' }} />
                    <button
                        onClick={() => soundFileRef.current?.click()}
                        style={{ padding: '8px 16px', borderRadius: '6px', background: soundFile ? 'rgba(82,109,245,0.15)' : 'var(--bg-primary)', border: `1px solid ${soundFile ? 'var(--accent-primary)' : 'var(--stroke)'}`, color: soundFile ? 'var(--accent-primary)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', whiteSpace: 'nowrap' }}
                    >
                        {soundFile ? soundFile.name.slice(0, 20) + (soundFile.name.length > 20 ? '…' : '') : '📎 Choose audio'}
                    </button>
                    <input
                        ref={soundFileRef}
                        type="file"
                        accept="audio/mpeg,audio/wav,audio/ogg,audio/flac,audio/aac,audio/mp4,.mp3,.wav,.ogg,.flac,.aac,.m4a"
                        hidden
                        onChange={e => { setSoundFile(e.target.files?.[0] ?? null); e.target.value = ''; }}
                    />
                    <button onClick={async () => {
                        if (!newName.trim() || !soundFile) return;
                        setUploading(true);
                        try {
                            const uploaded = await api.files.upload(soundFile, 'soundboard');
                            const clip = await api.soundboard.upload(guildId, { name: newName.trim(), fileHash: uploaded.id, emoji: newEmoji || undefined });
                            setClips(prev => [...prev, clip]);
                            setNewName(''); setNewEmoji(''); setSoundFile(null);
                            addToast({ title: 'Sound clip added', variant: 'success' });
                        } catch (err: any) {
                            addToast({ title: 'Failed to add clip', description: err?.message || 'Upload failed', variant: 'error' });
                        } finally { setUploading(false); }
                    }} disabled={uploading || !newName.trim() || !soundFile} style={{ padding: '8px 20px', borderRadius: '6px', background: (!uploading && newName.trim() && soundFile) ? 'var(--accent-primary)' : 'var(--bg-tertiary)', border: 'none', color: (!uploading && newName.trim() && soundFile) ? '#000' : 'var(--text-muted)', fontWeight: 600, cursor: (!uploading && newName.trim() && soundFile) ? 'pointer' : 'not-allowed', fontSize: '13px' }}>{uploading ? 'Uploading…' : 'Add'}</button>
                </div>
                {!soundFile && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>Supported: MP3, WAV, OGG, FLAC, AAC (max 25 MB)</div>}
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>Loading...</div>
            ) : clips.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>No sound clips yet. Upload one above.</div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' }}>
                    {clips.map(clip => (
                        <div key={clip.id} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '10px', padding: '16px', textAlign: 'center', cursor: 'pointer' }}
                            onClick={async () => { try { await api.soundboard.play(guildId, clip.id); } catch { addToast({ title: 'Failed to play sound', variant: 'error' }); } }}>
                            <div style={{ fontSize: '28px', marginBottom: '8px' }}>{clip.emoji || '\uD83D\uDD0A'}</div>
                            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>{clip.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{clip.uses} plays</div>
                            <button onClick={async (e) => {
                                e.stopPropagation();
                                try { await api.soundboard.delete(guildId, clip.id); setClips(prev => prev.filter(c => c.id !== clip.id)); addToast({ title: 'Deleted', variant: 'info' }); } catch { addToast({ title: 'Failed to delete sound clip', variant: 'error' }); }
                            }} style={{ marginTop: '8px', background: 'none', border: '1px solid var(--stroke)', borderRadius: '4px', padding: '2px 8px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px' }}>Delete</button>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}

export default SoundboardPanel;
