import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { getSocket } from '../../lib/socket';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '../../hooks/useIsMobile';
import { Search, UserPlus, MoreVertical, MessageSquare, X, UserMinus, VolumeX, Flag, Phone, Video, User, Gamepad2, Headphones, Eye, ChevronDown, ChevronRight, FolderPlus, Pencil, Trash2, Palette } from 'lucide-react';
import { useToast } from '../../components/ui/ToastManager';
import { api, ApiRequestError } from '../../lib/api';
import { type ActivityEntry } from '../../utils/activity';
import ActivityCard from '../../components/ui/ActivityCard';
import Avatar from '../../components/ui/Avatar';
import { SkeletonFriendList } from '../../components/ui/SkeletonLoader';
import { ErrorState } from '../../components/ui/ErrorState';
import { EmptyState } from '../../components/ui/EmptyState';
import { copyToClipboard } from '../../utils/clipboard';

const UserProfileModal = lazy(() => import('../../components/modals/UserProfileModal'));

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
        <div className="gt-social-referral" data-ui-social-referral style={{
            background: 'linear-gradient(135deg, rgba(82, 109, 245, 0.1) 0%, rgba(139, 92, 246, 0.07) 100%)',
            borderRadius: 12, padding: 20, marginBottom: 20,
            border: '1px solid rgba(82, 109, 245, 0.22)',
            position: 'relative', overflow: 'hidden',
        }}>
            <div style={{ position: 'absolute', top: -16, right: -16, width: 96, height: 96, borderRadius: '50%', background: 'rgba(82, 109, 245, 0.07)', pointerEvents: 'none' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(82, 109, 245, 0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <UserPlus size={18} style={{ color: 'var(--accent-primary)' }} />
                </div>
                <div>
                    <h3 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '14px', fontWeight: 700 }}>Invite Friends</h3>
                    <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '12px', lineHeight: 1.4 }}>
                        {refData.count > 0 ? `${refData.count} friend${refData.count > 1 ? 's' : ''} joined via your link` : 'Earn rewards for every friend who joins'}
                    </p>
                </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
                <input
                    readOnly
                    value={refData.referralLink}
                    style={{ flex: 1, background: 'var(--bg-elevated)', border: '1px solid rgba(82,109,245,0.2)', borderRadius: 6, padding: '7px 10px', color: 'var(--text-primary)', fontSize: 13 }}
                />
                <button
                    onClick={() => { copyToClipboard(refData.referralLink); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                    style={{ background: copied ? 'var(--success)' : 'var(--accent-primary)', color: copied ? '#fff' : '#000', border: 'none', borderRadius: 6, padding: '7px 16px', cursor: 'pointer', fontWeight: 600, fontSize: 13, transition: 'all 0.2s', flexShrink: 0 }}
                >
                    {copied ? '✓ Copied!' : 'Copy'}
                </button>
            </div>
        </div>
    );
}

type FriendStatus = 'online' | 'idle' | 'dnd' | 'offline';

