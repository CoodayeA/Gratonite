import { useState, useEffect, useCallback, useRef } from 'react';
import { getSocket } from '../../lib/socket';
import { useNavigate } from 'react-router-dom';
import { Search, UserPlus, MoreVertical, MessageSquare, X, UserMinus, VolumeX, Flag, Phone, Video, User, Gamepad2, Headphones, Eye } from 'lucide-react';
import { useToast } from '../../components/ui/ToastManager';
import { api, ApiRequestError } from '../../lib/api';
import { type ActivityEntry } from '../../utils/activity';
import ActivityCard from '../../components/ui/ActivityCard';
import Avatar from '../../components/ui/Avatar';
import { SkeletonFriendList } from '../../components/ui/SkeletonLoader';
import { ErrorState } from '../../components/ui/ErrorState';

function ReferralCard() {
    const [refData, setRefData] = useState<{ code: string; referralLink: string; count: number } | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        api.get<any>('/referrals/@me').then(data => {
            if (data?.referralLink) setRefData(data);
        }).catch(() => {});
    }, []);

    if (!refData) return null;

    return (
        <div style={{ background: 'var(--bg-tertiary)', borderRadius: 8, padding: 16, marginBottom: 16, border: '1px solid var(--stroke)' }}>
            <h3 style={{ color: 'var(--text-primary)', margin: '0 0 8px', fontSize: '15px', fontWeight: 600 }}>Invite Friends</h3>
            <p style={{ color: 'var(--text-muted)', margin: '0 0 12px', fontSize: 13 }}>
                Share your personal invite link and earn rewards for every friend who joins!
                {refData.count > 0 && ` You've referred ${refData.count} friend${refData.count > 1 ? 's' : ''} so far.`}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
                <input
                    readOnly
                    value={refData.referralLink}
                    style={{ flex: 1, background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: 4, padding: '6px 10px', color: 'var(--text-primary)', fontSize: 13 }}
                />
                <button
                    onClick={() => { navigator.clipboard.writeText(refData.referralLink); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                    style={{ background: 'var(--accent-primary)', color: '#000', border: 'none', borderRadius: 4, padding: '6px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
                >
                    {copied ? 'Copied!' : 'Copy'}
                </button>
            </div>
        </div>
    );
}

type FriendStatus = 'online' | 'idle' | 'dnd' | 'offline';

interface Friend {
    id: string;
    username: string;
    displayName: string;
    status: FriendStatus;
    customStatus?: string;
    avatar: string;
    avatarHash?: string | null;
    activity?: ActivityEntry;
}

const Friends = () => {
    const navigate = useNavigate();
    const { addToast } = useToast();
    const [activeTab, setActiveTab] = useState<'online' | 'all' | 'pending' | 'activity' | 'add'>('online');
    const [searchQuery, setSearchQuery] = useState('');
    const [moreMenuId, setMoreMenuId] = useState<string | null>(null);
    const [addFriendInput, setAddFriendInput] = useState('');
    const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
    const detailPanelRef = useRef<HTMLDivElement>(null);

    // Real data from API
    const [friends, setFriends] = useState<Friend[]>([]);
    const [requests, setRequests] = useState<{ id: string; username: string; displayName: string; type: string; avatar: string; avatarHash?: string; nameplateStyle?: string }[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [fetchError, setFetchError] = useState(false);

    const fetchRelationships = useCallback(async () => {
        setFetchError(false);
        try {
            const rels = await api.relationships.getAll();
            const friendList: Friend[] = [];
            const requestList: typeof requests = [];
            for (const rel of rels) {
                const user = (rel as any).user || {};
                const name = user.displayName || user.username || rel.userId?.slice(0, 8) || 'Unknown';
                if ((rel as any).type === 'FRIEND' || (rel as any).type === 'friend' || (rel as any).type === 1) {
                    friendList.push({
                        id: user.id || (rel as any).userId,
                        username: user.username || name,
                        displayName: name,
                        status: 'online', // Will be updated by presence
                        avatar: name.charAt(0).toUpperCase(),
                        avatarHash: user.avatarHash ?? null,
                    });
                } else if ((rel as any).type === 'PENDING_INCOMING' || (rel as any).type === 'pending_incoming' || (rel as any).type === 3) {
                    requestList.push({
                        id: user.id || (rel as any).userId,
                        username: user.username || name,
                        displayName: name,
                        type: 'incoming',
                        avatar: name.charAt(0).toUpperCase(),
                        avatarHash: user.avatarHash,
                        nameplateStyle: user.nameplateStyle,
                    });
                } else if ((rel as any).type === 'PENDING_OUTGOING' || (rel as any).type === 'pending_outgoing' || (rel as any).type === 4) {
                    requestList.push({
                        id: user.id || (rel as any).userId,
                        username: user.username || name,
                        displayName: name,
                        type: 'outgoing',
                        avatar: name.charAt(0).toUpperCase(),
                        avatarHash: user.avatarHash,
                        nameplateStyle: user.nameplateStyle,
                    });
                }
            }
            // Fetch presences for friends
            if (friendList.length > 0) {
                try {
                    const presences = await api.users.getPresences(friendList.map(f => f.id));
                    for (const p of presences) {
                        const friend = friendList.find(f => f.id === p.userId);
                        if (friend) friend.status = p.status as FriendStatus;
                    }
                } catch { /* ignore */ }
            }
            // Activity will come from real presence data in v1
            // (placeholder activity removed)
            setFriends(friendList);
            setRequests(requestList);
        } catch { setFetchError(true); }
        finally { setIsLoading(false); }
    }, []);

    useEffect(() => { fetchRelationships(); }, [fetchRelationships]);

    // Listen for incoming friend requests in real-time
    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;
        const handler = () => { fetchRelationships(); };
        socket.on('FRIEND_REQUEST_RECEIVED', handler);
        return () => { socket.off('FRIEND_REQUEST_RECEIVED', handler); };
    }, [fetchRelationships]);

    const handleAddFriend = async () => {
        if (!addFriendInput.trim()) return;
        try {
            // Search for user by username first
            const users = await api.users.searchUsers(addFriendInput.trim());
            if (users.length === 0) {
                addToast({ title: 'User not found', description: `Could not find user "${addFriendInput}"`, variant: 'error' });
                return;
            }
            await api.relationships.sendFriendRequest(users[0].id);
            addToast({ title: 'Friend Request Sent', description: `A friend request was sent to ${users[0].displayName || users[0].username}!`, variant: 'success' });
            setAddFriendInput('');
            fetchRelationships();
        } catch (err) {
            if (err instanceof ApiRequestError && err.code === 'CONFLICT') {
                const msg = err.message.includes('already friends')
                    ? 'You are already friends with this user.'
                    : 'A friend request is already pending.';
                addToast({ title: 'Already connected', description: msg, variant: 'info' });
            } else {
                addToast({ title: 'Failed', description: 'Could not send friend request.', variant: 'error' });
            }
        }
    };

    const handleAcceptRequest = async (userId: string, displayName: string) => {
        try {
            await api.relationships.acceptFriendRequest(userId);
            addToast({ title: 'Friend Request Accepted', description: `You are now friends with ${displayName}!`, variant: 'success' });
            fetchRelationships();
        } catch {
            addToast({ title: 'Failed', variant: 'error' });
        }
    };

    const handleRemoveFriend = async (userId: string, displayName: string) => {
        try {
            await api.relationships.removeFriend(userId);
            addToast({ title: 'Friend Removed', description: `${displayName} removed from friends.`, variant: 'info' });
            setSelectedFriend(null);
            fetchRelationships();
        } catch {
            addToast({ title: 'Failed', variant: 'error' });
        }
    };

    const handleBlock = async (userId: string, displayName: string) => {
        try {
            await api.relationships.block(userId);
            addToast({ title: 'User Blocked', description: `${displayName} has been blocked.`, variant: 'info' });
            setSelectedFriend(null);
            fetchRelationships();
        } catch {
            addToast({ title: 'Failed', variant: 'error' });
        }
    };

    const handleOpenDm = async (userId: string, _displayName: string) => {
        try {
            const dm = await api.relationships.openDm(userId);
            navigate(`/dm/${dm.id}`);
        } catch {
            addToast({ title: 'Failed to open DM', variant: 'error' });
        }
    };

    const dismissMenu = useCallback(() => { if (moreMenuId) setMoreMenuId(null); }, [moreMenuId]);
    useEffect(() => {
        if (moreMenuId) { document.addEventListener('click', dismissMenu); return () => document.removeEventListener('click', dismissMenu); }
    }, [moreMenuId, dismissMenu]);

    // Close detail panel when clicking outside
    useEffect(() => {
        if (!selectedFriend) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (detailPanelRef.current && !detailPanelRef.current.contains(e.target as Node)) {
                setSelectedFriend(null);
            }
        };
        // Delay adding listener so the click that opened the panel doesn't immediately close it
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 0);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [selectedFriend]);

    const getStatusColor = (status: FriendStatus) => {
        switch (status) {
            case 'online': return 'var(--success)';
            case 'idle': return 'var(--warning)';
            case 'dnd': return 'var(--error)';
            case 'offline': default: return 'var(--text-muted)';
        }
    };

    const getStatusLabel = (status: FriendStatus) => {
        switch (status) {
            case 'online': return 'Online';
            case 'idle': return 'Idle';
            case 'dnd': return 'Do Not Disturb';
            case 'offline': return 'Offline';
        }
    };

    const handleFriendRowClick = (friend: Friend, e: React.MouseEvent) => {
        // Don't trigger if clicking on action buttons
        const target = e.target as HTMLElement;
        if (target.closest('.friend-actions')) return;
        setSelectedFriend(prev => prev?.id === friend.id ? null : friend);
    };

    const renderDetailPanel = () => {
        if (!selectedFriend) return null;
        return (
            <div
                ref={detailPanelRef}
                style={{
                    width: '320px',
                    minWidth: '320px',
                    height: '100%',
                    background: 'var(--bg-secondary)',
                    borderLeft: '1px solid var(--stroke)',
                    display: 'flex',
                    flexDirection: 'column',
                    animation: 'slideInRight 0.2s ease-out',
                    overflow: 'hidden',
                }}
            >
                {/* Panel Header */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--stroke)',
                }}>
                    <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        User Profile
                    </span>
                    <button
                        onClick={() => setSelectedFriend(null)}
                        style={{
                            width: '28px', height: '28px', borderRadius: '4px',
                            background: 'transparent', border: 'none',
                            color: 'var(--text-muted)', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Avatar + Name + Status */}
                <div style={{ padding: '24px 20px', textAlign: 'center' }}>
                    <div style={{ margin: '0 auto 16px', width: 'fit-content' }}>
                        <Avatar
                            userId={selectedFriend.id}
                            displayName={selectedFriend.displayName}
                            size={80}
                            status={selectedFriend.status}
                            statusRingColor="var(--bg-secondary)"
                            avatarHash={selectedFriend.avatarHash}
                        />
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '20px', marginBottom: '4px' }}>
                        {selectedFriend.displayName}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '4px' }}>
                        {selectedFriend.username}
                    </div>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        color: 'var(--text-secondary)', fontSize: '13px',
                        background: 'var(--bg-tertiary)', padding: '4px 10px', borderRadius: '12px',
                    }}>
                        <div style={{
                            width: '8px', height: '8px', borderRadius: '50%',
                            background: getStatusColor(selectedFriend.status),
                        }} />
                        {selectedFriend.customStatus || getStatusLabel(selectedFriend.status)}
                    </div>
                    {selectedFriend.activity && (
                        <div style={{ marginTop: '12px', width: '100%', textAlign: 'left' }}>
                            <ActivityCard activity={selectedFriend.activity} />
                        </div>
                    )}
                </div>

                {/* Quick Action Buttons */}
                <div style={{ padding: '0 20px 20px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    <button
                        onClick={() => {
                            navigate('/dm');
                            handleOpenDm(selectedFriend.id, selectedFriend.displayName);
                            setSelectedFriend(null);
                        }}
                        style={{
                            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                            padding: '12px 8px', borderRadius: '8px',
                            background: 'var(--bg-tertiary)', border: 'none',
                            color: 'var(--text-secondary)', cursor: 'pointer',
                            transition: 'all 0.15s', fontSize: '11px', fontWeight: 500,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    >
                        <MessageSquare size={20} />
                        Message
                    </button>
                    <button
                        onClick={async () => {
                            try {
                                const dm = await api.relationships.openDm(selectedFriend.id);
                                setSelectedFriend(null);
                                navigate(`/dm/${dm.id}?call=voice`);
                            } catch {
                                addToast({ title: 'Failed to start call', variant: 'error' });
                            }
                        }}
                        style={{
                            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                            padding: '12px 8px', borderRadius: '8px',
                            background: 'var(--bg-tertiary)', border: 'none',
                            color: 'var(--text-secondary)', cursor: 'pointer',
                            transition: 'all 0.15s', fontSize: '11px', fontWeight: 500,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    >
                        <Phone size={20} />
                        Voice Call
                    </button>
                    <button
                        onClick={async () => {
                            try {
                                const dm = await api.relationships.openDm(selectedFriend.id);
                                setSelectedFriend(null);
                                navigate(`/dm/${dm.id}?call=video`);
                            } catch {
                                addToast({ title: 'Failed to start call', variant: 'error' });
                            }
                        }}
                        style={{
                            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                            padding: '12px 8px', borderRadius: '8px',
                            background: 'var(--bg-tertiary)', border: 'none',
                            color: 'var(--text-secondary)', cursor: 'pointer',
                            transition: 'all 0.15s', fontSize: '11px', fontWeight: 500,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    >
                        <Video size={20} />
                        Video Call
                    </button>
                </div>

                {/* Divider */}
                <div style={{ height: '1px', background: 'var(--stroke)', margin: '0 20px' }} />

                {/* Additional Actions */}
                <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <button
                        onClick={() => {
                            addToast({ title: 'Profile', description: `Opening profile for ${selectedFriend.displayName}`, variant: 'info' });
                        }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '10px 12px', borderRadius: '6px',
                            background: 'transparent', border: 'none',
                            color: 'var(--text-secondary)', cursor: 'pointer',
                            transition: 'all 0.15s', fontSize: '14px', fontWeight: 500,
                            width: '100%', textAlign: 'left',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    >
                        <User size={16} />
                        View Full Profile
                    </button>

                    <button
                        onClick={() => {
                            handleBlock(selectedFriend.id, selectedFriend.displayName);
                            setSelectedFriend(null);
                        }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '10px 12px', borderRadius: '6px',
                            background: 'transparent', border: 'none',
                            color: 'var(--text-secondary)', cursor: 'pointer',
                            transition: 'all 0.15s', fontSize: '14px', fontWeight: 500,
                            width: '100%', textAlign: 'left',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    >
                        <Flag size={16} />
                        Block User
                    </button>

                    <button
                        onClick={() => {
                            handleRemoveFriend(selectedFriend.id, selectedFriend.displayName);
                            setSelectedFriend(null);
                        }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '10px 12px', borderRadius: '6px',
                            background: 'transparent', border: 'none',
                            color: 'var(--error)', cursor: 'pointer',
                            transition: 'all 0.15s', fontSize: '14px', fontWeight: 500,
                            width: '100%', textAlign: 'left',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                        <UserMinus size={16} />
                        Remove Friend
                    </button>
                </div>
            </div>
        );
    };

    const renderFriendList = (friends: Friend[]) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {friends.map(friend => (
                <div
                    key={friend.id}
                    className="friend-row"
                    onClick={(e) => handleFriendRowClick(friend, e)}
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 16px', borderRadius: '8px', cursor: 'pointer',
                        transition: 'background 0.2s', borderTop: '1px solid transparent',
                        background: selectedFriend?.id === friend.id ? 'var(--bg-tertiary)' : 'transparent',
                    }}
                    onMouseOver={e => { if (selectedFriend?.id !== friend.id) e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                    onMouseOut={e => { if (selectedFriend?.id !== friend.id) e.currentTarget.style.background = 'transparent'; }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <Avatar
                            userId={friend.id}
                            displayName={friend.displayName}
                            size={40}
                            status={friend.status}
                            statusRingColor="var(--bg-primary)"
                            avatarHash={friend.avatarHash}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                <span style={{ fontWeight: 600, fontSize: '15px' }}>{friend.displayName}</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{friend.username}</span>
                            </div>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                                {friend.customStatus || (friend.status === 'dnd' ? 'Do Not Disturb' : friend.status.charAt(0).toUpperCase() + friend.status.slice(1))}
                            </span>
                            {friend.activity && (
                                <ActivityCard activity={friend.activity} compact />
                            )}
                        </div>
                    </div>

                    <div className="friend-actions" style={{ display: 'flex', gap: '8px', position: 'relative' }}>
                        <button onClick={() => handleOpenDm(friend.id, friend.displayName)} style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-elevated)', border: 'none', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }} title="Message">
                            <MessageSquare size={18} />
                        </button>
                        <button
                            onClick={async () => {
                                try {
                                    const dm = await api.relationships.openDm(friend.id);
                                    navigate(`/dm/${dm.id}?call=voice`);
                                } catch {
                                    addToast({ title: 'Failed to start call', variant: 'error' });
                                }
                            }}
                            style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-elevated)', border: 'none', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                            title="Voice Call"
                        >
                            <Phone size={18} />
                        </button>
                        <button
                            onClick={async () => {
                                try {
                                    const dm = await api.relationships.openDm(friend.id);
                                    navigate(`/dm/${dm.id}?call=video`);
                                } catch {
                                    addToast({ title: 'Failed to start call', variant: 'error' });
                                }
                            }}
                            style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-elevated)', border: 'none', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                            title="Video Call"
                        >
                            <Video size={18} />
                        </button>
                        <button onClick={() => setMoreMenuId(moreMenuId === friend.id ? null : friend.id)} style={{ width: '36px', height: '36px', borderRadius: '50%', background: moreMenuId === friend.id ? 'var(--accent-primary)' : 'var(--bg-elevated)', border: 'none', color: moreMenuId === friend.id ? '#000' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }} title="More">
                            <MoreVertical size={18} />
                        </button>
                        {moreMenuId === friend.id && (
                            <div style={{ position: 'absolute', top: '42px', right: 0, background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '8px', padding: '4px', minWidth: '160px', zIndex: 50, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                                <div onClick={() => { setMoreMenuId(null); handleRemoveFriend(friend.id, friend.displayName); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)', transition: 'background 0.15s' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                    <UserMinus size={14} /> Remove Friend
                                </div>
                                <div onClick={() => { setMoreMenuId(null); addToast({ title: 'User Muted', description: `${friend.displayName} has been muted.`, variant: 'info' }); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)', transition: 'background 0.15s' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                    <VolumeX size={14} /> Mute
                                </div>
                                <div onClick={() => { setMoreMenuId(null); addToast({ title: 'User Reported', description: `Report filed for ${friend.displayName}.`, variant: 'info' }); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', color: 'var(--error)', transition: 'background 0.15s' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                    <Flag size={14} /> Report
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', height: '100%' }}>
            {/* Header */}
            <header style={{ height: '60px', borderBottom: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', padding: '0 24px', gap: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontWeight: 600 }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)' }}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                    <span>Friends</span>
                </div>

                <div style={{ width: '1px', height: '24px', background: 'var(--stroke)' }}></div>

                <div style={{ display: 'flex', gap: '16px' }}>
                    <button className={activeTab === 'online' ? 'active-tab' : 'tab-btn'} onClick={() => setActiveTab('online')} style={{ background: activeTab === 'online' ? 'var(--bg-tertiary)' : 'transparent', border: 'none', padding: '6px 12px', borderRadius: '4px', color: activeTab === 'online' ? 'white' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 500 }}>Online</button>
                    <button className={activeTab === 'all' ? 'active-tab' : 'tab-btn'} onClick={() => setActiveTab('all')} style={{ background: activeTab === 'all' ? 'var(--bg-tertiary)' : 'transparent', border: 'none', padding: '6px 12px', borderRadius: '4px', color: activeTab === 'all' ? 'white' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 500 }}>All</button>
                    <button className={activeTab === 'pending' ? 'active-tab' : 'tab-btn'} onClick={() => setActiveTab('pending')} style={{ background: activeTab === 'pending' ? 'var(--bg-tertiary)' : 'transparent', border: 'none', padding: '6px 12px', borderRadius: '4px', color: activeTab === 'pending' ? 'white' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 500 }}>Pending {requests.length > 0 && <span style={{ background: 'var(--error)', color: 'white', padding: '2px 6px', borderRadius: '10px', fontSize: '10px', marginLeft: '4px' }}>{requests.length}</span>}</button>
                    <button className={activeTab === 'activity' ? 'active-tab' : 'tab-btn'} onClick={() => setActiveTab('activity')} style={{ background: activeTab === 'activity' ? 'var(--bg-tertiary)' : 'transparent', border: 'none', padding: '6px 12px', borderRadius: '4px', color: activeTab === 'activity' ? 'white' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 500 }}>Activity</button>
                    <button className={activeTab === 'add' ? 'active-tab' : 'tab-btn'} onClick={() => setActiveTab('add')} style={{ background: activeTab === 'add' ? 'rgba(16, 185, 129, 0.2)' : 'var(--success)', border: 'none', padding: '6px 12px', borderRadius: '4px', color: activeTab === 'add' ? 'var(--success)' : 'white', cursor: 'pointer', fontWeight: 500 }}>Add Friend</button>
                </div>
            </header>

            {/* Main body: content + optional detail panel */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Content Area */}
                <div style={{ flex: 1, padding: '24px 32px', overflowY: 'auto' }}>
                    {isLoading ? (
                        <SkeletonFriendList count={6} />
                    ) : fetchError ? (
                        <ErrorState
                            message="Failed to load friends"
                            description="Could not fetch your friends list. Check your connection and try again."
                            onRetry={fetchRelationships}
                        />
                    ) : (
                    <>
                    <ReferralCard />
                    {activeTab !== 'add' && activeTab !== 'activity' && (
                        <div style={{ position: 'relative', marginBottom: '24px' }}>
                            <input
                                type="text"
                                className="auth-input"
                                placeholder="Search"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{ paddingRight: '40px', margin: 0 }}
                            />
                            <Search size={18} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        </div>
                    )}

                    {activeTab === 'online' && (() => {
                        const onlineFriends = friends.filter(f => f.status !== 'offline' && (f.username.includes(searchQuery) || f.displayName.includes(searchQuery)));
                        return (
                            <div>
                                <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px', borderBottom: '1px solid var(--stroke)', paddingBottom: '8px' }}>
                                    Online — {friends.filter(f => f.status !== 'offline').length}
                                </h3>
                                {renderFriendList(onlineFriends)}
                                {onlineFriends.length === 0 && (
                                    <div style={{
                                        textAlign: 'center',
                                        padding: '64px 24px',
                                        color: 'var(--text-muted)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '12px',
                                    }}>
                                        <div style={{
                                            width: '80px',
                                            height: '80px',
                                            borderRadius: '50%',
                                            background: 'var(--bg-tertiary)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            marginBottom: '8px',
                                            border: '2px dashed var(--stroke)',
                                        }}>
                                            <span style={{ fontSize: '36px' }}>&#x1F634;</span>
                                        </div>
                                        <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>No friends online</p>
                                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '300px', lineHeight: '1.5', margin: 0 }}>
                                            Everyone's offline right now. Check back later or add more friends to grow your circle!
                                        </p>
                                        <button
                                            onClick={() => setActiveTab('add')}
                                            style={{
                                                marginTop: '8px',
                                                background: 'var(--accent-primary)',
                                                color: 'var(--bg-primary)',
                                                border: 'none',
                                                padding: '10px 24px',
                                                borderRadius: 'var(--radius-md)',
                                                fontSize: '14px',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                            }}
                                        >
                                            <UserPlus size={16} />
                                            Add Friend
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {activeTab === 'all' && (() => {
                        const allFiltered = friends.filter(f => f.username.includes(searchQuery) || f.displayName.includes(searchQuery));
                        return (
                            <div>
                                <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px', borderBottom: '1px solid var(--stroke)', paddingBottom: '8px' }}>
                                    All Friends — {friends.length}
                                </h3>
                                {renderFriendList(allFiltered)}
                                {allFiltered.length === 0 && (
                                    <div style={{
                                        textAlign: 'center',
                                        padding: '64px 24px',
                                        color: 'var(--text-muted)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '12px',
                                    }}>
                                        <div style={{
                                            width: '80px',
                                            height: '80px',
                                            borderRadius: '50%',
                                            background: 'var(--bg-tertiary)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            marginBottom: '8px',
                                            border: '2px dashed var(--stroke)',
                                        }}>
                                            <span style={{ fontSize: '36px' }}>&#x1F44B;</span>
                                        </div>
                                        <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>No friends yet</p>
                                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '300px', lineHeight: '1.5', margin: 0 }}>
                                            Search for people to add and start building your community!
                                        </p>
                                        <button
                                            onClick={() => setActiveTab('add')}
                                            style={{
                                                marginTop: '8px',
                                                background: 'var(--accent-primary)',
                                                color: 'var(--bg-primary)',
                                                border: 'none',
                                                padding: '10px 24px',
                                                borderRadius: 'var(--radius-md)',
                                                fontSize: '14px',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                            }}
                                        >
                                            <UserPlus size={16} />
                                            Add Friend
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {activeTab === 'pending' && (
                        <div>
                            <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px', borderBottom: '1px solid var(--stroke)', paddingBottom: '8px' }}>
                                Pending Requests — {requests.length}
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                {requests.filter(r => r.username.includes(searchQuery) || r.displayName.includes(searchQuery)).map(req => (
                                    <div key={req.id} className="friend-row" style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '12px 16px', borderRadius: '8px', cursor: 'pointer',
                                        transition: 'background 0.2s'
                                    }} onMouseOver={e => e.currentTarget.style.background = 'var(--bg-tertiary)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <Avatar
                                                userId={req.id}
                                                displayName={req.displayName}
                                                avatarHash={req.avatarHash}
                                                size={40}
                                            />
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                                    <span className={req.nameplateStyle && req.nameplateStyle !== 'none' ? `nameplate-${req.nameplateStyle}` : undefined} style={{ fontWeight: 600, fontSize: '15px' }}>{req.displayName}</span>
                                                    <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{req.username}</span>
                                                </div>
                                                <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                                                    {req.type === 'incoming' ? 'Incoming Friend Request' : 'Outgoing Friend Request'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="friend-actions" style={{ display: 'flex', gap: '8px' }}>
                                            {req.type === 'incoming' && (
                                                <button onClick={() => handleAcceptRequest(req.id, req.displayName)} style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-elevated)', border: 'none', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="Accept">
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                </button>
                                            )}
                                            <button onClick={async () => {
                                                try {
                                                    await api.relationships.removeFriend(req.id);
                                                    addToast({ title: req.type === 'incoming' ? 'Request Declined' : 'Request Cancelled', description: `Friend request ${req.type === 'incoming' ? 'from' : 'to'} ${req.displayName} has been ${req.type === 'incoming' ? 'declined' : 'cancelled'}.`, variant: 'info' });
                                                    fetchRelationships();
                                                } catch {
                                                    addToast({ title: 'Failed', variant: 'error' });
                                                }
                                            }} style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-elevated)', border: 'none', color: 'var(--error)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title={req.type === 'incoming' ? 'Decline' : 'Cancel'}>
                                                <X size={20} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'activity' && (() => {
                        const activityTypeIcon = (type: string) => {
                            if (type === 'game' || type === 'PLAYING') return Gamepad2;
                            if (type === 'music' || type === 'LISTENING') return Headphones;
                            if (type === 'watching' || type === 'WATCHING') return Eye;
                            return Gamepad2;
                        };
                        const activityTypeLabel = (type: string) => {
                            if (type === 'game' || type === 'PLAYING') return 'Playing';
                            if (type === 'music' || type === 'LISTENING') return 'Listening to';
                            if (type === 'watching' || type === 'WATCHING') return 'Watching';
                            return 'Playing';
                        };
                        const friendsWithActivity = friends.filter(f => f.activity && f.status !== 'offline');
                        const onlineNoActivity = friends.filter(f => !f.activity && f.status !== 'offline');
                        return (
                            <div>
                                {friendsWithActivity.length > 0 && (
                                    <>
                                        <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px', borderBottom: '1px solid var(--stroke)', paddingBottom: '8px' }}>
                                            Now Playing — {friendsWithActivity.length}
                                        </h3>
                                        {friendsWithActivity.map(f => {
                                            const Icon = activityTypeIcon(f.activity!.type);
                                            return (
                                                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)', marginBottom: '8px', cursor: 'pointer' }}
                                                    onClick={() => setSelectedFriend(f)}>
                                                    <Avatar userId={f.id} avatarHash={f.avatarHash ?? null} displayName={f.displayName} size={40} status={f.status as any} />
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{f.displayName}</div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '12px' }}>
                                                            <Icon size={12} />
                                                            <span>{activityTypeLabel(f.activity!.type)} <strong style={{ color: 'var(--text-secondary)' }}>{f.activity!.name}</strong></span>
                                                        </div>
                                                        {f.activity!.startedAt && (
                                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                                for {Math.round((Date.now() - f.activity!.startedAt) / 60000)}m
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </>
                                )}
                                {onlineNoActivity.length > 0 && (
                                    <>
                                        <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px', marginTop: '24px', borderBottom: '1px solid var(--stroke)', paddingBottom: '8px' }}>
                                            Online — No Activity — {onlineNoActivity.length}
                                        </h3>
                                        {onlineNoActivity.map(f => (
                                            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', borderRadius: 'var(--radius-sm)', marginBottom: '4px', cursor: 'pointer' }}
                                                onClick={() => setSelectedFriend(f)}>
                                                <Avatar userId={f.id} avatarHash={f.avatarHash ?? null} displayName={f.displayName} size={32} status={f.status as any} />
                                                <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{f.displayName}</span>
                                            </div>
                                        ))}
                                    </>
                                )}
                                {friendsWithActivity.length === 0 && onlineNoActivity.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '64px 24px', color: 'var(--text-muted)' }}>
                                        <Gamepad2 size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
                                        <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>No friends are active right now</p>
                                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '300px', margin: '8px auto 0' }}>
                                            When your friends start an activity, it will show up here.
                                        </p>
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {activeTab === 'add' && (
                        <div style={{ maxWidth: '600px', margin: '0 auto', marginTop: '40px' }}>
                            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                                <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px' }}>Add Friend</h2>
                                <p style={{ color: 'var(--text-secondary)' }}>You can add friends with their Gratonite username.</p>
                            </div>

                            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                <input
                                    type="text"
                                    className="auth-input"
                                    placeholder="Enter Username#0000"
                                    value={addFriendInput}
                                    onChange={(e) => setAddFriendInput(e.target.value)}
                                    style={{ margin: 0, paddingRight: '140px', background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', height: '56px', fontSize: '16px' }}
                                />
                                <button
                                    onClick={() => {
                                        if (addFriendInput.length > 0) {
                                            handleAddFriend();
                                        }
                                    }}
                                    style={{
                                        position: 'absolute', right: '8px',
                                        background: addFriendInput.length > 0 ? 'var(--accent-primary)' : 'rgba(82, 109, 245, 0.5)',
                                        border: 'none',
                                        padding: '8px 16px',
                                        borderRadius: '4px',
                                        color: 'white',
                                        fontWeight: 600,
                                        cursor: addFriendInput.length > 0 ? 'pointer' : 'default',
                                        transition: 'background 0.2s'
                                    }}
                                >
                                    Send Friend Request
                                </button>
                            </div>

                            <div style={{ marginTop: '48px', paddingTop: '32px', borderTop: '1px solid var(--stroke)' }}>
                                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Other ways to connect</h3>
                                <button onClick={() => { navigator.clipboard.writeText('https://gratonite.chat/invite/xK9f2mP'); addToast({ title: 'Invite Link Copied!', description: 'Share this link to invite friends to Gratonite.', variant: 'success' }); }} className="auth-button" style={{ marginTop: 0, background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: 'auto' }}>
                                    <UserPlus size={18} />
                                    Invite via Link
                                </button>
                            </div>
                        </div>
                    )}
                    </>
                    )}
                </div>

                {/* Detail Panel (slide-out) */}
                {renderDetailPanel()}
            </div>

            <style>
                {`
                    .tab-btn:hover {
                        background: var(--bg-tertiary) !important;
                    }
                    .friend-actions button:hover {
                        background: var(--stroke) !important;
                    }
                    @keyframes slideInRight {
                        from {
                            transform: translateX(100%);
                            opacity: 0;
                        }
                        to {
                            transform: translateX(0);
                            opacity: 1;
                        }
                    }
                `}
            </style>
        </div>
    );
};

export default Friends;
