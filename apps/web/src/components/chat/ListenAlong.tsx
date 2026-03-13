import { useState } from 'react';
import { Music, X } from 'lucide-react';
import { getSocket } from '../../lib/socket';

interface ListenAlongProps {
    targetUserId: string;
    targetUsername: string;
    trackName?: string;
    artist?: string;
    onClose: () => void;
}

export default function ListenAlong({ targetUserId, targetUsername, trackName, artist, onClose }: ListenAlongProps) {
    const [syncing, setSyncing] = useState(false);

    const handleStart = () => {
        setSyncing(true);
        const socket = getSocket();
        if (socket) {
            socket.emit('listen_along_start', { targetUserId });
        }
        setTimeout(() => setSyncing(false), 1500);
    };

    return (
        <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--stroke)',
            borderRadius: 'var(--radius-md)',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Music size={16} style={{ color: 'var(--accent-primary)' }} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Listen Along</span>
                </div>
                <X size={14} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={onClose} />
            </div>

            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                <strong>{targetUsername}</strong> is listening to:
            </div>
            {trackName && (
                <div style={{
                    background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', padding: '8px',
                    display: 'flex', flexDirection: 'column', gap: '2px',
                }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{trackName}</span>
                    {artist && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{artist}</span>}
                </div>
            )}

            <button
                onClick={handleStart}
                disabled={syncing}
                style={{
                    padding: '6px 12px', borderRadius: 'var(--radius-sm)',
                    background: syncing ? 'var(--bg-tertiary)' : 'var(--accent-primary)',
                    color: syncing ? 'var(--text-muted)' : '#000',
                    border: 'none', cursor: syncing ? 'default' : 'pointer',
                    fontSize: '12px', fontWeight: 600, transition: 'all 0.2s',
                }}
            >
                {syncing ? 'Syncing...' : 'Start Listening Along'}
            </button>
        </div>
    );
}
