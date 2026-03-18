import { useState, useEffect, useCallback } from 'react';
import { Inbox, CheckCheck, AtSign, Reply, MessageSquare, Hash, ChevronRight, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api, API_BASE } from '../../lib/api';
import { useToast } from '../../components/ui/ToastManager';

type FilterTab = 'all' | 'mentions' | 'replies' | 'unreads';

interface InboxItem {
    id: string;
    type: 'mention' | 'reply' | 'unread';
    messageId: string;
    channelId: string;
    channelName: string;
    guildId: string;
    guildName: string;
    guildIconHash?: string | null;
    authorId: string;
    authorName: string;
    authorAvatarHash?: string | null;
    contentPreview: string;
    createdAt: string;
    read: boolean;
}

interface GroupedItems {
    guildId: string;
    guildName: string;
    guildIconHash?: string | null;
    items: InboxItem[];
}

function formatRelativeDate(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
}

function groupByServer(items: InboxItem[]): GroupedItems[] {
    const map = new Map<string, GroupedItems>();
    for (const item of items) {
        let group = map.get(item.guildId);
        if (!group) {
            group = {
                guildId: item.guildId,
                guildName: item.guildName,
                guildIconHash: item.guildIconHash,
                items: [],
            };
            map.set(item.guildId, group);
        }
        group.items.push(item);
    }
    return Array.from(map.values());
}

const FILTER_TABS: { key: FilterTab; label: string; icon: React.ReactNode }[] = [
    { key: 'all', label: 'All', icon: <Inbox size={14} /> },
    { key: 'mentions', label: 'Mentions', icon: <AtSign size={14} /> },
    { key: 'replies', label: 'Replies', icon: <Reply size={14} /> },
    { key: 'unreads', label: 'Unreads', icon: <MessageSquare size={14} /> },
];

