import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { API_BASE } from '../../lib/api';
import Avatar from '../ui/Avatar';

interface ReactorUser {
    id: string;
    username: string;
    displayName?: string;
    avatarHash?: string | null;
}

interface Props {
    emoji: string;
    emojiUrl?: string;
    isCustom?: boolean;
    count: number;
    messageApiId: string;
    channelId: string;
}

export function ReactionSummaryPopover({ emoji, emojiUrl, isCustom, count, messageApiId, channelId }: Props) {
    const [users, setUsers] = useState<ReactorUser[]>([]);
    const [showAll, setShowAll] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [visible, setVisible] = useState(false);

    const fetchReactors = () => {
        if (loaded) {
            setVisible(true);
            return;
        }
        timerRef.current = setTimeout(() => {
            fetch(`${API_BASE}/channels/${channelId}/messages/${messageApiId}/reactions/${encodeURIComponent(emoji)}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('gratonite_access_token')}` },
            })
                .then(r => r.ok ? r.json() : [])
                .then(data => {
                    if (Array.isArray(data)) {
                        setUsers(data.map((u: any) => ({
                            id: u.id || u.userId,
                            username: u.username,
                            displayName: u.displayName,
                            avatarHash: u.avatarHash,
                        })));
                        setLoaded(true);
                        setVisible(true);
                    }
                })
                .catch(() => {});
        }, 300);
    };

    const handleMouseLeave = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setVisible(false);
    };

    useEffect(() => {
        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, []);

    const displayUsers = users.slice(0, 5);
    const remaining = count - displayUsers.length;

    return (
        <div
            onMouseEnter={fetchReactors}
            onMouseLeave={handleMouseLeave}
            style={{ position: 'relative', display: 'inline-flex' }}
        >
            {/* Tooltip popover */}
            {visible && users.length > 0 && (
                <div style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 8px)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--stroke)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                    zIndex: 50,
                    minWidth: '140px',
                    maxWidth: '220px',
                    pointerEvents: 'auto',
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {displayUsers.map(u => (
                            <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Avatar
                                    userId={u.id}
                                    displayName={u.displayName || u.username}
                                    avatarHash={u.avatarHash}
                                    size={20}
                                />
                                <span style={{ fontSize: '12px', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {u.displayName || u.username}
                                </span>
                            </div>
                        ))}
                    </div>
                    {remaining > 0 && (
                        <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                            and {remaining} more...
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowAll(true); }}
                                style={{
                                    background: 'none', border: 'none', color: 'var(--accent-primary)',
                                    cursor: 'pointer', fontSize: '11px', padding: '0 4px', fontWeight: 600,
                                }}
                            >
                                View all
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Full modal */}
            {showAll && (
                <div
                    style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 9000,
                    }}
                    onClick={() => setShowAll(false)}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
                            borderRadius: '12px', padding: '16px', width: 'min(320px, 90vw)',
                            maxHeight: '400px', display: 'flex', flexDirection: 'column',
                            boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {isCustom && emojiUrl ? (
                                    <img src={emojiUrl} width={20} height={20} alt={emoji} />
                                ) : (
                                    <span style={{ fontSize: '18px' }}>{emoji}</span>
                                )}
                                <span>{count} reactions</span>
                            </div>
                            <button onClick={() => setShowAll(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                <X size={16} />
                            </button>
                        </div>
                        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {users.map(u => (
                                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 0' }}>
                                    <Avatar
                                        userId={u.id}
                                        displayName={u.displayName || u.username}
                                        avatarHash={u.avatarHash}
                                        size={28}
                                    />
                                    <div>
                                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                            {u.displayName || u.username}
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                            @{u.username}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
