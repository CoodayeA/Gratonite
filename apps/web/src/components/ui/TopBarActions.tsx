import { useState, useRef, useEffect, useCallback } from 'react';
import { Bell, Search, HelpCircle, X, Users, MessageSquare, Hash, Loader2, Trash2 } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';
import { useNavigate } from 'react-router-dom';
import { useToast } from './ToastManager';
import { api } from '../../lib/api';
import { onNotificationCreate } from '../../lib/socket';
import { clearAllUnread } from '../../store/unreadStore';
import Avatar from './Avatar';
import { buildDmRoute, buildGuildChannelRoute, normalizeLegacyRoute } from '../../lib/routes';

type SearchResult = {
    id: string;
    type: 'user' | 'message';
    title: string;
    subtitle: string;
    route: string;
    targetUserId?: string;
    avatarHash?: string | null;
};

export const TopBarActions = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [hoveredNotifId, setHoveredNotifId] = useState<number | null>(null);
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const { addToast } = useToast();
    const navigate = useNavigate();
    const popupRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const debouncedSearchQuery = useDebounce(searchQuery, 300);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setSearchOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (searchOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [searchOpen]);

    // Show loading indicator while debouncing
    useEffect(() => {
        if (searchQuery.trim() && searchQuery !== debouncedSearchQuery) setSearching(true);
    }, [searchQuery, debouncedSearchQuery]);

    // Debounced search
    useEffect(() => {
        if (!debouncedSearchQuery.trim()) {
            setSearchResults([]);
            setSearching(false);
            return;
        }

        setSearching(true);
        let cancelled = false;
        (async () => {
            const results: SearchResult[] = [];
            try {
                const [users, messages] = await Promise.all([
                    api.users.searchUsers(debouncedSearchQuery).catch(() => []),
                    api.search.messages({ query: debouncedSearchQuery, limit: 10 }).catch(() => ({ results: [] })),
                ]);

                for (const u of users.slice(0, 5)) {
                    results.push({
                        id: `user-${u.id}`,
                        type: 'user',
                        title: u.displayName || u.username,
                        subtitle: `@${u.username}`,
                        route: '',
                        targetUserId: u.id,
                        avatarHash: u.avatarHash || null,
                    });
                }

                for (const m of messages.results.slice(0, 10)) {
                    results.push({
                        id: `msg-${m.id}`,
                        type: 'message',
                        title: m.highlight || m.content.slice(0, 80),
                        subtitle: m.guildId ? `#channel` : 'DM',
                        route: m.guildId
                            ? buildGuildChannelRoute(m.guildId, m.channelId)
                            : buildDmRoute(m.channelId),
                    });
                }
            } catch {
                if (!cancelled) addToast({ title: 'Search failed', variant: 'error' });
            }
            if (!cancelled) {
                setSearchResults(results);
                setSearching(false);
            }
        })();
        return () => { cancelled = true; };
    }, [debouncedSearchQuery]);

    // Unread notification count – fetched on mount, updated via socket
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        api.notifications.list(50)
            .then(data => {
                setUnreadCount(data.filter(n => !n.read).length);
            })
            .catch(() => {});
    }, []);

    // Listen for real-time notifications via socket
    useEffect(() => {
        const unsub = onNotificationCreate(() => {
            setUnreadCount(prev => prev + 1);
        });
        return unsub;
    }, []);

    // Notifications from API (panel list)
    const [notifications, setNotifications] = useState<{ id: string; text: string; time: string; unread: boolean }[]>([]);
    useEffect(() => {
        if (!isOpen) return;
        api.notifications.list(10)
            .then(data => {
                const mapped = data.map(n => ({
                    id: n.id,
                    text: `${n.senderName || 'System'}: ${n.content}`,
                    time: formatRelative(n.createdAt),
                    unread: !n.read,
                }));
                setNotifications(mapped);
                // Sync badge count with actual server data
                setUnreadCount(data.filter(n => !n.read).length);
            })
            .catch(() => {});
    }, [isOpen]);

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginLeft: 'auto', position: 'relative' }}>
            {/* Search */}
            <div className={`input-icon-btn ${searchOpen ? 'primary' : ''}`} onClick={() => { setSearchOpen(!searchOpen); setIsOpen(false); }}>
                <Search size={20} />
            </div>

            {/* Bell */}
            <div className="input-icon-btn" style={{ position: 'relative' }} onClick={() => { setIsOpen(!isOpen); setSearchOpen(false); }}>
                <Bell size={20} />
                {unreadCount > 0 && (
                    <div style={{
                        position: 'absolute',
                        top: '-4px',
                        right: '-6px',
                        minWidth: '18px',
                        height: '18px',
                        borderRadius: '9px',
                        background: 'var(--error)',
                        border: '2px solid var(--bg-elevated)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0 4px',
                        boxSizing: 'border-box',
                    }}>
                        <span style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            color: '#fff',
                            lineHeight: 1,
                        }}>
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    </div>
                )}
            </div>

            {/* Help */}
            <div className="input-icon-btn" onClick={() => navigate('/help-center')}>
                <HelpCircle size={20} />
            </div>

            {/* Search Panel */}
            {searchOpen && (
                <div ref={searchRef} style={{
                    position: 'absolute', top: '100%', right: 0, marginTop: '12px',
                    width: '380px', background: 'var(--bg-elevated)',
                    border: '1px solid var(--stroke)', borderRadius: 'var(--radius-lg)',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.5)', zIndex: 40,
                    overflow: 'hidden', display: 'flex', flexDirection: 'column'
                }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--stroke)', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-tertiary)' }}>
                        <Search size={16} color="var(--text-muted)" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            placeholder="Search messages, users, channels..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Escape' && setSearchOpen(false)}
                            style={{
                                flex: 1, background: 'transparent', border: 'none',
                                color: 'var(--text-primary)', fontSize: '14px', outline: 'none'
                            }}
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: 0 }}>
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    <div style={{ maxHeight: '320px', overflowY: 'auto', padding: '8px' }}>
                        {searchQuery.trim() === '' ? (
                            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                                Type to search messages, users, and channels
                            </div>
                        ) : searching ? (
                            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <div style={{ width: '16px', height: '16px', border: '2px solid var(--stroke)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                                Searching...
                            </div>
                        ) : searchResults.length === 0 ? (
                            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                                No results for "{searchQuery}"
                            </div>
                        ) : (
                            searchResults.map(r => (
                                <div key={r.id} onClick={async () => {
                                    if (r.type === 'user' && r.targetUserId) {
                                        try {
                                            const dmChannel = await api.relationships.openDm(r.targetUserId) as { id: string };
                                            navigate(buildDmRoute(dmChannel.id));
                                        } catch {
                                            addToast({ title: 'Failed to open DM', variant: 'error' });
                                            return;
                                        }
                                    } else {
                                        navigate(normalizeLegacyRoute(r.route));
                                    }
                                    setSearchOpen(false);
                                    setSearchQuery('');
                                }} style={{
                                    padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
                                    transition: 'background 0.15s', display: 'flex', alignItems: 'center', gap: '12px'
                                }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                    {r.type === 'user' ? (
                                        <Avatar userId={r.targetUserId || r.id} displayName={r.title} avatarHash={r.avatarHash} size={32} />
                                    ) : (
                                        <div style={{
                                            width: '32px', height: '32px', borderRadius: '8px',
                                            background: 'var(--bg-tertiary)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: 'var(--text-muted)', fontWeight: 700, fontSize: '13px', flexShrink: 0,
                                            border: '1px solid var(--stroke)'
                                        }}>
                                            <MessageSquare size={14} />
                                        </div>
                                    )}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.subtitle}</div>
                                    </div>
                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{r.type}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Notifications Panel */}
            {isOpen && (
                <div ref={popupRef} style={{
                    position: 'absolute',
                    top: '100%',
                    right: '0',
                    marginTop: '12px',
                    width: '320px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--stroke)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: 'var(--shadow-panel)',
                    zIndex: 40,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--stroke)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-tertiary)' }}>
                        <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0, fontFamily: 'var(--font-display)' }}>Notifications</h3>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <span onClick={() => { api.notifications.markAllRead().catch(() => {}); setNotifications(prev => prev.map(n => ({ ...n, unread: false }))); setUnreadCount(0); clearAllUnread(); addToast({ title: 'All marked as read', variant: 'success' }); }} style={{ fontSize: '12px', color: 'var(--accent-blue)', cursor: 'pointer', fontWeight: 500 }}>Mark all read</span>
                            <span onClick={() => { api.notifications.clearAll().catch(() => {}); setNotifications([]); setUnreadCount(0); clearAllUnread(); addToast({ title: 'All notifications cleared', variant: 'success' }); setIsOpen(false); }} style={{ fontSize: '12px', color: 'var(--error)', cursor: 'pointer', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '3px' }}><Trash2 size={11} /> Clear all</span>
                        </div>
                    </div>

                    <div style={{ maxHeight: '300px', overflowY: 'auto', padding: '8px' }}>
                        {notifications.length === 0 ? (
                            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No notifications</div>
                        ) : notifications.map(n => (
                            <div
                                key={n.id}
                                onMouseEnter={() => setHoveredNotifId(Number(n.id) || 0)}
                                onMouseLeave={() => setHoveredNotifId(null)}
                                style={{
                                    padding: '12px',
                                    borderRadius: 'var(--radius-sm)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '4px',
                                    position: 'relative',
                                    transition: 'background 0.2s, transform 0.2s',
                                    background: n.unread ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                                }}
                                onMouseOver={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                                onMouseOut={e => (e.currentTarget.style.background = n.unread ? 'rgba(59, 130, 246, 0.05)' : 'transparent')}
                            >
                                {n.unread && <div style={{ position: 'absolute', left: '0', top: '50%', transform: 'translateY(-50%)', width: '3px', height: '16px', background: 'var(--accent-blue)', borderRadius: '0 4px 4px 0' }}></div>}
                                <div style={{ fontSize: '13px', color: n.unread ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: n.unread ? 600 : 400, marginLeft: '8px' }}>{n.text}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>{n.time}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

function formatRelative(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay === 1) return 'Yesterday';
    if (diffDay < 7) return `${diffDay} days ago`;
    return d.toLocaleDateString();
}