interface FriendGroupData { id: string; name: string; color: string; position: number; friendIds: string[] }

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
    const isMobile = useIsMobile();
    const [activeTab, setActiveTab] = useState<'online' | 'all' | 'pending' | 'activity' | 'add'>('online');
    const [searchQuery, setSearchQuery] = useState('');
    const [moreMenuId, setMoreMenuId] = useState<string | null>(null);
    const [addFriendInput, setAddFriendInput] = useState('');
    const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
    const [profileUser, setProfileUser] = useState<Friend | null>(null);
    const detailPanelRef = useRef<HTMLDivElement>(null);

    // Real data from API
    const [friends, setFriends] = useState<Friend[]>([]);
    const [requests, setRequests] = useState<{ id: string; username: string; displayName: string; type: string; avatar: string; avatarHash?: string; nameplateStyle?: string }[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [fetchError, setFetchError] = useState(false);

    // Friend groups
    const [friendGroups, setFriendGroups] = useState<FriendGroupData[]>([]);
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
        try { const saved = localStorage.getItem('gratonite:friend-groups-collapsed'); return saved ? JSON.parse(saved) : {}; } catch { return {}; }
    });
    const [groupContextMenu, setGroupContextMenu] = useState<{ groupId: string; x: number; y: number } | null>(null);
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
    const [editingGroupName, setEditingGroupName] = useState('');
    const [draggedFriendId, setDraggedFriendId] = useState<string | null>(null);
    const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');

    const GROUP_COLORS = ['#526df5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

    const fetchGroups = useCallback(async () => {
        try {
            const groups = await api.relationships.getGroups();
            setFriendGroups(groups);
        } catch { /* ignore */ }
    }, []);

    useEffect(() => { fetchGroups(); }, [fetchGroups]);

    const toggleGroupCollapse = (groupId: string) => {
        setCollapsedGroups(prev => {
            const next = { ...prev, [groupId]: !prev[groupId] };
            localStorage.setItem('gratonite:friend-groups-collapsed', JSON.stringify(next));
            return next;
        });
    };

    const handleCreateGroup = async () => {
        const name = newGroupName.trim();
        if (!name) return;
        try {
            const group = await api.relationships.createGroup(name);
            setFriendGroups(prev => [...prev, group]);
            setNewGroupName('');
            setShowCreateGroup(false);
            addToast({ title: 'Group created', description: `"${name}" group created`, variant: 'success' });
        } catch {
            addToast({ title: 'Failed to create group', variant: 'error' });
        }
    };

    const handleRenameGroup = async (groupId: string) => {
        const name = editingGroupName.trim();
        if (!name) { setEditingGroupId(null); return; }
        try {
            await api.relationships.updateGroup(groupId, { name });
            setFriendGroups(prev => prev.map(g => g.id === groupId ? { ...g, name } : g));
            setEditingGroupId(null);
        } catch {
            addToast({ title: 'Failed to rename group', variant: 'error' });
        }
    };

    const handleDeleteGroup = async (groupId: string) => {
        try {
            await api.relationships.deleteGroup(groupId);
            setFriendGroups(prev => prev.filter(g => g.id !== groupId));
            addToast({ title: 'Group deleted', variant: 'info' });
        } catch {
            addToast({ title: 'Failed to delete group', variant: 'error' });
        }
    };

    const handleChangeGroupColor = async (groupId: string, color: string) => {
        try {
            await api.relationships.updateGroup(groupId, { color });
            setFriendGroups(prev => prev.map(g => g.id === groupId ? { ...g, color } : g));
        } catch { /* ignore */ }
    };

    const handleDropFriendOnGroup = async (friendId: string, targetGroupId: string) => {
        // Remove from old group(s) first, await all before adding
        await Promise.all(
            friendGroups
                .filter(g => g.friendIds.includes(friendId))
                .map(g => api.relationships.removeFromGroup(g.id, friendId).catch(() => {}))
        );
        // Add to new group
        if (targetGroupId !== '__ungrouped__') {
            await api.relationships.addToGroup(targetGroupId, friendId).catch(() => {});
        }
        // Update local state optimistically
        setFriendGroups(prev => prev.map(g => {
            const without = g.friendIds.filter(id => id !== friendId);
            if (g.id === targetGroupId) return { ...g, friendIds: [...without, friendId] };
            return { ...g, friendIds: without };
        }));
        setDraggedFriendId(null);
        setDragOverGroupId(null);
    };

    // Close group context menu on click outside
    useEffect(() => {
        if (!groupContextMenu) return;
        const handler = () => setGroupContextMenu(null);
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, [groupContextMenu]);

    // Friend suggestions
    const [suggestions, setSuggestions] = useState<{ id: string; username: string; display_name: string; avatar_hash: string | null; sharedServers: number; mutualFriends: number }[]>([]);
    const [suggestionsLoading, setSuggestionsLoading] = useState(false);
    useEffect(() => {
        setSuggestionsLoading(true);
        api.get<any[]>('/friend-suggestions').then(data => {
            if (Array.isArray(data)) setSuggestions(data);
        }).catch(() => {}).finally(() => setSuggestionsLoading(false));
    }, []);

    const fetchRelationships = useCallback(async () => {
        setFetchError(false);
        try {
            const rels = await api.relationships.getAll();
            const friendList: Friend[] = [];
            const requestList: typeof requests = [];
            for (const rel of rels) {
                const user = (rel as any).user || {};
                const name = user.displayName || user.username || 'Unknown User';
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
            if (err instanceof ApiRequestError) {
                if (err.code === 'CONFLICT') {
                    const msg = err.message.includes('already friends')
                        ? 'You are already friends with this user.'
                        : 'A friend request is already pending.';
                    addToast({ title: 'Already connected', description: msg, variant: 'info' });
                } else {
                    addToast({ title: 'Failed', description: err.message || 'Could not send friend request.', variant: 'error' });
                }
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
        // Optimistically remove from UI with undo option
        setSelectedFriend(null);
        fetchRelationships(); // will re-render without the removed friend after API call
        addToast({
            title: `${displayName} removed from friends`,
            variant: 'undo' as const,
            onUndo: () => { fetchRelationships(); },
            onExpire: () => {
                api.relationships.removeFriend(userId).catch(() => {
                    fetchRelationships();
                    addToast({ title: 'Failed to remove friend', variant: 'error' });
                });
            },
        });
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

    const normalizedSearchQuery = searchQuery.trim().toLowerCase();
    const matchesFriendSearch = (username: string, displayName: string) =>
        !normalizedSearchQuery ||
        username.toLowerCase().includes(normalizedSearchQuery) ||
        displayName.toLowerCase().includes(normalizedSearchQuery);

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
                className="gt-social-detail-panel"
                data-ui-profile-card
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
                        className="hover-bg-tertiary-text-primary"
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
                        className="friend-action-btn"
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
                        className="friend-action-btn"
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
                        className="friend-action-btn"
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
                            setProfileUser(selectedFriend);
                        }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '10px 12px', borderRadius: '6px',
                            background: 'transparent', border: 'none',
                            color: 'var(--text-secondary)', cursor: 'pointer',
                            transition: 'all 0.15s', fontSize: '14px', fontWeight: 500,
                            width: '100%', textAlign: 'left',
                        }}
                        className="hover-bg-tertiary-text-primary"
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
                        className="hover-bg-tertiary-text-primary"
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
                        className="hover-bg-tertiary"
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
                    className="gt-friend-row friend-row hover-bg-tertiary"
                    data-ui-friend-row
                    onClick={(e) => handleFriendRowClick(friend, e)}
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 16px', borderRadius: '8px', cursor: 'pointer',
                        transition: 'background 0.15s',
                        background: selectedFriend?.id === friend.id ? 'var(--bg-tertiary)' : 'transparent',
                        borderLeft: selectedFriend?.id === friend.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
                        paddingLeft: '14px',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '14px', minWidth: 0, flex: 1 }}>
                        <Avatar
                            userId={friend.id}
                            displayName={friend.displayName}
                            size={isMobile ? 36 : 40}
                            status={friend.status}
                            statusRingColor={selectedFriend?.id === friend.id ? 'var(--bg-tertiary)' : 'var(--bg-primary)'}
                            avatarHash={friend.avatarHash}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', minWidth: 0 }}>
                                <span style={{ fontWeight: 600, fontSize: isMobile ? '14px' : '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{friend.displayName}</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 1 }}>{friend.username}</span>
                            </div>
                            <span style={{
                                color: friend.customStatus ? 'var(--text-secondary)' :
                                    friend.status === 'online' ? 'var(--success)' :
                                    friend.status === 'idle' ? '#F59E0B' :
                                    friend.status === 'dnd' ? 'var(--error)' :
                                    'var(--text-muted)',
                                fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                            }}>
                                {friend.customStatus || (friend.status === 'dnd' ? 'Do Not Disturb' : friend.status.charAt(0).toUpperCase() + friend.status.slice(1))}
                            </span>
                            {friend.activity && (
                                <ActivityCard activity={friend.activity} compact />
                            )}
                        </div>
                    </div>

                    <div className="friend-actions" style={{ display: 'flex', gap: isMobile ? '4px' : '6px', position: 'relative', flexShrink: 0 }}>
                        <button onClick={() => handleOpenDm(friend.id, friend.displayName)} className="gt-friend-action fa-btn" title="Message">
                            <MessageSquare size={isMobile ? 16 : 17} />
                        </button>
                        {!isMobile && (
                            <>
                                <button
                                    onClick={async () => {
                                        try {
                                            const dm = await api.relationships.openDm(friend.id);
                                            navigate(`/dm/${dm.id}?call=voice`);
                                        } catch {
                                            addToast({ title: 'Failed to start call', variant: 'error' });
                                        }
                                    }}
                                    className="gt-friend-action fa-btn"
                                    title="Voice Call"
                                >
                                    <Phone size={17} />
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
                                    className="gt-friend-action fa-btn"
                                    title="Video Call"
                                >
                                    <Video size={17} />
                                </button>
                            </>
                        )}
                        <button
                            onClick={() => setMoreMenuId(moreMenuId === friend.id ? null : friend.id)}
                            className="gt-friend-action fa-btn"
                            style={{ background: moreMenuId === friend.id ? 'var(--accent-primary)' : undefined, color: moreMenuId === friend.id ? '#000' : undefined }}
                            title="More"
                        >
                            <MoreVertical size={isMobile ? 16 : 17} />
                        </button>
                        {moreMenuId === friend.id && (
                            <div style={{ position: 'absolute', top: '42px', right: 0, background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '10px', padding: '4px', minWidth: '160px', zIndex: 50, boxShadow: '0 12px 32px rgba(0,0,0,0.5)' }}>
                                <div onClick={() => { setMoreMenuId(null); handleRemoveFriend(friend.id, friend.displayName); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)', transition: 'background 0.15s' }} className="hover-bg-tertiary">
                                    <UserMinus size={14} /> Remove Friend
                                </div>
                                <div onClick={() => { setMoreMenuId(null); addToast({ title: 'User Muted', description: `${friend.displayName} has been muted.`, variant: 'info' }); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)', transition: 'background 0.15s' }} className="hover-bg-tertiary">
                                    <VolumeX size={14} /> Mute
                                </div>
                                <div onClick={() => { setMoreMenuId(null); addToast({ title: 'User Reported', description: `Report filed for ${friend.displayName}.`, variant: 'info' }); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: 'var(--error)', transition: 'background 0.15s' }} className="hover-bg-tertiary">
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
        <div className="gt-social-surface" data-ui-social-surface style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', height: '100%' }}>
            {/* Header */}
            <header className="gt-social-header" data-ui-social-header style={{ height: '60px', borderBottom: '1px solid var(--stroke)', display: 'flex', alignItems: 'stretch', padding: isMobile ? '0 12px' : '0 24px', gap: isMobile ? '8px' : '20px' }}>
                {!isMobile && (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontWeight: 700, fontSize: '15px', flexShrink: 0 }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-primary)' }}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                            <span>Friends</span>
                        </div>
                        <div style={{ width: '1px', background: 'var(--stroke)', alignSelf: 'center', height: '24px' }} />
                    </>
                )}

                <div className="gt-social-tabs" data-ui-social-tabs style={{ display: 'flex', gap: isMobile ? '0' : '2px', overflowX: isMobile ? 'auto' : undefined, scrollbarWidth: 'none', flex: isMobile ? 1 : undefined, alignItems: 'stretch' } as React.CSSProperties}>
                    <button className={`ft-tab${activeTab === 'online' ? ' ft-tab--active' : ''}`} onClick={() => setActiveTab('online')}>Online</button>
                    <button className={`ft-tab${activeTab === 'all' ? ' ft-tab--active' : ''}`} onClick={() => setActiveTab('all')}>All</button>
                    <button className={`ft-tab${activeTab === 'pending' ? ' ft-tab--active' : ''}`} onClick={() => setActiveTab('pending')}>
                        Pending
                        {requests.length > 0 && <span style={{ background: 'var(--error)', color: 'white', padding: '1px 6px', borderRadius: '10px', fontSize: '11px', fontWeight: 700, lineHeight: '16px' }}>{requests.length}</span>}
                    </button>
                    <button className={`ft-tab${activeTab === 'activity' ? ' ft-tab--active' : ''}`} onClick={() => setActiveTab('activity')}>Activity</button>
                    <button
                        className={`ft-tab-add${activeTab === 'add' ? ' ft-tab-add--active' : ''}`}
                        onClick={() => setActiveTab('add')}
                        style={{ alignSelf: 'center', marginLeft: isMobile ? '4px' : '8px' }}
                    >
                        + Add Friend
                    </button>
                </div>
            </header>

            {/* Main body: content + optional detail panel */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Content Area */}
                <div className="gt-social-content" data-ui-social-content style={{ flex: 1, padding: isMobile ? '16px 12px' : '24px 32px', overflowY: 'auto' }}>
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
                                className="gt-social-search auth-input"
                                data-ui-social-search
                                placeholder="Search"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{ paddingRight: '40px', margin: 0 }}
                            />
                            <Search size={18} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        </div>
                    )}

                    {activeTab === 'online' && (() => {
                        const onlineFriends = friends.filter(f => f.status !== 'offline' && matchesFriendSearch(f.username, f.displayName));
                        return (
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                    <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', fontWeight: 700 }}>Online</span>
                                    <span style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--success)', fontSize: '11px', fontWeight: 700, padding: '1px 7px', borderRadius: '10px' }}>
                                        {friends.filter(f => f.status !== 'offline').length}
                                    </span>
                                    <div style={{ flex: 1, height: '1px', background: 'var(--stroke)' }} />
                                </div>
                                {renderFriendList(onlineFriends)}
                                {onlineFriends.length === 0 && (
                                    <EmptyState
                                        type="friends"
                                        title={
                                            normalizedSearchQuery
                                                ? `No friends match “${searchQuery.trim()}”`
                                                : friends.length === 0
                                                    ? 'Build your circle'
                                                    : 'No one is online right now'
                                        }
                                        description={
                                            normalizedSearchQuery
                                                ? 'Try a different name or clear your search to see everyone in your circle.'
                                                : friends.length === 0
                                                    ? 'Add a friend by username, share your invite link, or meet people in public communities to get this list started.'
                                                    : 'Your friends will show up here when they come online. Add a few more people if you want this list to stay lively.'
                                        }
                                        actionLabel={normalizedSearchQuery ? 'Clear search' : 'Add Friend'}
                                        onAction={normalizedSearchQuery ? () => setSearchQuery('') : () => setActiveTab('add')}
                                        secondaryActionLabel={!normalizedSearchQuery ? 'Explore portals' : undefined}
                                        onSecondaryAction={!normalizedSearchQuery ? () => navigate('/discover') : undefined}
                                    />
                                )}
                            </div>
                        );
                    })()}

                    {activeTab === 'all' && (() => {
                        const allFiltered = friends.filter(f => matchesFriendSearch(f.username, f.displayName));
                        const groupedFriendIds = new Set(friendGroups.flatMap(g => g.friendIds));
                        const ungroupedFriends = allFiltered.filter(f => !groupedFriendIds.has(f.id));

                        const renderDraggableFriendList = (friendList: Friend[], groupId?: string) => (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                {friendList.map(friend => (
                                    <div
                                        key={friend.id}
                                        draggable
                                        onDragStart={() => setDraggedFriendId(friend.id)}
                                        onDragEnd={() => { setDraggedFriendId(null); setDragOverGroupId(null); }}
                                        className="gt-friend-row friend-row hover-bg-tertiary"
                                        data-ui-friend-row
                                        onClick={(e) => handleFriendRowClick(friend, e)}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: '10px 14px', borderRadius: '8px', cursor: 'grab',
                                            transition: 'background 0.15s',
                                            borderLeft: selectedFriend?.id === friend.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
                                            background: selectedFriend?.id === friend.id ? 'var(--bg-tertiary)' : draggedFriendId === friend.id ? 'var(--bg-elevated)' : 'transparent',
                                            opacity: draggedFriendId === friend.id ? 0.5 : 1,
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '14px', minWidth: 0, flex: 1 }}>
                                            <Avatar userId={friend.id} displayName={friend.displayName} size={isMobile ? 36 : 40} status={friend.status} statusRingColor={selectedFriend?.id === friend.id ? 'var(--bg-tertiary)' : 'var(--bg-primary)'} avatarHash={friend.avatarHash} />
                                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', minWidth: 0 }}>
                                                    <span style={{ fontWeight: 600, fontSize: isMobile ? '14px' : '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{friend.displayName}</span>
                                                    <span style={{ color: 'var(--text-muted)', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 1 }}>{friend.username}</span>
                                                </div>
                                                <span style={{
                                                    color: friend.customStatus ? 'var(--text-secondary)' :
                                                        friend.status === 'online' ? 'var(--success)' :
                                                        friend.status === 'idle' ? '#F59E0B' :
                                                        friend.status === 'dnd' ? 'var(--error)' :
                                                        'var(--text-muted)',
                                                    fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                                }}>
                                                    {friend.customStatus || (friend.status === 'dnd' ? 'Do Not Disturb' : friend.status.charAt(0).toUpperCase() + friend.status.slice(1))}
                                                </span>
                                                {friend.activity && <ActivityCard activity={friend.activity} compact />}
                                            </div>
                                        </div>
                                        <div className="friend-actions" style={{ display: 'flex', gap: isMobile ? '4px' : '6px', position: 'relative', flexShrink: 0 }}>
                                            <button onClick={() => handleOpenDm(friend.id, friend.displayName)} className="gt-friend-action fa-btn" title="Message">
                                                <MessageSquare size={isMobile ? 16 : 17} />
                                            </button>
                                            <button
                                                onClick={() => setMoreMenuId(moreMenuId === friend.id ? null : friend.id)}
                                                className="gt-friend-action fa-btn"
                                                style={{ background: moreMenuId === friend.id ? 'var(--accent-primary)' : undefined, color: moreMenuId === friend.id ? '#000' : undefined }}
                                                title="More"
                                            >
                                                <MoreVertical size={isMobile ? 16 : 17} />
                                            </button>
                                            {moreMenuId === friend.id && (
                                                <div style={{ position: 'absolute', top: '42px', right: 0, background: 'var(--bg-elevated)', border: '1px solid var(--stroke)', borderRadius: '10px', padding: '4px', minWidth: '180px', zIndex: 50, boxShadow: '0 12px 32px rgba(0,0,0,0.5)' }}>
                                                    {/* Move to group options */}
                                                    {friendGroups.length > 0 && (
                                                        <>
                                                            <div style={{ padding: '4px 12px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Move to group</div>
                                                            {friendGroups.map(g => (
                                                                <div key={g.id} onClick={() => { setMoreMenuId(null); handleDropFriendOnGroup(friend.id, g.id); }}
                                                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)', transition: 'background 0.15s' }}
                                                                    className="hover-bg-tertiary">
                                                                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: g.color }} /> {g.name}
                                                                    {g.friendIds.includes(friend.id) && <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-muted)' }}>current</span>}
                                                                </div>
                                                            ))}
                                                            {groupedFriendIds.has(friend.id) && (
                                                                <div onClick={() => { setMoreMenuId(null); handleDropFriendOnGroup(friend.id, '__ungrouped__'); }}
                                                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)', transition: 'background 0.15s' }}
                                                                    className="hover-bg-tertiary">
                                                                    <X size={12} /> Remove from group
                                                                </div>
                                                            )}
                                                            <div style={{ height: '1px', background: 'var(--stroke)', margin: '4px 0' }} />
                                                        </>
                                                    )}
                                                    <div onClick={() => { setMoreMenuId(null); handleRemoveFriend(friend.id, friend.displayName); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)', transition: 'background 0.15s' }} className="hover-bg-tertiary">
                                                        <UserMinus size={14} /> Remove Friend
                                                    </div>
                                                    <div onClick={() => { setMoreMenuId(null); addToast({ title: 'User Muted', description: `${friend.displayName} has been muted.`, variant: 'info' }); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)', transition: 'background 0.15s' }} className="hover-bg-tertiary">
                                                        <VolumeX size={14} /> Mute
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );

                        return (
                            <div>
                                {/* Create Group button */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', fontWeight: 700 }}>All Friends</span>
                                        <span style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 700, padding: '1px 7px', borderRadius: '10px', border: '1px solid var(--stroke)' }}>
                                            {friends.length}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => setShowCreateGroup(true)}
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, padding: '4px 8px', borderRadius: '4px', transition: 'all 0.15s' }}
                                        className="hover-bg-tertiary-text-primary"
                                    >
                                        <FolderPlus size={14} /> New Group
                                    </button>
                                </div>

                                {/* Create group inline form */}
                                {showCreateGroup && (
                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--stroke)' }}>
                                        <input
                                            autoFocus
                                            type="text"
                                            className="chat-input"
                                            placeholder="Group name..."
                                            value={newGroupName}
                                            onChange={e => setNewGroupName(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') handleCreateGroup(); if (e.key === 'Escape') { setShowCreateGroup(false); setNewGroupName(''); } }}
                                            style={{ flex: 1, padding: '8px 12px', fontSize: '14px', background: 'var(--bg-primary)' }}
                                            maxLength={100}
                                        />
                                        <button onClick={handleCreateGroup} style={{ background: 'var(--accent-primary)', color: '#000', border: 'none', borderRadius: '6px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Create</button>
                                        <button onClick={() => { setShowCreateGroup(false); setNewGroupName(''); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={18} /></button>
                                    </div>
                                )}

                                {/* Friend groups */}
                                {friendGroups.map(group => {
                                    const groupFriends = allFiltered.filter(f => group.friendIds.includes(f.id));
                                    const isCollapsed = collapsedGroups[group.id];
                                    const isDragOver = dragOverGroupId === group.id && draggedFriendId;

                                    return (
                                        <div key={group.id} style={{ marginBottom: '8px' }}>
                                            {/* Group header */}
                                            <div
                                                onContextMenu={e => { e.preventDefault(); setGroupContextMenu({ groupId: group.id, x: e.clientX, y: e.clientY }); }}
                                                onDragOver={e => { e.preventDefault(); setDragOverGroupId(group.id); }}
                                                onDragLeave={() => { if (dragOverGroupId === group.id) setDragOverGroupId(null); }}
                                                onDrop={e => { e.preventDefault(); if (draggedFriendId) handleDropFriendOnGroup(draggedFriendId, group.id); }}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 8px',
                                                    cursor: 'pointer', borderRadius: '6px', userSelect: 'none',
                                                    transition: 'background 0.15s',
                                                    background: isDragOver ? 'rgba(82,109,245,0.15)' : 'transparent',
                                                    border: isDragOver ? '1px dashed var(--accent-primary)' : '1px solid transparent',
                                                }}
                                                onClick={() => toggleGroupCollapse(group.id)}
                                                className="hover-bg-tertiary"
                                            >
                                                {isCollapsed ? <ChevronRight size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />}
                                                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: group.color, flexShrink: 0 }} />
                                                {editingGroupId === group.id ? (
                                                    <input
                                                        autoFocus
                                                        type="text"
                                                        className="chat-input"
                                                        value={editingGroupName}
                                                        onChange={e => setEditingGroupName(e.target.value)}
                                                        onKeyDown={e => { if (e.key === 'Enter') handleRenameGroup(group.id); if (e.key === 'Escape') setEditingGroupId(null); }}
                                                        onBlur={() => handleRenameGroup(group.id)}
                                                        onClick={e => e.stopPropagation()}
                                                        style={{ padding: '2px 8px', fontSize: '12px', background: 'var(--bg-primary)', flex: 1 }}
                                                        maxLength={100}
                                                    />
                                                ) : (
                                                    <span style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.5px' }}>
                                                        {group.name} — {groupFriends.length}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Group context menu */}
                                            {groupContextMenu?.groupId === group.id && (
                                                <div style={{
                                                    position: 'fixed', top: groupContextMenu.y, left: groupContextMenu.x,
                                                    background: 'var(--bg-elevated)', border: '1px solid var(--stroke)',
                                                    borderRadius: '10px', padding: '4px', minWidth: '180px', zIndex: 100,
                                                    boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
                                                }}>
                                                    <div onClick={() => { setGroupContextMenu(null); setEditingGroupId(group.id); setEditingGroupName(group.name); }}
                                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)' }}
                                                        className="hover-bg-tertiary">
                                                        <Pencil size={14} /> Rename
                                                    </div>
                                                    {/* Color picker */}
                                                    <div style={{ padding: '8px 12px' }}>
                                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase' }}>Color</div>
                                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                            {GROUP_COLORS.map(c => (
                                                                <button key={c} onClick={() => { setGroupContextMenu(null); handleChangeGroupColor(group.id, c); }}
                                                                    style={{ width: '22px', height: '22px', borderRadius: '50%', background: c, border: group.color === c ? '2px solid white' : '2px solid transparent', cursor: 'pointer', transition: 'border-color 0.15s' }} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div style={{ height: '1px', background: 'var(--stroke)', margin: '4px 0' }} />
                                                    <div onClick={() => { setGroupContextMenu(null); handleDeleteGroup(group.id); }}
                                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', color: 'var(--error)' }}
                                                        className="hover-bg-tertiary">
                                                        <Trash2 size={14} /> Delete Group
                                                    </div>
                                                </div>
                                            )}

                                            {/* Group members */}
                                            {!isCollapsed && groupFriends.length > 0 && (
                                                <div style={{ paddingLeft: '12px' }}>
                                                    {renderDraggableFriendList(groupFriends, group.id)}
                                                </div>
                                            )}
                                            {!isCollapsed && groupFriends.length === 0 && (
                                                <div
                                                    onDragOver={e => { e.preventDefault(); setDragOverGroupId(group.id); }}
                                                    onDragLeave={() => setDragOverGroupId(null)}
                                                    onDrop={e => { e.preventDefault(); if (draggedFriendId) handleDropFriendOnGroup(draggedFriendId, group.id); }}
                                                    style={{
                                                        padding: '16px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)',
                                                        border: isDragOver ? '1px dashed var(--accent-primary)' : '1px dashed var(--stroke)',
                                                        borderRadius: '8px', margin: '8px 0 8px 12px',
                                                        background: isDragOver ? 'rgba(82,109,245,0.08)' : 'transparent',
                                                        transition: 'all 0.15s',
                                                    }}
                                                >
                                                    Drag friends here
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {/* Ungrouped friends */}
                                {ungroupedFriends.length > 0 && (
                                    <div
                                        onDragOver={e => { e.preventDefault(); setDragOverGroupId('__ungrouped__'); }}
                                        onDragLeave={() => { if (dragOverGroupId === '__ungrouped__') setDragOverGroupId(null); }}
                                        onDrop={e => { e.preventDefault(); if (draggedFriendId) handleDropFriendOnGroup(draggedFriendId, '__ungrouped__'); }}
                                        style={{ marginTop: friendGroups.length > 0 ? '8px' : 0 }}
                                    >
                                        {friendGroups.length > 0 && (
                                            <h3 style={{
                                                fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)',
                                                fontWeight: 600, marginBottom: '8px', padding: '8px 8px',
                                                borderBottom: '1px solid var(--stroke)',
                                                background: dragOverGroupId === '__ungrouped__' ? 'rgba(82,109,245,0.08)' : 'transparent',
                                                borderRadius: dragOverGroupId === '__ungrouped__' ? '6px' : 0,
                                                transition: 'background 0.15s',
                                            }}>
                                                Ungrouped — {ungroupedFriends.length}
                                            </h3>
                                        )}
                                        {renderDraggableFriendList(ungroupedFriends)}
                                    </div>
                                )}

                                {/* Suggested Friends */}
                                {suggestions.length > 0 && (
                                    <div style={{ marginTop: '32px' }}>
                                        <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '16px', borderBottom: '1px solid var(--stroke)', paddingBottom: '8px' }}>
                                            Suggested Friends — {suggestions.length}
                                        </h3>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                                            {suggestions.map(s => (
                                                <div key={s.id} style={{
                                                    background: 'var(--bg-tertiary)', borderRadius: '12px', padding: '16px',
                                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                                                    border: '1px solid var(--stroke)', transition: 'border-color 0.2s',
                                                }} className="hover-border-accent">
                                                    <Avatar userId={s.id} avatarHash={s.avatar_hash} displayName={s.display_name || s.username} size={48} />
                                                    <div style={{ textAlign: 'center' }}>
                                                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{s.display_name || s.username}</div>
                                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                            {s.sharedServers > 0 && `${s.sharedServers} shared communit${s.sharedServers > 1 ? 'ies' : 'y'}`}
                                                            {s.sharedServers > 0 && s.mutualFriends > 0 && ' · '}
                                                            {s.mutualFriends > 0 && `${s.mutualFriends} mutual friend${s.mutualFriends > 1 ? 's' : ''}`}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={async () => {
                                                            try {
                                                                await api.relationships.sendFriendRequest(s.id);
                                                                addToast({ title: 'Friend request sent!', variant: 'success' });
                                                                setSuggestions(prev => prev.filter(x => x.id !== s.id));
                                                            } catch (err) {
                                                                addToast({ title: err instanceof ApiRequestError ? err.message : 'Failed to send request', variant: 'error' });
                                                            }
                                                        }}
                                                        style={{
                                                            background: 'var(--accent-primary)', color: '#000', border: 'none',
                                                            borderRadius: '6px', padding: '6px 16px', fontSize: '13px',
                                                            fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                                                        }}
                                                    >
                                                        <UserPlus size={14} /> Add Friend
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {allFiltered.length === 0 && (
                                    <EmptyState
                                        type="friends"
                                        title={normalizedSearchQuery ? `No friends match “${searchQuery.trim()}”` : 'No friends yet'}
                                        description={
                                            normalizedSearchQuery
                                                ? 'Try a different name or clear your search to see the rest of your list.'
                                                : 'Add people by username, share your invite link, or start with the suggestions above to build your circle.'
                                        }
                                        actionLabel={normalizedSearchQuery ? 'Clear search' : 'Add Friend'}
                                        onAction={normalizedSearchQuery ? () => setSearchQuery('') : () => setActiveTab('add')}
                                        secondaryActionLabel={!normalizedSearchQuery ? 'Explore portals' : undefined}
                                        onSecondaryAction={!normalizedSearchQuery ? () => navigate('/discover') : undefined}
                                    />
                                )}
                            </div>
                        );
                    })()}

                    {activeTab === 'pending' && (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', fontWeight: 700 }}>Pending</span>
                                {requests.length > 0 && (
                                    <span style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--error)', fontSize: '11px', fontWeight: 700, padding: '1px 7px', borderRadius: '10px' }}>
                                        {requests.length}
                                    </span>
                                )}
                                <div style={{ flex: 1, height: '1px', background: 'var(--stroke)' }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                {requests.filter(r => matchesFriendSearch(r.username, r.displayName)).map(req => (
                                    <div
                                        key={req.id}
                                        className="gt-friend-row friend-row hover-bg-tertiary"
                                        data-ui-friend-row
                                        style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '10px 16px', borderRadius: '8px', cursor: 'pointer',
                                        transition: 'background 0.15s',
                                        borderLeft: req.type === 'incoming' ? '2px solid var(--success)' : '2px solid rgba(82,109,245,0.4)',
                                        paddingLeft: '14px',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '16px', minWidth: 0, flex: 1 }}>
                                            <Avatar
                                                userId={req.id}
                                                displayName={req.displayName}
                                                avatarHash={req.avatarHash}
                                                size={isMobile ? 36 : 40}
                                            />
                                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', minWidth: 0 }}>
                                                    <span className={req.nameplateStyle && req.nameplateStyle !== 'none' ? `nameplate-${req.nameplateStyle}` : undefined} style={{ fontWeight: 600, fontSize: isMobile ? '14px' : '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{req.displayName}</span>
                                                    <span style={{ color: 'var(--text-muted)', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 1 }}>{req.username}</span>
                                                </div>
                                                <span style={{
                                                    color: req.type === 'incoming' ? 'var(--success)' : 'var(--accent-primary)',
                                                    fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                    fontWeight: 500,
                                                }}>
                                                    {req.type === 'incoming' ? '↙ Incoming Request' : '↗ Outgoing Request'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="friend-actions" style={{ display: 'flex', gap: isMobile ? '4px' : '6px', flexShrink: 0 }}>
                                            {req.type === 'incoming' && (
                                                <button onClick={() => handleAcceptRequest(req.id, req.displayName)} className="gt-friend-action fa-btn" style={{ color: 'var(--success)' }} title="Accept">
                                                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
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
                                            }} className="gt-friend-action fa-btn" style={{ color: 'var(--error)' }} title={req.type === 'incoming' ? 'Decline' : 'Cancel'}>
                                                <X size={17} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {requests.filter(r => matchesFriendSearch(r.username, r.displayName)).length === 0 && (
                                    <EmptyState
                                        type="friends"
                                        title={normalizedSearchQuery ? `No requests match “${searchQuery.trim()}”` : 'No pending requests'}
                                        description={
                                            normalizedSearchQuery
                                                ? 'Clear your search to review every incoming or outgoing request.'
                                                : 'Nothing is waiting on you right now. Send a fresh invite or come back later for replies.'
                                        }
                                        actionLabel={normalizedSearchQuery ? 'Clear search' : 'Add Friend'}
                                        onAction={normalizedSearchQuery ? () => setSearchQuery('') : () => setActiveTab('add')}
                                        secondaryActionLabel={!normalizedSearchQuery ? 'Explore portals' : undefined}
                                        onSecondaryAction={!normalizedSearchQuery ? () => navigate('/discover') : undefined}
                                    />
                                )}
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
                                    <EmptyState
                                        type="friends"
                                        title={friends.length === 0 ? 'Friend activity starts after you connect' : 'No friends are active right now'}
                                        description={
                                            friends.length === 0
                                                ? 'Add a few people first, then their games, music, and other live activity will appear here automatically.'
                                                : 'When your friends start an activity, it will show up here. Invite a few more people in if you want this feed to stay useful.'
                                        }
                                        actionLabel={friends.length === 0 ? 'Add Friend' : undefined}
                                        onAction={friends.length === 0 ? () => setActiveTab('add') : undefined}
                                        secondaryActionLabel={friends.length === 0 ? 'View requests' : 'Add Friend'}
                                        onSecondaryAction={friends.length === 0 ? () => setActiveTab('pending') : () => setActiveTab('add')}
                                    />
                                )}
                            </div>
                        );
                    })()}

                    {activeTab === 'add' && (
                        <div style={{ maxWidth: '640px', margin: '0 auto', marginTop: isMobile ? '16px' : '32px' }}>
                            {/* Hero card */}
                            <div className="gt-add-friend-card" data-ui-add-friend-card style={{
                                background: 'linear-gradient(135deg, rgba(82,109,245,0.12) 0%, rgba(139,92,246,0.08) 100%)',
                                borderRadius: 16, padding: isMobile ? '28px 20px' : '40px 48px',
                                border: '1px solid rgba(82,109,245,0.2)',
                                marginBottom: '32px', textAlign: 'center',
                                position: 'relative', overflow: 'hidden',
                            }}>
                                <div style={{ position: 'absolute', top: -20, right: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(82,109,245,0.07)', pointerEvents: 'none' }} />
                                <div style={{ position: 'absolute', bottom: -10, left: -10, width: 80, height: 80, borderRadius: '50%', background: 'rgba(139,92,246,0.05)', pointerEvents: 'none' }} />
                                <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(82,109,245,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                    <UserPlus size={28} style={{ color: 'var(--accent-primary)' }} />
                                </div>
                                <h2 style={{ fontSize: isMobile ? '20px' : '22px', fontWeight: 700, margin: '0 0 8px', color: 'var(--text-primary)' }}>Find your people</h2>
                                <p style={{ color: 'var(--text-secondary)', margin: '0 0 24px', fontSize: '14px', lineHeight: 1.5 }}>Add a friend by their Gratonite username to start chatting.</p>

                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                    <input
                                        type="text"
                                        className="gt-add-friend-input auth-input"
                                        data-ui-add-friend-input
                                        placeholder="Enter a username..."
                                        value={addFriendInput}
                                        onChange={(e) => setAddFriendInput(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' && addFriendInput.length > 0) handleAddFriend(); }}
                                        style={{ margin: 0, paddingRight: '150px', background: 'var(--bg-elevated)', border: '1px solid rgba(82,109,245,0.25)', height: '52px', fontSize: '15px' }}
                                    />
                                    <button
                                        className="gt-add-friend-submit"
                                        data-ui-add-friend-submit
                                        onClick={() => { if (addFriendInput.length > 0) { handleAddFriend(); } }}
                                        style={{
                                            position: 'absolute', right: '8px',
                                            background: addFriendInput.length > 0 ? 'var(--accent-primary)' : 'rgba(82,109,245,0.3)',
                                            border: 'none', padding: '8px 18px', borderRadius: '6px',
                                            color: addFriendInput.length > 0 ? '#000' : 'var(--text-muted)',
                                            fontWeight: 600, cursor: addFriendInput.length > 0 ? 'pointer' : 'default',
                                            transition: 'all 0.2s', fontSize: '13px', whiteSpace: 'nowrap',
                                        }}
                                    >
                                        Send Request
                                    </button>
                                </div>
                            </div>

                            <div style={{ paddingTop: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                    <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', fontWeight: 700 }}>Other ways to connect</span>
                                    <div style={{ flex: 1, height: '1px', background: 'var(--stroke)' }} />
                                </div>
                                <button
                                    onClick={() => { copyToClipboard(window.location.origin); addToast({ title: 'Invite Link Copied!', description: 'Share this link to invite friends to Gratonite.', variant: 'success' }); }}
                                    style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--stroke)', borderRadius: '10px', padding: '12px 20px', cursor: 'pointer', color: 'var(--text-primary)', fontWeight: 600, fontSize: '14px', transition: 'all 0.15s', width: '100%' }}
                                    className="hover-bg-elevated"
                                >
                                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(82,109,245,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <UserPlus size={16} style={{ color: 'var(--accent-primary)' }} />
                                    </div>
                                    Copy Invite Link
                                    <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 400 }}>gratonite.chat</span>
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
                    /* ── Tab bar ── */
                    .ft-tab {
                        background: transparent;
                        border: none;
                        border-bottom: 2px solid transparent;
                        padding: 0 14px;
                        color: var(--text-muted);
                        cursor: pointer;
                        font-weight: 500;
                        font-size: 14px;
                        flex-shrink: 0;
                        transition: color 0.15s, border-color 0.15s;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        margin-bottom: -1px;
                        white-space: nowrap;
                    }
                    .ft-tab:hover { color: var(--text-secondary) !important; }
                    .ft-tab--active {
                        color: var(--text-primary) !important;
                        font-weight: 600;
                        border-bottom-color: var(--accent-primary);
                    }
                    .ft-tab-add {
                        background: var(--success);
                        border: none;
                        padding: 5px 12px;
                        border-radius: 6px;
                        color: white;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 13px;
                        flex-shrink: 0;
                        transition: all 0.15s;
                        display: flex;
                        align-items: center;
                        gap: 4px;
                        white-space: nowrap;
                    }
                    .ft-tab-add:hover {
                        background: #0d9e6e !important;
                        transform: translateY(-1px);
                        box-shadow: 0 4px 12px rgba(16,185,129,0.25);
                    }
                    .ft-tab-add--active {
                        background: rgba(16,185,129,0.15) !important;
                        color: var(--success) !important;
                        box-shadow: none !important;
                        transform: none !important;
                    }

                    /* ── Friend row action buttons ── */
                    .fa-btn {
                        width: 34px;
                        height: 34px;
                        border-radius: 50%;
                        background: var(--bg-elevated);
                        border: none;
                        color: var(--text-secondary);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        cursor: pointer;
                        transition: all 0.15s;
                        flex-shrink: 0;
                    }
                    .fa-btn:hover {
                        background: var(--bg-tertiary) !important;
                        color: var(--text-primary) !important;
                        transform: scale(1.05);
                    }

                    /* ── Friend rows: actions fade in on hover ── */
                    .friend-row .friend-actions { opacity: 0; transition: opacity 0.15s; }
                    .friend-row:hover .friend-actions { opacity: 1; }

                    /* Hover bg utility */
                    .hover-bg-elevated:hover { background: var(--bg-elevated) !important; }

                    /* ── Animations ── */
                    @keyframes slideInRight {
                        from { transform: translateX(100%); opacity: 0; }
                        to   { transform: translateX(0);    opacity: 1; }
                    }
                `}
            </style>

            {profileUser && (
                <Suspense fallback={null}>
                    <UserProfileModal
                        onClose={() => setProfileUser(null)}
                        userProfile={{
                            id: profileUser.id,
                            username: profileUser.username,
                            displayName: profileUser.displayName,
                            avatarHash: profileUser.avatarHash ?? null,
                        }}
                    />
                </Suspense>
            )}
        </div>
    );
};

export default Friends;
