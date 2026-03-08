import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Search, MessageSquare } from 'lucide-react';
import { api } from '../../lib/api';
import Avatar from '../ui/Avatar';
import { useToast } from '../ui/ToastManager';
import { buildDmRoute } from '../../lib/routes';

type Friend = {
    id: string;
    name: string;
    handle: string;
    status: string;
};

const DMSearchModal = ({ onClose }: { onClose: () => void }) => {
    const [query, setQuery] = useState('');
    const [hoveredUserId, setHoveredUserId] = useState<string | null>(null);
    const [friends, setFriends] = useState<Friend[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const inputRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();
    const { addToast } = useToast();

    useEffect(() => {
        setTimeout(() => inputRef.current?.focus(), 50);
    }, []);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose]);

    // Fetch friends list from API
    useEffect(() => {
        setIsLoading(true);
        api.relationships.getAll()
            .then(rels => {
                const accepted = rels.filter((r: any) => r.type === 1 || r.status === 'accepted');
                const mapped: Friend[] = accepted.map((r: any) => ({
                    id: r.targetId || r.userId || r.id,
                    name: r.displayName || r.username || 'User',
                    handle: r.username || r.displayName || '',
                    status: r.presence || 'offline',
                }));
                setFriends(mapped);
            })
            .catch(() => {
                addToast({ title: 'Failed to load friends', variant: 'error' });
            })
            .finally(() => setIsLoading(false));
    }, []);

    const filteredUsers = query.trim()
        ? friends.filter(u => u.name.toLowerCase().includes(query.toLowerCase()) || u.handle.toLowerCase().includes(query.toLowerCase()))
        : friends;

    const handleSelectUser = async (userId: string) => {
        try {
            const dm = await api.relationships.openDm(userId);
            navigate(buildDmRoute(dm.id));
        } catch {
            addToast({ title: 'Failed to open DM', description: 'Could not resolve DM channel for this user.', variant: 'error' });
            return;
        }
        onClose();
    };

    return (
        <div role="dialog" aria-modal="true" aria-label="Search direct messages" style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            animation: 'fadeIn 0.2s ease-out'
        }}>
            <div style={{
                width: '480px', padding: 0, position: 'relative', overflow: 'hidden',
                background: 'var(--bg-elevated)', border: '3px solid #000000',
                boxShadow: '8px 8px 0 #000000', borderRadius: '0px',
                animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
                <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid var(--stroke)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: 600, fontFamily: 'var(--font-display)', margin: 0 }}>Select Friends</h2>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                            <X size={20} />
                        </button>
                    </div>
                    <div style={{ position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Type the username of a friend..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            style={{
                                width: '100%', padding: '12px 12px 12px 40px', background: 'var(--bg-tertiary)',
                                border: '1px solid var(--stroke)', borderRadius: '8px', color: 'white', fontSize: '15px',
                                outline: 'none', boxSizing: 'border-box'
                            }}
                        />
                    </div>
                </div>

                <div style={{ maxHeight: '320px', overflowY: 'auto', padding: '8px 0' }}>
                    {isLoading ? (
                        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '24px', height: '24px', border: '3px solid var(--stroke)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                            <span style={{ fontSize: '13px' }}>Loading friends...</span>
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            {query ? `No friends found matching "${query}"` : 'No friends yet. Add some friends first!'}
                        </div>
                    ) : (
                        filteredUsers.map(user => (
                            <div
                                key={user.id}
                                onClick={() => handleSelectUser(user.id)}
                                onMouseEnter={() => setHoveredUserId(user.id)}
                                onMouseLeave={() => setHoveredUserId(null)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 24px',
                                    cursor: 'pointer', transition: 'background 0.2s',
                                    background: hoveredUserId === user.id ? 'var(--bg-tertiary)' : 'transparent'
                                }}
                            >
                                <Avatar userId={user.id} displayName={user.name} size={40} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ fontWeight: 600, fontSize: '15px' }}>{user.name}</div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>@{user.handle}</div>
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{user.status}</div>
                                </div>
                                <MessageSquare size={18} color="var(--text-muted)" />
                            </div>
                        ))
                    )}
                </div>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default DMSearchModal;
