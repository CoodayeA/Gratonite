import { useState, useRef, useEffect, useCallback } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Bell, Search, HelpCircle, X, Users, MessageSquare, Hash, Loader2, Trash2 } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';
import { useNavigate } from 'react-router-dom';
import { useToast } from './ToastManager';
import Skeleton from './Skeleton';
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
    const popupRef = useRef<HTMLDivElement | null>(null);
    const searchRef = useRef<HTMLDivElement | null>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const debouncedSearchQuery = useDebounce(searchQuery, 300);
    const [searchActiveIndex, setSearchActiveIndex] = useState(-1);
    const [notifActiveIndex, setNotifActiveIndex] = useState(-1);
    const notifPanelRef = useRef<HTMLDivElement | null>(null);

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
                    const msgParam = `?messageId=${m.id}`;
                    results.push({
                        id: `msg-${m.id}`,
                        type: 'message',
                        title: (m.content ?? '').trim().slice(0, 80) || '(empty message)',
                        subtitle: m.guildId ? `#channel` : 'DM',
                        route: m.guildId
                            ? buildGuildChannelRoute(m.guildId, m.channelId) + msgParam
                            : buildDmRoute(m.channelId) + msgParam,
                    });
                }
            } catch {
                if (!cancelled) addToast({ title: 'Search failed', variant: 'error' });
            }
            if (!cancelled) {
                setSearchResults(results);
                setSearchActiveIndex(results.length > 0 ? 0 : -1);
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
    const [notifications, setNotifications] = useState<{ id: string; text: string; time: string; unread: boolean; type: string; channelId: string | null; guildId: string | null; messageId: string | null }[]>([]);
    useEffect(() => {
        if (!isOpen) return;
        api.notifications.list(10)
            .then(data => {
                const mapped = data.map(n => ({
                    id: n.id,
                    text: `${n.senderName || 'System'}: ${n.content}`,
                    time: formatRelative(n.createdAt),
                    unread: !n.read,
                    type: n.type,
                    channelId: n.channelId,
                    guildId: n.guildId,
                    messageId: n.messageId,
                }));
                setNotifications(mapped);
                // Sync badge count with actual server data
                setUnreadCount(data.filter(n => !n.read).length);
            })
            .catch(() => {});
    }, [isOpen]);

    // Navigate to a search result (used by mouse and keyboard)
    const goToSearchResult = useCallback(async (r: SearchResult) => {
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
    }, [addToast, navigate]);

    const onSearchInputKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Escape') { setSearchOpen(false); return; }
        if (searchResults.length === 0) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSearchActiveIndex(i => Math.min(searchResults.length - 1, i + 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSearchActiveIndex(i => Math.max(0, i - 1));
        } else if (e.key === 'Home') {
            e.preventDefault();
            setSearchActiveIndex(0);
        } else if (e.key === 'End') {
            e.preventDefault();
            setSearchActiveIndex(searchResults.length - 1);
        } else if (e.key === 'Enter') {
            const idx = searchActiveIndex >= 0 ? searchActiveIndex : 0;
            const r = searchResults[idx];
            if (r) { e.preventDefault(); goToSearchResult(r); }
        }
    };

    // Auto-focus notifications panel when opened so arrow keys work
    useEffect(() => {
        if (isOpen) {
            setNotifActiveIndex(-1);
            setTimeout(() => notifPanelRef.current?.focus(), 0);
        }
    }, [isOpen]);

    const onNotifKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Escape') { e.preventDefault(); setIsOpen(false); return; }
        if (notifications.length === 0) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setNotifActiveIndex(i => Math.min(notifications.length - 1, i + 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setNotifActiveIndex(i => Math.max(0, i < 0 ? 0 : i - 1));
        } else if (e.key === 'Home') {
            e.preventDefault();
            setNotifActiveIndex(0);
        } else if (e.key === 'End') {
            e.preventDefault();
            setNotifActiveIndex(notifications.length - 1);
        } else if (e.key === 'Enter') {
            const idx = notifActiveIndex >= 0 ? notifActiveIndex : 0;
            const n = notifications[idx];
            if (n) {
                e.preventDefault();
                api.notifications.markRead(n.id).catch(() => {});
                setNotifications(prev => prev.map(notif => notif.id === n.id ? { ...notif, unread: false } : notif));
                setUnreadCount(prev => Math.max(0, prev - (n.unread ? 1 : 0)));
                const msgParam = n.messageId ? `?messageId=${n.messageId}` : '';
                if (n.type === 'friend_request') {
                    navigate('/friends');
                } else if (n.guildId && n.channelId) {
                    navigate(buildGuildChannelRoute(n.guildId, n.channelId) + msgParam);
                } else if (n.channelId) {
                    navigate(buildDmRoute(n.channelId) + msgParam);
                }
                setIsOpen(false);
            }
        }
    };

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginLeft: 'auto', position: 'relative' }}>
            {/* Search */}
            <button type="button" className={`input-icon-btn ${searchOpen ? 'primary' : ''}`} onClick={() => { setSearchOpen(!searchOpen); setIsOpen(false); }} aria-label="Search" aria-expanded={searchOpen}>
                <Search size={20} />
            </button>

            {/* Bell */}
            <button type="button" className="input-icon-btn" style={{ position: 'relative' }} onClick={() => { setIsOpen(!isOpen); setSearchOpen(false); }} aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`} aria-expanded={isOpen}>
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
            </button>

            {/* Help */}
            <button type="button" className="input-icon-btn" onClick={() => navigate('/help-center')} aria-label="Help center">
                <HelpCircle size={20} />
            </button>

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
                            onKeyDown={onSearchInputKey}
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

                    <div role="listbox" aria-label="Search results" style={{ maxHeight: '320px', overflowY: 'auto', padding: '8px' }}>
                        {searchQuery.trim() === '' ? (
                            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                                Type to search messages, users, and channels
                            </div>
                        ) : searching ? (
                            <div style={{ padding: '8px' }}>
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <div key={`search-skel-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px' }}>
                                        <Skeleton variant="circle" width={32} height={32} />
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <Skeleton variant="text" width="55%" />
                                            <Skeleton variant="text" width="30%" height="0.85em" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : searchResults.length === 0 ? (
                            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                                No results for "{searchQuery}"
                            </div>
                        ) : (
                            searchResults.map((r, idx) => (
                                <div key={r.id} role="option" aria-selected={searchActiveIndex === idx} onMouseEnter={() => setSearchActiveIndex(idx)} onClick={() => goToSearchResult(r)} style={{
                                    padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
                                    transition: 'background 0.15s', display: 'flex', alignItems: 'center', gap: '12px',
                                    background: searchActiveIndex === idx ? 'var(--bg-tertiary)' : 'transparent',
                                    outline: searchActiveIndex === idx ? '1px solid var(--accent-primary)' : 'none',
                                }} className="search-result-item">
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
                <div ref={el => { popupRef.current = el; notifPanelRef.current = el; }}
                    tabIndex={-1}
                    role="menu"
                    aria-label="Notifications"
                    onKeyDown={onNotifKey}
                    style={{
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
                    flexDirection: 'column',
                    outline: 'none',
                }}>
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--stroke)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-tertiary)' }}>
                        <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0, fontFamily: 'var(--font-display)' }}>Notifications</h3>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <span onClick={() => { api.notifications.markAllRead().then(() => { setNotifications(prev => prev.map(n => ({ ...n, unread: false }))); setUnreadCount(0); clearAllUnread(); addToast({ title: 'All marked as read', variant: 'success' }); }).catch(() => addToast({ title: "Couldn't mark all as read. Try again.", variant: 'error' })); }} style={{ fontSize: '12px', color: 'var(--accent-blue)', cursor: 'pointer', fontWeight: 500 }}>Mark all read</span>
                            <span onClick={() => { api.notifications.clearAll().then(() => { setNotifications([]); setUnreadCount(0); clearAllUnread(); addToast({ title: 'All notifications cleared', variant: 'success' }); setIsOpen(false); }).catch(() => addToast({ title: "Couldn't clear notifications. Try again.", variant: 'error' })); }} style={{ fontSize: '12px', color: 'var(--error)', cursor: 'pointer', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '3px' }}><Trash2 size={11} /> Clear all</span>
                        </div>
                    </div>

                    <div style={{ maxHeight: '300px', overflowY: 'auto', padding: '8px' }}>
                        {notifications.length === 0 ? (
                            <div style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                <Bell size={32} style={{ opacity: 0.3, marginBottom: '10px' }} />
                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>You're all caught up</div>
                                <div style={{ fontSize: '12px' }}>New mentions and replies will show up here.</div>
                            </div>
                        ) : notifications.map((n, idx) => (
                            <div
                                key={n.id}
                                role="menuitem"
                                aria-current={notifActiveIndex === idx ? 'true' : undefined}
                                onMouseEnter={() => { setHoveredNotifId(Number(n.id) || 0); setNotifActiveIndex(idx); }}
                                onMouseLeave={() => setHoveredNotifId(null)}
                                onClick={() => {
                                    // Mark as read
                                    api.notifications.markRead(n.id).catch(() => {});
                                    setNotifications(prev => prev.map(notif => notif.id === n.id ? { ...notif, unread: false } : notif));
                                    setUnreadCount(prev => Math.max(0, prev - (n.unread ? 1 : 0)));
                                    // Navigate to the message
                                    const msgParam = n.messageId ? `?messageId=${n.messageId}` : '';
                                    if (n.type === 'friend_request') {
                                        navigate('/friends');
                                    } else if (n.guildId && n.channelId) {
                                        navigate(buildGuildChannelRoute(n.guildId, n.channelId) + msgParam);
                                    } else if (n.channelId) {
                                        navigate(buildDmRoute(n.channelId) + msgParam);
                                    }
                                    setIsOpen(false);
                                }}
                                style={{
                                    padding: '12px',
                                    borderRadius: 'var(--radius-sm)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '4px',
                                    position: 'relative',
                                    transition: 'background 0.2s, transform 0.2s',
                                    background: notifActiveIndex === idx
                                        ? 'var(--bg-tertiary)'
                                        : (n.unread ? 'rgba(59, 130, 246, 0.05)' : 'transparent'),
                                    outline: notifActiveIndex === idx ? '1px solid var(--accent-primary)' : 'none',
                                }}
                                className="notif-item"
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
