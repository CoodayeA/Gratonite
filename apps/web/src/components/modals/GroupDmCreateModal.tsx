import { useState, useEffect } from 'react';
import { X, Search, Check } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../ui/ToastManager';
import { useNavigate } from 'react-router-dom';
import Avatar from '../ui/Avatar';

type Friend = {
    id: string;
    username: string;
    displayName: string;
    avatarHash: string | null;
};

type Props = {
    onClose: () => void;
};

const GroupDmCreateModal = ({ onClose }: Props) => {
    const navigate = useNavigate();
    const { addToast } = useToast();
    const [friends, setFriends] = useState<Friend[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [groupName, setGroupName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        api.relationships.getAll().then((rels: any[]) => {
            const friendList = rels
                .filter((r) => r.type === 'FRIEND')
                .map((r) => r.user as Friend);
            // Deduplicate by id
            const seen = new Set<string>();
            const unique: Friend[] = [];
            for (const f of friendList) {
                if (!seen.has(f.id)) {
                    seen.add(f.id);
                    unique.push(f);
                }
            }
            setFriends(unique);
        }).catch(() => {
            addToast({ title: 'Failed to load friends', variant: 'error' });
        });
    }, [addToast]);

    const toggleFriend = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                if (next.size >= 9) {
                    addToast({ title: 'Maximum 9 other members', variant: 'error' });
                    return prev;
                }
                next.add(id);
            }
            return next;
        });
    };

    const handleCreate = async () => {
        if (selectedIds.size === 0) return;
        setCreating(true);
        try {
            const channel = await api.groupDms.create(
                Array.from(selectedIds),
                groupName.trim() || undefined,
            );
            addToast({ title: 'Group DM created', variant: 'success' });
            onClose();
            navigate(`/dm/${channel.id}`);
        } catch (err: any) {
            addToast({ title: 'Failed to create group DM', description: err?.message, variant: 'error' });
        } finally {
            setCreating(false);
        }
    };

    const filteredFriends = friends.filter((f) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return f.displayName.toLowerCase().includes(q) || f.username.toLowerCase().includes(q);
    });

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)',
        }} onClick={onClose}>
            <div style={{
                background: 'var(--bg-elevated)', borderRadius: '12px',
                width: '440px', maxHeight: '560px', display: 'flex', flexDirection: 'column',
                boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
            }} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div style={{ padding: '20px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Create Group DM</h2>
                    <X size={20} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={onClose} />
                </div>

                {/* Group name */}
                <div style={{ padding: '16px 20px 0' }}>
                    <input
                        type="text"
                        placeholder="Group name (optional)"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        maxLength={100}
                        style={{
                            width: '100%', padding: '10px 12px', borderRadius: '8px',
                            background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                            color: 'var(--text-primary)', fontSize: '14px', outline: 'none',
                            boxSizing: 'border-box',
                        }}
                    />
                </div>

                {/* Search */}
                <div style={{ padding: '12px 20px', position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: '32px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        placeholder="Search friends..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px',
                            background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)',
                            color: 'var(--text-primary)', fontSize: '14px', outline: 'none',
                            boxSizing: 'border-box',
                        }}
                    />
                </div>

                {/* Selected count */}
                {selectedIds.size > 0 && (
                    <div style={{ padding: '0 20px 8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                        {selectedIds.size} selected (max 9)
                    </div>
                )}

                {/* Friend list */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px' }}>
                    {filteredFriends.length === 0 ? (
                        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                            {friends.length === 0 ? 'No friends yet' : 'No matches'}
                        </div>
                    ) : (
                        filteredFriends.map((friend) => {
                            const selected = selectedIds.has(friend.id);
                            return (
                                <div
                                    key={friend.id}
                                    onClick={() => toggleFriend(friend.id)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '12px',
                                        padding: '8px 12px', borderRadius: '8px', cursor: 'pointer',
                                        background: selected ? 'rgba(212,175,55,0.1)' : 'transparent',
                                        transition: 'background 0.15s',
                                    }}
                                    onMouseOver={(e) => { if (!selected) e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                                    onMouseOut={(e) => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
                                >
                                    <Avatar
                                        userId={friend.id}
                                        avatarHash={friend.avatarHash}
                                        displayName={friend.displayName || friend.username}
                                        size={36}
                                    />
                                    <div style={{ flex: 1, overflow: 'hidden' }}>
                                        <div style={{ fontSize: '14px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {friend.displayName || friend.username}
                                        </div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{friend.username}</div>
                                    </div>
                                    <div style={{
                                        width: '22px', height: '22px', borderRadius: '6px',
                                        border: selected ? '2px solid var(--accent-primary)' : '2px solid var(--stroke)',
                                        background: selected ? 'var(--accent-primary)' : 'transparent',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        transition: 'all 0.15s', flexShrink: 0,
                                    }}>
                                        {selected && <Check size={14} color="var(--bg-app)" />}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 20px', borderTop: '1px solid var(--stroke)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '10px 20px', borderRadius: '8px', border: 'none',
                            background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                            fontSize: '14px', fontWeight: 500, cursor: 'pointer',
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={selectedIds.size === 0 || creating}
                        style={{
                            padding: '10px 20px', borderRadius: '8px', border: 'none',
                            background: selectedIds.size > 0 ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                            color: selectedIds.size > 0 ? 'var(--bg-app)' : 'var(--text-muted)',
                            fontSize: '14px', fontWeight: 600, cursor: selectedIds.size > 0 ? 'pointer' : 'default',
                            opacity: creating ? 0.6 : 1,
                        }}
                    >
                        {creating ? 'Creating...' : `Create Group DM${selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GroupDmCreateModal;