const UnifiedInbox = () => {
    const { addToast } = useToast();
    const navigate = useNavigate();
    const [items, setItems] = useState<InboxItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

    const fetchInbox = useCallback(async () => {
        setLoading(true);
        try {
            const data = await api.get('/users/@me/unified-inbox') as InboxItem[];
            setItems(Array.isArray(data) ? data : []);
        } catch {
            // Endpoint may not exist yet — show empty state
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchInbox();
    }, [fetchInbox]);

    const handleMarkRead = useCallback(async (item: InboxItem) => {
        try {
            await api.post(`/users/@me/unified-inbox/${item.id}/read`, {});
        } catch {
            // optimistic update
        }
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, read: true } : i));
    }, []);

    const handleMarkAllRead = useCallback(async () => {
        try {
            await api.post('/users/@me/unified-inbox/read-all', {});
        } catch {
            // optimistic update
        }
        setItems(prev => prev.map(i => ({ ...i, read: true })));
        addToast({ title: 'All items marked as read', variant: 'success' });
    }, [addToast]);

    const handleJumpToMessage = useCallback((item: InboxItem) => {
        navigate(`/guild/${item.guildId}/channel/${item.channelId}`);
    }, [navigate]);

    const filtered = items.filter(item => {
        if (activeFilter === 'all') return true;
        if (activeFilter === 'mentions') return item.type === 'mention';
        if (activeFilter === 'replies') return item.type === 'reply';
        if (activeFilter === 'unreads') return !item.read;
        return true;
    });

    const sorted = [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const grouped = groupByServer(sorted);
    const unreadCount = items.filter(i => !i.read).length;

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', overflow: 'hidden' }}>
            <header className="channel-header glass-panel">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Inbox size={20} color="var(--accent-primary)" />
                    <h2 style={{ fontSize: '15px', fontWeight: 600 }}>Inbox</h2>
                    {unreadCount > 0 && (
                        <span style={{
                            fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px',
                            background: 'rgba(82, 109, 245, 0.12)', color: 'var(--accent-primary)',
                        }}>
                            {unreadCount}
                        </span>
                    )}
                </div>
                {unreadCount > 0 && (
                    <button
                        onClick={handleMarkAllRead}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            background: 'none', border: '1px solid var(--stroke)',
                            borderRadius: '8px', padding: '6px 12px', cursor: 'pointer',
                            color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600,
                            transition: 'all 0.15s',
                        }}
                        className="hover-border-text-accent"
                    >
                        <CheckCheck size={14} />
                        Mark all read
                    </button>
                )}
            </header>

            <div className="content-padding" style={{ flex: 1, overflowY: 'auto', padding: '32px 48px' }}>
                <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                    <div style={{ marginBottom: '24px' }}>
                        <h1 style={{ fontSize: '28px', fontWeight: 600, fontFamily: 'var(--font-display)', marginBottom: '8px' }}>
                            Unified Inbox
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                            All your unread messages, mentions, and replies across all servers.
                        </p>
                    </div>

                    {/* Filter Tabs */}
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'var(--bg-secondary)', borderRadius: '10px', padding: '4px' }}>
                        {FILTER_TABS.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveFilter(tab.key)}
                                style={{
                                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                    padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                                    fontSize: '13px', fontWeight: 600, transition: 'all 0.15s',
                                    background: activeFilter === tab.key ? 'var(--bg-elevated)' : 'transparent',
                                    color: activeFilter === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
                                    boxShadow: activeFilter === tab.key ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                                }}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-muted)' }}>
                            Loading...
                        </div>
                    ) : sorted.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '64px 0' }}>
                            <Inbox size={48} color="var(--text-muted)" style={{ marginBottom: '16px', opacity: 0.5 }} />
                            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>You're all caught up!</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                                {activeFilter === 'all'
                                    ? 'No unread messages, mentions, or replies.'
                                    : `No ${activeFilter} to show.`}
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            {grouped.map(group => (
                                <div key={group.guildId}>
                                    {/* Server Header */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                                        {group.guildIconHash ? (
                                            <img
                                                src={`${API_BASE}/files/${group.guildIconHash}`}
                                                alt=""
                                                style={{ width: 24, height: 24, borderRadius: '6px', objectFit: 'cover' }}
                                            />
                                        ) : (
                                            <div style={{
                                                width: 24, height: 24, borderRadius: '6px',
                                                background: 'var(--bg-tertiary)', display: 'flex',
                                                alignItems: 'center', justifyContent: 'center',
                                                fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)',
                                            }}>
                                                {group.guildName.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            {group.guildName}
                                        </span>
                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                            {group.items.length} item{group.items.length !== 1 ? 's' : ''}
                                        </span>
                                    </div>

                                    {/* Items */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {group.items.map(item => (
                                            <div
                                                key={item.id}
                                                style={{
                                                    background: item.read ? 'var(--bg-secondary)' : 'var(--bg-elevated)',
                                                    border: '1px solid var(--stroke)',
                                                    borderRadius: '10px', padding: '12px 16px',
                                                    display: 'flex', alignItems: 'center', gap: '12px',
                                                    cursor: 'pointer', transition: 'border-color 0.15s',
                                                    opacity: item.read ? 0.6 : 1,
                                                }}
                                                className="hover-border-muted"
                                                onClick={() => handleJumpToMessage(item)}
                                            >
                                                {/* Type indicator */}
                                                <div style={{
                                                    width: 32, height: 32, borderRadius: '8px',
                                                    background: item.type === 'mention' ? 'rgba(82, 109, 245, 0.12)' : item.type === 'reply' ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-tertiary)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    color: item.type === 'mention' ? 'var(--accent-primary)' : item.type === 'reply' ? '#10b981' : 'var(--text-muted)',
                                                    flexShrink: 0,
                                                }}>
                                                    {item.type === 'mention' ? <AtSign size={16} /> : item.type === 'reply' ? <Reply size={16} /> : <MessageSquare size={16} />}
                                                </div>

                                                {/* Content */}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                                                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                            {item.authorName}
                                                        </span>
                                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <Hash size={11} />
                                                            {item.channelName}
                                                        </span>
                                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }}>
                                                            {formatRelativeDate(item.createdAt)}
                                                        </span>
                                                    </div>
                                                    <div style={{
                                                        fontSize: '13px', color: 'var(--text-secondary)',
                                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                    }}>
                                                        {item.contentPreview || '(attachment)'}
                                                    </div>
                                                </div>

                                                {/* Actions */}
                                                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                                                    {!item.read && (
                                                        <button
                                                            onClick={() => handleMarkRead(item)}
                                                            title="Mark as read"
                                                            style={{
                                                                background: 'none', border: '1px solid var(--stroke)',
                                                                borderRadius: '6px', padding: '4px 8px',
                                                                cursor: 'pointer', color: 'var(--text-muted)',
                                                                display: 'flex', alignItems: 'center', gap: '4px',
                                                                fontSize: '11px', transition: 'all 0.15s',
                                                            }}
                                                            className="hover-border-text-accent"
                                                        >
                                                            <CheckCheck size={12} />
                                                        </button>
                                                    )}
                                                    <ChevronRight size={16} color="var(--text-muted)" style={{ alignSelf: 'center' }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UnifiedInbox;
