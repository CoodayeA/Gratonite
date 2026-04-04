import { useState, useEffect, useRef } from 'react';
import { Play, Upload, Trash2, Loader2, Music } from 'lucide-react';
import { api } from '../../lib/api';

interface SoundClip {
    id: string;
    guildId: string;
    name: string;
    soundHash: string;
    volume: number;
    emojiName?: string | null;
    uploaderId: string;
    available: boolean;
}

interface Props {
    guildId: string;
    currentUserId?: string;
    isAdmin?: boolean;
    onClose?: () => void;
}

export default function GuildSoundboardPanel({ guildId, currentUserId, isAdmin }: Props) {
    const [sounds, setSounds] = useState<SoundClip[]>([]);
    const [loading, setLoading] = useState(true);
    const [playingId, setPlayingId] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [showUploadForm, setShowUploadForm] = useState(false);
    const [uploadName, setUploadName] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!guildId) return;
        setLoading(true);
        api.voice.getSoundboard(guildId)
            .then(data => setSounds(data as SoundClip[]))
            .catch(() => setSounds([]))
            .finally(() => setLoading(false));
    }, [guildId]);

    const handlePlay = async (sound: SoundClip) => {
        if (playingId) return;
        setPlayingId(sound.id);
        try {
            await api.voice.playSoundboard(guildId, sound.id);
        } catch { /* ignore */ }
        setTimeout(() => setPlayingId(null), 1500);
    };

    const handleDelete = async (soundId: string) => {
        try {
            await api.voice.deleteSoundboard(guildId, soundId);
            setSounds(prev => prev.filter(s => s.id !== soundId));
        } catch { /* ignore */ }
    };

    const handleFileUpload = async (file: File) => {
        if (!uploadName.trim()) return;
        if (file.size > 256 * 1024) { alert('File must be under 256KB'); return; }
        const allowedTypes = ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm'];
        if (!allowedTypes.includes(file.type)) { alert('Must be an audio file (MP3, OGG, WAV)'); return; }
        setUploading(true);
        try {
            const soundHash = `${file.name}-${file.size}-${Date.now()}`;
            const newSound = await api.voice.createSoundboard(guildId, { name: uploadName.trim(), soundHash });
            setSounds(prev => [...prev, newSound as SoundClip]);
            setShowUploadForm(false);
            setUploadName('');
        } catch { /* ignore */ } finally {
            setUploading(false);
        }
    };

    return (
        <div style={{
            position: 'absolute', bottom: '100%', right: 0, marginBottom: '8px',
            width: '340px', maxHeight: '440px',
            background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
            borderRadius: 'var(--radius-lg)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 40,
        }}>
            {/* Header */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-tertiary)', flexShrink: 0 }}>
                <Music size={16} style={{ color: 'var(--accent-primary)' }} />
                <span style={{ fontWeight: 700, fontSize: '14px', flex: 1 }}>Soundboard</span>
                {isAdmin && (
                    <button
                        onClick={() => setShowUploadForm(!showUploadForm)}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--accent-primary)', border: 'none', color: '#000', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}
                    >
                        <Upload size={12} /> Upload
                    </button>
                )}
            </div>

            {/* Upload Form */}
            {showUploadForm && (
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--stroke)', background: 'rgba(82,109,245,0.05)', flexShrink: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>Upload Sound (max 256KB, 5 sec)</div>
                    <input
                        value={uploadName}
                        onChange={e => setUploadName(e.target.value)}
                        placeholder="Sound name..."
                        style={{ width: '100%', padding: '6px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', color: 'var(--text-primary)', fontSize: '13px', marginBottom: '8px', boxSizing: 'border-box' }}
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={!uploadName.trim() || uploading}
                            style={{ flex: 1, padding: '7px', background: 'var(--accent-primary)', border: 'none', borderRadius: 'var(--radius-sm)', color: '#000', cursor: uploadName.trim() ? 'pointer' : 'not-allowed', fontSize: '12px', fontWeight: 600, opacity: uploadName.trim() ? 1 : 0.5 }}
                        >
                            {uploading ? 'Uploading...' : 'Choose File'}
                        </button>
                        <button
                            onClick={() => { setShowUploadForm(false); setUploadName(''); }}
                            style={{ padding: '7px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px' }}
                        >
                            Cancel
                        </button>
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="audio/*"
                        style={{ display: 'none' }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = ''; }}
                    />
                </div>
            )}

            {/* Sound Grid */}
            <div style={{ padding: '12px', overflowY: 'auto', flex: 1 }}>
                {loading ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '32px', color: 'var(--text-muted)' }}>
                        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                        <span style={{ fontSize: '13px' }}>Loading sounds...</span>
                    </div>
                ) : sounds.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                        <Music size={32} style={{ marginBottom: '8px', opacity: 0.4 }} />
                        <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>No sounds yet</div>
                        {isAdmin && <div style={{ fontSize: '11px' }}>Upload a sound to get started</div>}
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                        {sounds.filter(s => s.available).map(sound => (
                            <div key={sound.id} style={{ position: 'relative' }}>
                                <button
                                    onClick={() => handlePlay(sound)}
                                    disabled={!!playingId}
                                    title={sound.name}
                                    style={{
                                        width: '100%',
                                        background: playingId === sound.id ? 'rgba(82,109,245,0.2)' : 'var(--bg-tertiary)',
                                        border: playingId === sound.id ? '1px solid var(--accent-primary)' : '1px solid var(--stroke)',
                                        borderRadius: 'var(--radius-md)', padding: '10px 6px',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                                        cursor: playingId ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
                                    }}
                                >
                                    <span style={{ fontSize: '22px', lineHeight: 1 }}>{sound.emojiName || '🎵'}</span>
                                    <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>
                                        {sound.name}
                                    </span>
                                    {playingId === sound.id && (
                                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(82,109,245,0.15)', borderRadius: 'var(--radius-md)' }}>
                                            <Play size={18} style={{ color: 'var(--accent-primary)', fill: 'currentColor' }} />
                                        </div>
                                    )}
                                </button>
                                {(isAdmin || sound.uploaderId === currentUserId) && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDelete(sound.id); }}
                                        title="Delete sound"
                                        className="soundboard-delete-btn"
                                        style={{ position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: '50%', background: 'var(--error)', border: 'none', color: '#fff', cursor: 'pointer', display: 'none', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}
                                    >
                                        <Trash2 size={10} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <style>{`
                div:hover .soundboard-delete-btn { display: flex !important; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
